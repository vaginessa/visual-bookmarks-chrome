/* eslint-disable no-console */
import Settings from './settings';
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

FS.init(500);

function captureScreen(link, callback) {
  chrome.windows.create({
    url: link,
    focused: false,
    left: 1e5,
    top: 1e5,
    width: 1,
    height: 1,
    type: 'popup'
  }, function(w) {

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
    }, 25000);

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
            }, 500);
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
      // ID of the item for subfolders starts with 'save-{parentId}'
      // to get a valid ID, remove the extra characters from the string
      // extra characters will be found in subfolders in the add item
      const menuItemId = data.menuItemId.replace('save-', '');

      const parentId =
        (menuItemId === 'current_folder') ?
          window.localStorage.getItem('default_folder_id') :
          menuItemId;

      // Create
      const response = await create({
        parentId,
        url: data.pageUrl,
        title: tabs[0].title
      }).catch(err => {
        console.warn(err);
      });
      // do not generate a thumbnail if you could not create a bookmark or the auto-generation option is turned off
      if (!response || localStorage.getItem('auto_generate_thumbnail') !== 'true') return;

      $notifications(chrome.i18n.getMessage('notice_bookmark_created'));
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
  });
}

function browserActionHandler() {
  const urls = [
    chrome.extension.getURL('newtab.html'),
    'chrome://newtab/'
  ];

  chrome.tabs.query({ currentWindow: true }, function(tabs) {
    for (let i = 0, tab; tab = tabs[i]; i++) { // eslint-disable-line no-cond-assign
      if (tab.url && ~urls.indexOf(tab.url)) {
        return chrome.tabs.update(tab.id, { active: true });
      }
    }
    return chrome.tabs.create({ url: chrome.extension.getURL('newtab.html') });
  });
}

function initContextMenu() {
  browserContextMenu.init();
}

chrome.runtime.onInstalled.addListener((evt) => {
  // if (callback.reason === 'update') {}
  Settings.init();
  initContextMenu();

  if (evt.reason === 'update') {
    chrome.tabs.create({ url: chrome.extension.getURL('options.html#updated') });
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
    browserContextMenu.toggle();
  }
});
