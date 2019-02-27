/* eslint-disable no-console */
import Settings from './components/settings';
import FS from './components/fs';
import Helpers from './components/helpers';

FS.init(500);
Settings.init();

function captureScreen(link, callback) {
  let windowParam = {
      url: link,
      focused: false,
      left: 1e5,
      top: 1e5,
      width: 1,
      height: 1,
      type: 'popup'
    },
    tab,
    stop = false;

  chrome.windows.create(windowParam, function(w) {
    if (!w.tabs || !w.tabs.length) {
      chrome.windows.remove(w.id);
      console.error('not found page');
      return false;
    }

    tab = w.tabs[0];

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

    chrome.windows.update(w.id, {
      width: 1170,
      height: 720,
      top: 1e5,
      left: 1e5
    }, function() {
      checkerStatus();
    });

    function checkerStatus() {
      if (stop == true) {
        clearTimeout(closeWindow);
        return false;
      }

      chrome.tabs.get(tab.id, function(tabInfo) {
        if (tabInfo.status == 'complete') {
          setTimeout(function() {
            chrome.tabs.captureVisibleTab(w.id, function(dataUrl) {
              callback({
                capture: dataUrl,
                title: tabInfo.title
              });
              clearTimeout(closeWindow);
              try {
                chrome.windows.remove(w.id);
              } catch (e) {}
            });
          }, 300);
        } else {
          setTimeout(function() {
            checkerStatus();
          }, 500);
        }
      });
    }
  });
}

function handlerCreateBookmark(data) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
    // const searchQuery = {
    //   url: data.pageUrl,
    //   title: tabs[0].title
    // }
    chrome.bookmarks.search(data.pageUrl, function(matches) {
      const isExist = matches.some(match => match.url === data.pageUrl);

      if (isExist) {
        // Bookmarks exist
        Helpers.notifications(chrome.i18n.getMessage('notice_bookmark_exist'));
      } else {
        // Create
        chrome.bookmarks.create({
          'parentId': window.localStorage.getItem('default_folder_id'),
          'url': data.pageUrl,
          'title': tabs[0].title
        }, function(response) {

          Helpers.notifications(chrome.i18n.getMessage('notice_bookmark_created'));

          captureScreen(response.url, function(data) {

            Helpers.resizeScreen(data.capture, function(image) {
              const blob = Helpers.base64ToBlob(image, 'image/jpg');
              const name = `${Helpers.getDomain(response.url)}_${response.id}.jpg`;

              FS.createDir('images', function(dirEntry) {
                FS.createFile(`${dirEntry.fullPath}/${name}`, { file: blob, fileType: blob.type }, function(fileEntry) {
                  const obj = JSON.parse(localStorage.getItem('custom_dials'));
                  obj[response.id] = fileEntry.toURL();
                  localStorage.setItem('custom_dials', JSON.stringify(obj));
                });
              });
            });
          });
        });

      }
    });

  });
}

// experiments with the context menu as an option with the persistent option false
const ContextMenu = {
  init() {
    const isShow = localStorage.getItem('show_contextmenu_item') === 'true';
    if (!isShow) return;

    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError);
      }
      this.create();
    });
  },
  create() {
    const props = {
      id: 'create-bookmarks',
      title: chrome.i18n.getMessage('add_bookmark'),
      contexts: ['page']
    };

    chrome.contextMenus.create(props, () => {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError);
      }
    });
  },
  toggle() {
    const isShow = localStorage.getItem('show_contextmenu_item') === 'true';

    if (isShow) {
      this.create();
    } else {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) return;
      });
    }
  }
};

// In future
chrome.runtime.onInstalled.addListener(function() {
  // if (callback.reason === 'update') {}
  ContextMenu.init();
});

chrome.runtime.onStartup.addListener(() => {
  ContextMenu.init();
});

chrome.contextMenus.onClicked.addListener(function(data) {
  switch (data.menuItemId) {
    case 'create-bookmarks': handlerCreateBookmark(data); break;
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.captureUrl) {

    captureScreen(request.captureUrl, function(data) {

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

      Helpers.resizeScreen(data.capture, function(image) {

        const blob = Helpers.base64ToBlob(image, 'image/jpg');
        const name = `${Helpers.getDomain(request.captureUrl)}_${request.id}.jpg`;

        FS.createDir('images', function(dirEntry) {
          FS.createFile(`${dirEntry.fullPath}/${name}`, { file: blob, fileType: blob.type }, function(fileEntry) {
            const obj = JSON.parse(localStorage.getItem('custom_dials'));
            obj[request.id] = fileEntry.toURL();
            localStorage.setItem('custom_dials', JSON.stringify(obj));
            console.info(`Image file saved as ${fileEntry.toURL()}`);
            try {
              sendResponse(fileEntry.toURL());
            } catch (e) {}
          });
        });


      });
    });

    // send a response asynchronously (return true)
    // this will keep the message channel open to the other end until sendResponse is called
    return true;
  }

  // Toggle contextmenu item
  if (request.showContextMenuItem) {
    ContextMenu.toggle();
  }
});

chrome.browserAction.onClicked.addListener(function() {

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

});
