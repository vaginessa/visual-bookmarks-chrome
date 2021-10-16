import '../css/newtab.css';
import Gmodal from 'glory-modal';
import Validator from 'form-validation-plugin';
import Settings from './settings';
import Bookmarks from './components/bookmarks';
import Localization from './plugins/localization';
import UI from './components/ui';
import ContextMenu from './components/contextmenu';
import Ripple from './components/ripple';
import confirmPopup from './plugins/confirmPopup.js';
import {
  get,
  getChildren
} from './api/bookmark';
import {
  $getDomain,
  $createElement,
  $copyStr,
  $unescapeHtml
} from './utils';

const container = document.getElementById('bookmarks');
const modal = document.getElementById('modal');
const form = document.getElementById('formBookmark');
const modalHead = document.getElementById('modalHead');
const foldersList = document.getElementById('folderList');
const titleField = document.getElementById('title');
const urlField = document.getElementById('url');
const urlWrap = document.getElementById('urlWrap');
const customScreen = document.getElementById('customScreen');
const ctxMenuEl = document.getElementById('context-menu');
const upload = document.getElementById('upload');
let isGenerateThumbs = false;
let modalApi;
let ctxMenuInstance;
let generateThumbsBtn = null;


async function init() {
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
  UI.userStyles();
  UI.calculateStyles();
  UI.setBG();

  Bookmarks.init();

  modalApi = new Gmodal(modal, {
    stickySelectors: ['.sticky'],
    closeBackdrop: false
  });
  ctxMenuInstance = new ContextMenu(ctxMenuEl, {
    delegateSelector: '.bookmark',
    scrollContainer: '.app'
  });

  const formBookmarkEl = document.getElementById('formBookmark');

  Validator.i18n = {
    required: chrome.i18n.getMessage('error_input_required'),
    url: chrome.i18n.getMessage('error_input_url')
  };

  Validator.run(formBookmarkEl, {
    showErrors: true,
    checkChange: true,
    checkInput: true,
    containerSelector: '.group',
    errorClass: 'has-error',
    errorHintClass: 'error-hint',
    onSuccess: handleSubmitForm,
    onError: handleFormError
  });

  (localStorage.getItem('services_enable') === 'true') && runServices();

  upload.addEventListener('change', handleUploadScreen);
  container.addEventListener('click', handleDelegateClick);
  ctxMenuEl.addEventListener('contextMenuSelection', handleMenuSelection);
  ctxMenuEl.addEventListener('contextMenuOpen', handleMenuOpen);
  document.getElementById('resetCustomImage').addEventListener('click', handleResetThumb);
  modal.addEventListener('gmodal:close', handleCloseModal);

  const folderOptions = await Bookmarks.generateFolderList(foldersList);
  foldersList.innerHTML = folderOptions.join('');

  // If thumbnail generation button
  if (localStorage.getItem('thumbnails_update_button') === 'true') {
    generateThumbsBtn = $createElement('button', {
      class: 'circ-btn update-thumbnails'
    }, {
      innerHTML: `<svg width="20" height="20"><use xlink:href="/img/symbol.svg#capture_fill"/></svg>`
    });
    document.getElementById('aside_controls').appendChild(generateThumbsBtn);

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
    generateThumbsBtn.addEventListener('click', handleGenerateThumbs);
  }

  window.addEventListener('resize', () => UI.calculateStyles());
  window.addEventListener('popstate', handlePopstate);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('unload', handleUnload);
  window.addEventListener('storage', handleUpdateStorage);

  // if support Page Visibility API
  // if the tab is open but not active, then when you change bookmarks from other places,
  // we will do a reload of the bookmarks page to display the latest changes
  if ('hidden' in document) {
    if (localStorage.getItem('auto_generate_thumbnail') !== 'true') {
      chrome.bookmarks.onCreated.addListener(handlePageVisibility);
    }
    chrome.bookmarks.onChanged.addListener(handlePageVisibility);
    chrome.bookmarks.onRemoved.addListener(handlePageVisibility);
    chrome.bookmarks.onMoved.addListener(handlePageVisibility);
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

function handlePopstate() {
  // when navigating through the history
  // hide the context menu or the modal window if they are active
  ctxMenuInstance.close();
  modalApi.close();
}

function handleBeforeUnload(evt) {
  // if generate thumbs exist
  if (localStorage.getItem('update_thumbnails') !== null && isGenerateThumbs)
    return evt.returnValue = '';
}

function handleUnload() {
  // remove flag from storage to unlock button generate
  if (isGenerateThumbs)
    localStorage.removeItem('update_thumbnails');
}

function handleUpdateStorage(e) {
  // If several tabs are open, on the rest of them we will update the attribute at the button
  if (e.key === 'update_thumbnails') {
    generateThumbsBtn.disabled = !!e.newValue;
  }
}

function handleGenerateThumbs() {
  // method to start generating all bookmark thumbnails
  if (this.hasAttribute('disabled') || localStorage.getItem('update_thumbnails') !== null) return;
  Bookmarks.autoUpdateThumb();
}

function handlePageVisibility(id) {
  if (document.hidden) {
    const hash = location.hash.slice(1);

    if (hash && hash === id) {
      location.hash = '1';
    }
    window.location.reload();
  }
}

function handleDelegateClick(evt) {
  if (evt.target.closest('#add')) {
    evt.preventDefault();
    prepareModal();
    modalApi.open();
  } else if (evt.target.closest('.bookmark__action')) {
    evt.preventDefault();
    evt.stopPropagation();
    ctxMenuInstance.handlerTrigger(evt);
  } else if (evt.target.closest('.bookmark')) {
    const url = evt.target.closest('.bookmark').href;

    if (url.startsWith('file:///')) {
      evt.preventDefault();
      chrome.tabs.update({
        url
      });
    }
  }
}

function handleUploadScreen(evt) {
  evt.preventDefault();

  const el = evt.target;
  const data = el.dataset;
  Bookmarks.uploadScreen({
    target: el,
    id: data.id,
    site: data.site
  });
}

function handleMenuOpen(evt) {
  const bookmark = evt.detail.trigger;
  const menuItems = Array.from(ctxMenuEl.querySelectorAll('[data-action]'));

  if (bookmark.isFolder) {
    menuItems.forEach(item => {
      item.classList.toggle('is-disabled', item.classList.contains('is-bookmark'));
    });
  } else {
    menuItems.forEach(item => {
      item.classList.toggle('is-disabled', item.classList.contains('is-folder'));
    });
  }
}

async function handleMenuSelection(evt) {
  const target = evt.detail.trigger;
  const action = evt.detail.selection;

  switch (action) {
    case 'new_window':
    case 'new_window_incognito':
      openWindow(target.href, action);
      break;
    case 'open_all':
    case 'open_all_window':
      openAll(target.id, action);
      break;
    case 'new_tab':
      openTab(target.href);
      break;
    case 'edit':
      prepareModal(target);
      modalApi.open();
      break;
    case 'copy_link':
      $copyStr(target.href);
      break;
    case 'capture': {
      const idBookmark = target.id;
      const captureUrl = target.href;
      Bookmarks.createScreen(target, idBookmark, captureUrl);
      break;
    }
    case 'upload': {
      upload.dataset.id = target.id;
      if (!target.isFolder) {
        upload.dataset.site = $getDomain(target.href);
      }
      upload.click();
      break;
    }
    case 'remove': {
      (target.isFolder)
        ? Bookmarks.removeFolder(target)
        : Bookmarks.removeBookmark(target);
      break;
    }
  }
}

function handleCloseModal() {
  modal.classList.remove('has-edit', 'has-add');
  customScreen.style.display = '';
  form.reset();
}

// TODO: experiment webcomponents
function runServices() {
  import(/* webpackChunkName: "webcomponents/vb-services" */'./components/vb-services').then(() => {
    const el = document.createElement('vb-services');
    el.classList.add('sticky');
    el.servicesList = JSON.parse(localStorage.services_list);
    document.body.append(el);

    // update storage after sorting
    el.addEventListener('update', e => {
      localStorage.services_list = JSON.stringify(e.detail.services);
      Settings.syncSingleToStorage('services_list');
    });
  }).catch(err => {
    console.warn(err);
  });
}

/**
 * Open all bookmarks from a folder
 * @param {string} id - folder id
 * @param {string} action - action to run
 */
function openAll(id, action) {
  getChildren(id)
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

/**
 * Open a bookmark in a new window
 * @param {string} url - bookmark URL
 * @param {string} action - action to run
 */
function openWindow(url, action) {
  try {
    chrome.windows.create({
      url: url,
      state: 'maximized',
      incognito: (action === 'new_window_incognito')
    });
  } catch (e) {}
}

/**
 * Open a bookmark in a new tab
 * @param {string} url - bookmark URL
 * @param {object} [options={}] - options for creating a tab
 * @param {boolean} [options.active]
 * @param {number} [options.index]
 * @param {number} [options.openerTabId]
 * @param {boolean} [options.pinned]
 * @param {string} [options.url]
 * @param {number} [options.windowId]
 */
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

function handleSubmitForm(evt) {
  evt.preventDefault();
  const form = evt.target;
  const id = form.getAttribute('data-action');
  const title = form.title.value;
  const url = form.url.value;

  let success = false;
  if (id !== 'New') {
    const newLocation = foldersList.value;
    success = Bookmarks.updateBookmark(id, title, url, newLocation);
  } else {
    success = Bookmarks.createBookmark(title, url);
  }
  success && modalApi.close();
}

/**
 * Form submit error handler
 * Set focus to the first field in the array of invalid fields
 * @param {Array<{el: HTMLElement, errors: [string]}>} err
 */
function handleFormError(err) {
  return err[0]?.el?.focus();
}

async function handleResetThumb(evt) {
  if (localStorage.getItem('without_confirmation') === 'false') {
    const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_delete_image'));
    if (!confirmAction) return;
  }

  evt.preventDefault();
  const id = this.getAttribute('data-bookmark');

  Bookmarks.rmCustomScreen(id, () => {
    const bookmark = document.getElementById(id);
    bookmark.image = null;
    this.closest('#customScreen').style.display = '';
  });
}

async function prepareModal(target) {
  if (target) {
    modal.classList.add('has-edit');

    const bookmarkNode = await get(target.id).catch(err => console.warn(err));
    if (!bookmarkNode) return;

    const { id, url, parentId } = bookmarkNode[0];
    const title = $unescapeHtml(bookmarkNode[0].title);

    const screen = Bookmarks.getCustomDial(id);
    const { image } = screen || {};

    // generate bookmark folder list
    const folderOptions = await Bookmarks.generateFolderList(parentId, id);
    foldersList.innerHTML = folderOptions.join('');

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

init();
