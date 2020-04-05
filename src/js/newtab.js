import '../css/newtab.css';
import Gmodal from 'glory-modal';
import Helpers from './components/helpers';
import Settings from './components/settings';
import Bookmarks from './components/bookmarks';
import Localization from './components/localization';
import UI from './components/ui';
import ContextMenu from './components/contextmenu';
import Ripple from './components/ripple';
import { get, getChildren } from './api/bookmark';

const NewTab = (() => {
  const container = document.getElementById('bookmarks');
  const modal         = document.getElementById('modal');
  const form          = document.getElementById('formBookmark');
  const modalHead     = document.getElementById('modalHead');
  const foldersList   = document.getElementById('folderList');
  const titleField    = document.getElementById('title');
  const urlField      = document.getElementById('url');
  const urlWrap       = document.getElementById('urlWrap');
  const customScreen  = document.getElementById('customScreen');
  const ctxMenuEl     = document.getElementById('context-menu');
  const upload        = document.getElementById('upload');
  const ctxToggleItems = [
    ...document.querySelectorAll('.is-bookmark'),
    ...document.querySelectorAll('.is-folder')
  ];
  let isGenerateThumbs = false;
  let modalApi;
  let ctxMenu;
  let generateThumbsBtn = null;

  function init() {
    modalApi = new Gmodal(modal, {
      stickySelectors: ['.sticky'],
      closeBackdrop: false
    });
    ctxMenu = new ContextMenu(ctxMenuEl, {
      delegateSelector: '.bookmark',
      scrollContainer: '.app'
    });

    // TODO: if
    (localStorage.getItem('google_services') === 'true') && runServices();

    upload.addEventListener('change', uploadScreen);
    container.addEventListener('click', delegateClick);

    ctxMenuEl.addEventListener('contextMenuSelection', controlsHandler);
    ctxMenuEl.addEventListener('contextMenuOpen', ctxMenuOpen);

    document.getElementById('formBookmark').addEventListener('submit', submitForm);
    document.getElementById('resetCustomImage').addEventListener('click', resetThumb);

    modal.addEventListener('gmodal:close', modalAfterClose);

    Bookmarks.generateFolderList(foldersList);

    // If thumbnail generation button
    if (localStorage.getItem('thumbnails_update_button') === 'true') {

      generateThumbsBtn = Object.assign(document.createElement('button'), {
        className: 'circ-btn update-thumbnails'
      });
      document.body.appendChild(generateThumbsBtn);

      // Thumbnail generation tracking events
      // Switching the flag in the local storage to prevent multiple launches
      // Reset the flag when you close the window
      if (localStorage.getItem('update_thumbnails') === 'true') {
        // if the storage has a launch flag for generating thumbnails, disable button
        generateThumbsBtn.disabled = true;
      }
      container.addEventListener('thumbnails:updating', function() {
        isGenerateThumbs = true;
        generateThumbsBtn.disabled = true;
        localStorage.setItem('update_thumbnails', true);
      });
      container.addEventListener('thumbnails:updated', function() {
        isGenerateThumbs = false;
        generateThumbsBtn.disabled = false;
        localStorage.removeItem('update_thumbnails');
      });
      generateThumbsBtn.addEventListener('click', generateThumbs);
    }

    window.addEventListener('popstate', popStateHandler);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('unload', unload);
    window.addEventListener('storage', storageUpdate);

    // if support Page Visibility API
    // if the tab is open but not active, then when you change bookmarks from other places,
    // we will do a reload of the bookmarks page to display the latest changes
    if ('hidden' in document) {
      if (localStorage.getItem('auto_generate_thumbnail') !== 'true') {
        chrome.bookmarks.onCreated.addListener(pageVisibility);
      }
      chrome.bookmarks.onChanged.addListener(pageVisibility);
      chrome.bookmarks.onRemoved.addListener(pageVisibility);
      chrome.bookmarks.onMoved.addListener(pageVisibility);
    }

    // if there is auto-generation of thumbnails, and a tab with bookmarks is open, we need to reload, after saving the thumbnail
    if (localStorage.getItem('auto_generate_thumbnail') === 'true') {
      chrome.runtime.onMessage.addListener(
        function(request) {
          if (request.autoGenerateThumbnail) {
            window.location.reload();
          }
        });
    }
  }

  function popStateHandler() {
    // when navigating through the history
    // hide the context menu or the modal window if they are active
    ctxMenu.close();
    modalApi.close();
  }

  function beforeUnload(e) {
    // if generate thumbs exist
    if (localStorage.getItem('update_thumbnails') !== null && isGenerateThumbs)
      return e.returnValue = '';
  }

  function unload() {
    // remove flag from storage to unlock button generate
    if (isGenerateThumbs)
      localStorage.removeItem('update_thumbnails');
  }

  function storageUpdate(e) {
    // If several tabs are open, on the rest of them we will update the attribute at the button
    if (e.key === 'update_thumbnails') {
      generateThumbsBtn.disabled = !e.newValue ? false : true;
    }
  }

  function generateThumbs() {
    // method to start generating all bookmark thumbnails
    if (this.hasAttribute('disabled') || localStorage.getItem('update_thumbnails') !== null) return;
    Bookmarks.autoUpdateThumb();
  }

  function pageVisibility(id) {
    if (document.hidden) {
      const hash = location.hash.slice(1);

      if (hash && hash === id) {
        location.hash = '1';
      }
      window.location.reload();
    }
  }

  // TODO: experiment webcomponents
  function runServices() {
    import(/* webpackChunkName: "webcomponents/gservices" */'./components/g-services').then(() => {
      const el = document.createElement('g-services');
      el.classList.add('sticky');
      el.setAttribute('data-services', localStorage.google_services_list);
      document.body.append(el);

      // update storage after sorting
      el.addEventListener('sort', e => {
        localStorage.google_services_list = JSON.stringify(e.detail.services);
        Settings.syncSingleToStorage('google_services_list');
      });
    }).catch(err => {
      console.warn(err);
    });
  }

  function uploadScreen(evt) {
    evt.preventDefault();

    const el = evt.target;
    const data = el.dataset;
    Bookmarks.uploadScreen({
      target: el,
      id: data.id,
      site: data.site
    });
  }

  function ctxMenuOpen(evt) {
    const bookmark = evt.detail.trigger;
    // const props = JSON.parse(bookmark.dataset.props);
    const isFolder = bookmark.dataset.folder !== undefined;

    if (isFolder) {
      ctxToggleItems.forEach(item => {
        item.classList.remove('is-disabled');
        if (item.classList.contains('is-bookmark')) {
          item.classList.add('is-disabled');
        }
      });
    } else {
      ctxToggleItems.forEach(item => {
        item.classList.remove('is-disabled');
        if (item.classList.contains('is-folder')) {
          item.classList.add('is-disabled');
        }
      });
    }
  }

  async function controlsHandler(evt) {
    const target = evt.detail.trigger;
    const action = evt.detail.selection;
    const props = target.dataset;
    const isFolder = props.folder !== undefined;

    switch (action) {
      case 'new_window':
      case 'new_window_incognito':
        openWindow(target.href, action);
        break;
      case 'open_all':
      case 'open_all_window':
        openAll(props, action);
        break;
      case 'new_tab':
        openTab(target.href);
        break;
      case 'edit':
        modalBeforeOpen(props);
        modalApi.open();
        break;
      case 'copy_link':
        Helpers.copyStr(target.href);
        break;
      case 'capture': {
        const idBookmark = target.getAttribute('data-id');
        const captureUrl = target.href;
        Bookmarks.createScreen(target, idBookmark, captureUrl);
        break;
      }
      case 'upload': {
        upload.dataset.id = props.id;
        if (!isFolder) {
          upload.dataset.site = Helpers.getDomain(target.href);
        }
        upload.click();
        break;
      }
      case 'remove': {
        (isFolder)
          ? Bookmarks.removeFolder(target)
          : Bookmarks.removeBookmark(target);
        break;
      }
    }
  }

  function openAll(props, action) {
    getChildren(props.id)
      .then(childrens => {
        if (action === 'open_all_window') {
          chrome.windows.create({
            focused: true
          }, win => {
            childrens.forEach(children => openTab(children.url, { windowId: win.id }));
          });
        } else {
          childrens.forEach(children => openTab(children.url));
        }
      });
  }

  function openWindow(url, action) {
    try {
      chrome.windows.create({
        url: url,
        state: 'maximized',
        incognito: (action === 'new_window_incognito') ? true : false
      });
    } catch (e) {}
  }

  function openTab(url, options = {}) {
    const defaults = {
      url: url,
      active: false
    };
    try {
      chrome.tabs.create({
        ...defaults,
        ...options
      });
    } catch (e) {}
  }

  function delegateClick(evt) {
    if (evt.target.closest('#add')) {
      evt.preventDefault();
      modalBeforeOpen();
      modalApi.open();
    } else if (evt.target.closest('.bookmark__action')) {
      evt.preventDefault();
      evt.stopPropagation();
      ctxMenu.handlerTrigger(evt);
    }
  }

  function submitForm(evt) {
    evt.preventDefault();
    const id = this.getAttribute('data-action');
    const title = document.getElementById('title').value;
    const url = document.getElementById('url').value;
    let success = false;
    if (id !== 'New') {
      const newLocation = foldersList.value;
      success = Bookmarks.updateBookmark(id, title, url, newLocation);
    } else {
      success = Bookmarks.createBookmark(title, url);
    }
    success && modalApi.close();
  }

  function resetThumb(evt) {
    evt.preventDefault();
    if (!confirm(chrome.i18n.getMessage('confirm_delete_image'))) return;

    const target = evt.target;
    const id = target.getAttribute('data-bookmark');

    Bookmarks.rmCustomScreen(id, function() {
      const bookmark = container.querySelector(`[data-id="${id}"]`);
      const bookmarkImg = bookmark.querySelector('.bookmark__img');
      // if folder: selector exists if folder_preview option is off
      // update view only if folder_preview option is off
      bookmarkImg && bookmarkImg.classList.remove('bookmark__img--contain');

      if (bookmark.dataset.folder !== undefined) {
        // update view only if folder_preview option is off
        if (bookmarkImg) {
          bookmarkImg.style.backgroundImage = '';
          bookmarkImg.classList.add('bookmark__img--folder');
        }
      } else {
        // const bookmark = await get(props.id);
        const url = localStorage.getItem('thumbnailing_service').replace('[URL]', Helpers.getDomain(bookmark.href));
        Helpers.imageLoaded(url, {
          done() {
            bookmarkImg.style.backgroundImage = `url(${url})`;
            bookmarkImg.classList.add('bookmark__img--external');
          },
          fail() {
            bookmarkImg.style.backgroundImage = 'url(/img/broken-image.svg)';
            bookmarkImg.classList.add('bookmark__img--broken');
          }
        });
      }

      bookmark.removeAttribute('data-screen');
      target.closest('#customScreen').style.display = '';
      // Helpers.notifications(chrome.i18n.getMessage('notice_image_removed'));
    });
  }

  async function modalBeforeOpen(props) {
    if (props) {
      modal.classList.add('has-edit');

      const bookmarkNode = await get(props.id).catch(err => console.warn(err));
      if (!bookmarkNode) return;

      const { id, url, parentId } = bookmarkNode[0];
      const title = Helpers.unescapeHtml(bookmarkNode[0].title);

      const screen = Bookmarks.getCustomDial(id);
      const { image } = screen || {};

      // generate bookmark folder list
      Bookmarks.generateFolderList(foldersList, parentId, id);

      if (image) {
        customScreen.style.display = 'block';
        customScreen.querySelector('img').src = `${image}?refresh=${Date.now()}`;
        customScreen.querySelector('#resetCustomImage').setAttribute('data-bookmark', id);
      }

      modalHead.textContent = chrome.i18n.getMessage('edit_bookmark');
      titleField.value = title;

      if (url) {
        urlWrap.style.display = '';
        urlField.value = url;
      } else {
        urlWrap.style.display = 'none';
      }
      form.setAttribute('data-action', id);
    } else {
      modal.classList.add('has-add');

      setTimeout(() => {
        titleField.focus();
      }, 200);

      modalHead.textContent = chrome.i18n.getMessage('add_bookmark');
      urlWrap.style.display = '';
      titleField.value = '';
      urlField.value = '';
      form.setAttribute('data-action', 'New');
    }
  }
  function modalAfterClose() {
    modal.classList.remove('has-edit', 'has-add');
    customScreen.style.display = '';
    form.reset();
  }

  return {
    init
  };

})();

// Set lang attr
// Replacement underscore on the dash because underscore is not a valid language subtag
document.documentElement.setAttribute('lang', chrome.i18n.getMessage('@@ui_locale').replace('_', '-'));

/**
 * Localization
 */
Localization();

/**
 * Ripple
 */
Ripple.init('.md-ripple');

/**
 * Settings
 */
Settings.init();

/**
 * UI
 */
UI.toggleTheme();
UI.calculateStyles();
UI.setBG();
UI.userStyles();
/**
 * Bookmarks
 */
Bookmarks.init();

NewTab.init();

window.addEventListener('resize', () => UI.calculateStyles());
