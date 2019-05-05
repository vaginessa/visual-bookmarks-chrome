import '../css/bookmark.css';
import Gmodal from 'glory-modal';
import Helpers from './components/helpers';
import Settings from './components/settings';
import Bookmarks from './components/bookmarks';
import Localization from './components/localization';
import UI from './components/ui';
import ContextMenu from './components/contextmenu';
import Ripple from './components/ripple';

const NewTab = (() => {
  const container = document.getElementById('bookmarks'),
    modal         = document.getElementById('modal'),
    form          = document.getElementById('formBookmark'),
    modalHead     = document.getElementById('modalHead'),
    foldersList   = document.getElementById('folderList'),
    titleField    = document.getElementById('title'),
    urlField      = document.getElementById('url'),
    urlWrap       = document.getElementById('urlWrap'),
    modalDesc     = document.getElementById('desc'),
    customScreen  = document.getElementById('customScreen'),
    ctxMenuEl     = document.getElementById('context-menu'),
    upload        = document.getElementById('upload'),
    ctxActionCapture = ctxMenuEl.querySelector('[data-action="capture"]'),
    ctxHiddenItems = [...document.querySelectorAll('.folder-hidden')];
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
      delegateSelector: '.bookmark'
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

    container.addEventListener('changeFolder', function(e) {
      if (!e.detail || !e.detail.id) return;
      Bookmarks.generateFolderList(foldersList);
    });
    container.addEventListener('updateFolderList', function(e) {
      if (e.detail && e.detail.isFolder) {
        Bookmarks.generateFolderList(foldersList);
      }
    });

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

    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('unload', unload);
    window.addEventListener('storage', storageUpdate);

    // if support Page Visibility API
    // if the tab is open but not active, then when you change bookmarks from other places,
    // we will do a reload of the bookmarks page to display the latest changes
    if ('hidden' in document) {
      chrome.bookmarks.onCreated.addListener(pageVisibility);
      chrome.bookmarks.onChanged.addListener(pageVisibility);
      chrome.bookmarks.onRemoved.addListener(pageVisibility);
      chrome.bookmarks.onMoved.addListener(pageVisibility);
    }
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
        // TODO: sync
        // Settings.syncSingleToStorage('google_services');
      });
    }).catch(err => {
      console.warn(err);
    });
  }

  function changeTitle(e) {
    const value = e.target.value.trim();
    const elem = document.getElementById('desc');
    elem.textContent = value;
  }

  function uploadScreen(evt) {
    evt.preventDefault();

    const el = evt.target;
    const data = evt.target.dataset;

    Bookmarks.uploadScreen({
      target: el,
      id: data.id,
      site: data.site
    });
  }

  function ctxMenuOpen(evt) {
    const bookmark = evt.detail.trigger;
    const props = JSON.parse(bookmark.dataset.props);

    if (props.isFolder) {
      ctxActionCapture.classList.add('is-disabled');
      ctxHiddenItems.forEach(item => {
        item.style.display = 'none';
        item.classList.add('is-disabled');
      });
    } else {
      ctxActionCapture.classList.remove('is-disabled');
      ctxHiddenItems.forEach(item => {
        item.style.display = '';
        item.classList.remove('is-disabled');
      });
    }

  }

  function controlsHandler(evt) {
    const target = evt.detail.trigger;
    const action = evt.detail.selection;
    const props = JSON.parse(target.dataset.props);

    switch (action) {
      case 'new_window':
      case 'new_window_incognito':
        openWindow(props, action);
        break;
      case 'new_tab':
        openTab(props);
        break;
      case 'edit':
        modalBeforeOpen(props);
        modalApi.open();
        break;
      case 'copy_link':
        copyLink(props);
        break;
      case 'capture': {
        const idBookmark = target.getAttribute('data-sort');
        const captureUrl = target.querySelector('.bookmark__link').href;
        Bookmarks.createScreen(target, idBookmark, captureUrl);
        break;
      }
      case 'upload': {
        upload.dataset.id = props.id;
        upload.dataset.site = (!props.isFolder) ? Helpers.getDomain(props.url) : '';
        upload.click();
        break;
      }
      case 'remove': {
        (props.isFolder)
          ? Bookmarks.removeFolder(target)
          : Bookmarks.removeBookmark(target);
        break;
      }
    }
  }

  function getUrl(props) {
    if (props.isFolder) {
      return chrome.runtime.getURL(`newtab.html#${props.id}`);
    }
    return props.url;
  }

  function openWindow(props, action) {
    const url = getUrl(props);
    try {
      chrome.windows.create({
        url: url,
        state: 'maximized',
        incognito: (action === 'new_window_incognito') ? true : false
      });
    } catch (e) {}
  }

  function openTab(props) {
    const url = getUrl(props);
    try {
      chrome.tabs.create({
        url: url,
        active: false
      });
    } catch (e) {}
  }

  function copyLink(props) {
    const url = getUrl(props);
    Helpers.copyStr(url);
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
    if (id !== 'New') {
      const newLocation = foldersList.value;
      if (Bookmarks.updateBookmark(id, title, url, newLocation)) {
        modalApi.close();
      }
    } else {
      if (Bookmarks.createBookmark(title, url)) {
        modalApi.close();
      }
    }

  }

  function resetThumb(evt) {
    evt.preventDefault();

    if (!confirm(chrome.i18n.getMessage('confirm_delete_image'))) return;

    const target = evt.target;
    const id = target.getAttribute('data-bookmark');

    Bookmarks.rmCustomScreen(id, function() {
      const bookmark = container.querySelector('[data-sort="' + id + '"]');
      const bookmarkImg = bookmark.querySelector('.bookmark__img');
      const props = JSON.parse(bookmark.dataset.props);
      bookmarkImg.classList.remove('bookmark__img--contain');

      if (!props.isFolder) {
        const url = localStorage.getItem('thumbnailing_service').replace('[URL]', Helpers.getDomain(props.url));
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
      } else {
        bookmarkImg.style.backgroundImage = '';
        bookmarkImg.classList.add('bookmark__img--folder');
      }

      props.screen = '';
      bookmark.dataset.props = JSON.stringify(props);

      target.closest('#customScreen').style.display = '';
      // Helpers.notifications(chrome.i18n.getMessage('notice_image_removed'));
    });
  }

  function modalBeforeOpen(props) {
    if (props) {
      modal.classList.add('has-edit');
      const title = Helpers.unescapeHtml(props.title);
      const url = props.url;
      const { image = props.screen } = props.screen || {};

      // if (screen && !url) {
      if (image) {
        customScreen.style.display = 'block';
        customScreen.querySelector('img').src = `${image}?refresh=${Date.now()}`;
        customScreen.querySelector('#resetCustomImage').setAttribute('data-bookmark', props.id);
      }

      modalHead.textContent = chrome.i18n.getMessage('edit_bookmark');
      modalDesc.textContent = title;
      titleField.value = title;

      if (url) {
        urlWrap.style.display = '';
        urlField.value = url;
      } else {
        urlWrap.style.display = 'none';
      }

      titleField.addEventListener('input', changeTitle);
      form.setAttribute('data-action', props.id);
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
    titleField.removeEventListener('input', changeTitle);
    customScreen.style.display = '';
    modalDesc.textContent = '';
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
/**
 * Bookmarks
 */
Bookmarks.init();

NewTab.init();

window.addEventListener('resize', () => UI.calculateStyles());
