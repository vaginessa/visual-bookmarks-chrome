import { settings } from './settings';
import FS from './api/fs';
import browserContextMenu from './plugins/browserContextMenu';
import {
  $notifications,
  $resizeScreen,
  $base64ToBlob,
  $getDomain
} from './utils';
import {
  create,
  search
} from './api/bookmark';
import { storage } from './api/storage';

// FIXME: ??? indexDB ???
FS.init(500);

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

function captureScreen(link, callback) {
  chrome.windows.create({
    url: link,
    focused: false,
    left: 1e5,
    top: 1e5,
    width: 1,
    height: 1,
    type: 'popup'
  }, async function(w) {

    // capture timeout
    let timeout = 25000;

    // delay in milliseconds
    // const captureDelay = (parseFloat(localStorage.getItem('thumbnails_update_delay')) || 0.5) * 1000;
    const { settings } = await storage.local.get('settings');
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

    try {
      chrome.tabs.executeScript(tab.id, {
        code: 'document.addEventListener("DOMContentLoaded", function(){document.body.style.overflow = "hidden";});',
        runAt: 'document_start'
      }, () => {
        let e = chrome.runtime.lastError;
        if (e !== undefined) {
          console.log(tab.id, e);
        }
      });
    } catch (e) {
      console.warn(e);
    }

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
          chrome.windows.update(w.id, {
            width: 1170,
            height: 720
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
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs){
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
      // window.localStorage.getItem('default_folder_id') :
        ? settings.default_folder_id
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

      // if (localStorage.getItem('auto_generate_thumbnail') === 'true') {
      if (settings.auto_generate_thumbnail) {
        captureScreen(response.url, async function(data) {
          const image = await $resizeScreen(data.capture);
          const blob = $base64ToBlob(image, 'image/jpg');
          const name = `${$getDomain(response.url)}_${response.id}.jpg`;

          const dirEntry = await FS.createDir('images').catch(err => console.log(err));
          const fileEntry = await FS.createFile(`${dirEntry.fullPath}/${name}`, {
            file: blob,
            fileType: blob.type
          }).catch(err => console.warn(err));

          const obj = JSON.parse(localStorage.getItem('custom_dials'));
          obj[response.id] = {
            image: fileEntry.toURL(),
            custom: false
          };

          localStorage.setItem('custom_dials', JSON.stringify(obj));
          chrome.runtime.sendMessage({ autoGenerateThumbnail: true });
        });
      }

      // if (localStorage.getItem('close_tab_after_adding_bookmark') === 'true') {
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
      await storage.local.set({upgraded_settings: true});
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
      await storage.local.set({settings: restoreLegacySettings});

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

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.captureUrl) {
    captureScreen(request.captureUrl, async function(data) {
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
        console.warn(`Cannot access contents of url: ${request.captureUrl}`);
        return false;
      }

      const image = await $resizeScreen(data.capture);
      const blob = $base64ToBlob(image, 'image/jpg');
      const name = `${$getDomain(request.captureUrl)}_${request.id}.jpg`;

      const dirEntry = await FS.createDir('images');
      const fileEntry = await FS.createFile(`${dirEntry.fullPath}/${name}`, { file: blob, fileType: blob.type });
      // console.info(`Image file saved as ${fileEntry.toURL()}`);
      try {
        sendResponse(fileEntry.toURL());
      } catch (e) {}
    });

    // send a response asynchronously (return true)
    // this will keep the message channel open to the other end until sendResponse is called
    return true;
  }

  // Toggle contextmenu item
  if (request.showContextMenuItem) {
    const { checked } = request.showContextMenuItem;
    browserContextMenu.toggle(checked);
  }
});

//
await settings.init();
initContextMenu();
