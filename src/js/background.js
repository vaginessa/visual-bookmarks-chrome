import { settings } from './settings';
import FS from './api/fs';
import ImageDB from './api/imageDB';
import { storage } from './api/storage';
import browserContextMenu from './plugins/browserContextMenu';
import {
  $notifications,
  $base64ToBlob,
  $resizeThumbnail
} from './utils';
import {
  create,
  search
} from './api/bookmark';
import {
  THUMBNAIL_POPUP_HEIGHT,
  THUMBNAIL_POPUP_WIDTH
} from './constants';

// TODO: transfer current thumbnails to indexDB
// preparing to move to manifest
function convertImageToDB(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(image, 0, 0, image.width, image.height);

      resolve(canvas.convertToBlob({
        type: 'image/webp',
        quality: 0.75
      }));
    };
    image.onerror = reject;
    image.src = path;
  });
}

function browserActionHandler() {
  // TODO: need current hash folder
  const urls = [
    chrome.runtime.getURL('newtab.html'),
    'chrome://newtab/'
  ];

  chrome.tabs.query({ currentWindow: true }, function(tabs) {
    for (let tab of tabs) {
      if (urls.some(url => tab.url.startsWith(url))) {
        return chrome.tabs.update(tab.id, { active: true });
      }
    }
    return chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') });
  });
}

async function initContextMenu() {
  const { settings } = await storage.local.get('settings');
  browserContextMenu.init(settings.show_contextmenu_item);
}

async function captureScreen(link, callback) {
  const { screen } = await storage.local.get('screen');

  chrome.windows.create({
    url: link,
    state: 'normal',
    left: 1e5,
    top: 1e5,
    width: 1,
    height: 1,
    type: 'popup'
  }, async function(w) {
    // capture timeout
    let timeout = 25000;

    const { settings } = await storage.local.get('settings');
    // delay in milliseconds
    const captureDelay = (parseFloat(settings.thumbnails_update_delay) || 0.5) * 1000;

    if (captureDelay > 500) {
      timeout += captureDelay;
    }

    if (!w.tabs || !w.tabs.length) {
      chrome.windows.remove(w.id);
      console.error('not found page');
      return false;
    }

    let tab = w.tabs[0];
    let stop = false;

    chrome.tabs.update(tab.id, {
      muted: true
    });

    let closeWindow = setTimeout(function() {
      chrome.windows.remove(w.id);
      callback({ error: 'long_load', url: tab.url });
      stop = true;
    }, timeout);

    checkerStatus();

    function checkerStatus() {
      if (stop) {
        clearTimeout(closeWindow);
        return false;
      }

      chrome.tabs.get(tab.id, function(tabInfo) {
        if (tabInfo.status === 'complete') {
          chrome.tabs.insertCSS(tab.id, {
            code: 'html, body { overflow-y: hidden !important; }'
          });
          chrome.windows.update(w.id, {
            left: screen.availWidth - THUMBNAIL_POPUP_WIDTH,
            top: screen.availHeight - THUMBNAIL_POPUP_HEIGHT,
            width: THUMBNAIL_POPUP_WIDTH,
            height: THUMBNAIL_POPUP_HEIGHT,
            focused: true
          }, function(win) {
            setTimeout(() => {
              chrome.tabs.captureVisibleTab(win.id, function(dataUrl) {
                callback({
                  capture: dataUrl,
                  title: tabInfo.title
                });
                try {
                  chrome.windows.remove(win.id, () => {
                    clearTimeout(closeWindow);
                  });
                } catch (e) {}
              });
            }, captureDelay);
          });
        } else {
          setTimeout(() => {
            checkerStatus();
          }, 300);
        }
      });
    }
  });
}

function handlerCreateBookmark(data) {
  chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs){
    const matches = await search(data.pageUrl);
    if (!matches) return;

    const isExist = matches.some(match => match.url === data.pageUrl);
    if (isExist) {
      // Bookmarks exist
      $notifications(chrome.i18n.getMessage('notice_bookmark_exist'));
    } else {
      const { settings } = await storage.local.get('settings');
      // ID of the item for subfolders starts with 'save-{parentId}'
      // to get a valid ID, remove the extra characters from the string
      // extra characters will be found in subfolders in the add item
      const menuItemId = data.menuItemId.replace('save-', '');

      const parentId = (menuItemId === 'current_folder')
        ? String(settings.default_folder_id)
        : menuItemId;

      // Create
      const response = await create({
        parentId,
        url: data.pageUrl,
        title: tabs[0].title
      }).catch(err => {
        console.warn(err);
      });

      // do not generate a thumbnail if you could not create a bookmark or the auto-generation option is turned off
      if (!response) return;

      if (settings.auto_generate_thumbnail) {
        captureScreen(response.url, async function(data) {
          const fileBlob = $base64ToBlob(data.capture, 'image/webp');
          const blob = await $resizeThumbnail(fileBlob);
          await ImageDB.update({ id: response.id, blob, custom: false });
          chrome.runtime.sendMessage({ autoGenerateThumbnail: true });
        });
      }

      if (settings.close_tab_after_adding_bookmark) {
        chrome.tabs.remove(tabs[0].id);
      }
      $notifications(chrome.i18n.getMessage('notice_bookmark_created'));
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  // if storage changes from local
  // watching the settings parameter
  if (area === 'local' && changes?.settings?.oldValue) {
    // at the moment we only need to track changes for the show_contextmenu_item option
    const { show_contextmenu_item: newContextMenu } = changes.settings.newValue;
    const { show_contextmenu_item: oldContextMenu } = changes.settings.oldValue;
    // toggle the context menu only if show_contextmenu_item has changed
    if (newContextMenu !== oldContextMenu) {
      browserContextMenu.toggle(newContextMenu);
    }
  }
});

chrome.runtime.onInstalled.addListener(async(event) => {
  if (event.reason === 'install') {
    await settings.init();
    await storage.local.set({ upgraded_settings: true });
  }
  initContextMenu();
  if (event.reason === 'update') {
    // TODO: temporary code to migrate existing settings to new storage
    // trying to transfer existing settings from localStorage to new chrome.storage
    // to further prepare the migration to manifest v3

    // in order to mark users whose settings have already been transferred,
    // we will create a temporary flag in the repository upgraded_settings
    // if the flag does not exist, then we try to transfer the settings to the new storage
    const { upgraded_settings } = await storage.local.get('upgraded_settings');
    if (!upgraded_settings) {
      await settings.init();
      await storage.local.set({ upgraded_settings: true });
      // transfer only those parameters that exist in the new settings object
      const restoreLegacySettings = Object.keys(settings.$).reduce((acc, key) => {
        if (localStorage[key]) {
          // translate options with boolean values to boolean type
          if (['true', 'false'].includes(localStorage[key])) {
            acc[key] = localStorage[key] === 'true';
          } else {
            // an object with services_list needs to be parsed into a JSON
            acc[key] = (key === 'services_list')
              ? JSON.parse(localStorage[key])
              : localStorage[key];
          }
          // cleared setting from old storage
          localStorage.removeItem(key);
        }
        return acc;
      }, {});
      // save the transferred settings in the new storage
      await storage.local.set({ settings: restoreLegacySettings });
    }

    // TODO: transfer current thumbnails to indexDB
    // preparing to move to manifest
    // if (localStorage.custom_dials || localStorage.background_local) {
    if (localStorage.custom_dials || localStorage.background_local) {
      const images = [];
      const customDials = JSON.parse(localStorage.custom_dials);

      $notifications(
        chrome.i18n.getMessage('transferring_thumbnails_notification'),
        'changelog',
        [{ title: chrome.i18n.getMessage('transferring_thumbnails_notification_btn') }]
      );

      for (const [key, value] of Object.entries(customDials)) {
        try {
          const blob = await convertImageToDB(value.image);
          images.push({
            id: key,
            custom: value.custom,
            blob
          });
        } catch (error) {
          console.error(error);
          if (error.target?.src) {
            console.error('load error - ' + error.target.src);
          }
        }
      }
      localStorage.removeItem('custom_dials');

      if (localStorage.background_local) {
        const blob = await convertImageToDB(localStorage.background_local);
        images.push({
          id: 'background',
          blob,
          blobThumbnail: blob
        });
        localStorage.removeItem('background_local');
      }

      try {
        await FS.init();
        FS.purge();
      } catch (error) {
        console.warn('error: failed to clean up the images folder');
      }

      if (images.length) {
        await ImageDB.add(images);
        chrome.runtime.sendMessage({
          event: 'transfered_thumbnails'
        });
      }
    }
  }
});

chrome.bookmarks.onCreated.addListener(initContextMenu);
chrome.bookmarks.onChanged.addListener(initContextMenu);
chrome.bookmarks.onRemoved.addListener(initContextMenu);
chrome.bookmarks.onMoved.addListener(initContextMenu);

chrome.contextMenus.onClicked.addListener(handlerCreateBookmark);
chrome.browserAction.onClicked.addListener(browserActionHandler);
chrome.notifications.onClicked.addListener(browserActionHandler);
chrome.notifications.onButtonClicked.addListener((id) => {
  // TODO: updates info
  // more about updates
  // go to options page with hash to show modal info
  if (id === 'changelog') {
    return chrome.tabs.create({ url: chrome.runtime.getURL('options.html#changelog') });
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.capture) {
    const { id, captureUrl } = request.capture;

    // captureScreen(request.captureUrl, async function(data) {
    captureScreen(captureUrl, async function(data) {
      if (data && data.error) {
        try {
          sendResponse({ warning: 'Timeout waiting for a screenshot' });
        } catch (e) {}
        console.warn(`Timeout waiting for a screenshot ${data.url}`);
        return false;
      }

      // If cannot access contents of url
      if (data && data.capture === undefined) {
        try {
          sendResponse({ warning: 'Cannot access contents of url' });
        } catch (e) {}
        console.warn(`Cannot access contents of url: ${captureUrl}`);
        return false;
      }

      const fileBlob = $base64ToBlob(data.capture, 'image/webp');
      const blob = await $resizeThumbnail(fileBlob);
      await ImageDB.update({ id, blob, custom: false });
      try {
        sendResponse('success');
      } catch (e) {}
    });
  }

  // Toggle contextmenu item
  if (request.showContextMenuItem) {
    const { checked } = request.showContextMenuItem;
    browserContextMenu.toggle(checked);
  }

  // send a response asynchronously (return true)
  // this will keep the message channel open to the other end until sendResponse is called
  return true;
});
