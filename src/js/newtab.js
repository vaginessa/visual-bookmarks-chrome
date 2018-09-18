import '../css/bookmark.css';

// import Ripple from '@k-ivan/md-ripple';

import './components/polyfill';
import Helpers from './components/helpers';
import Settings from './components/settings';
import Bookmarks from './components/bookmarks';
import Localization from './components/localization';
import UI from './components/ui';
import Modal from './components/modal';
import Ripple from './components/ripple';

const NewTab = (() => {

  const container = document.getElementById('includeThree'),
    modal         = document.getElementById('modal'),
    form          = document.getElementById('formBookmark'),
    modalHead     = document.getElementById('modalHead'),
    foldersList   = document.getElementById('folderList'),
    titleField    = document.getElementById('title'),
    urlField      = document.getElementById('url'),
    urlWrap       = document.getElementById('urlWrap'),
    modalDesc     = document.getElementById('desc'),
    customScreen  = document.getElementById('customScreen');
  let modalApi;

  function init() {
    modalApi = new Modal(modal);

    container.addEventListener('change', uploadScreen);
    container.addEventListener('click', controlsHandler);
    document.getElementById('formBookmark').addEventListener('submit', submitForm);
    document.getElementById('resetCustomImage').addEventListener('click', resetThumb);

    modal.addEventListener('modal.show', show);
    modal.addEventListener('modal.hide', hide);

    Array.prototype.forEach.call(document.querySelectorAll('.js-close-modal'), el => {
      el.addEventListener('click', function() {
        modalApi.hide();
      });
    });

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

  function pageVisibility(id) {
    if (document.hidden) {
      const hash = location.hash.slice(1);

      if (hash && hash === id) {
        location.hash = '1';
      }
      window.location.reload();
    }
  }

  function changeTitle(e) {
    const value = e.target.value.trim();
    const elem = document.getElementById('desc');
    elem.textContent = value;
  }

  function uploadScreen(evt) {
    if (!evt.target.closest('.c-upload__input')) return;

    evt.preventDefault();

    let data = JSON.parse(evt.target.getAttribute('data-id'));
    data.target = evt.target;

    Bookmarks.uploadScreen(data);
  }

  function controlsHandler(evt) {
    if (evt.target.matches('.bookmark__del--bookmark')) {
      Bookmarks.removeBookmark(evt);
    } else if (evt.target.closest('.bookmark__del--folder')) {
      Bookmarks.removeFolder(evt);
    } else if (evt.target.closest('.bookmark__edit')) {
      modalApi.show(evt.target.closest('.bookmark__edit'));
    } else if (evt.target.matches('.bookmark__screen')) {
      evt.preventDefault();
      const bookmark = evt.target.closest('.bookmark');
      const idBookmark = bookmark.getAttribute('data-sort');
      const captureUrl = bookmark.querySelector('.bookmark__link').href;

      Bookmarks.createScreen(bookmark, idBookmark, captureUrl);
    } else if (evt.target.matches('#add')) {
      modalApi.show(evt.target);
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
        modalApi.hide();
      }
    } else {
      if (Bookmarks.createBookmark(title, url)) {
        modalApi.hide();
      }
    }

  }

  function resetThumb(evt) {
    evt.preventDefault();

    if (!confirm(chrome.i18n.getMessage('confirm_delete_image'))) return;

    const target = evt.target;
    // const data = JSON.parse(target.getAttribute('data-bookmark'));
    const id = target.getAttribute('data-bookmark');
    Bookmarks.rmCustomScreen(id, function() {
      const bookmark = container.querySelector('[data-sort="' + id + '"]');
      bookmark.querySelector('.bookmark__img').style.backgroundImage = '';
      bookmark.querySelector('.bookmark__img').classList.remove('bookmark__img--contain');
      bookmark.querySelector('.bookmark__img').classList.add('bookmark__img--folder');
      bookmark.querySelector('.bookmark__edit').removeAttribute('data-screen');

      target.closest('#customScreen').style.display = '';
      Helpers.notifications(chrome.i18n.getMessage('notice_image_removed'));
    });
  }

  function show(e) {
    if (e.detail.target) {

      const target = e.detail.target;
      const action = target.dataset.id || 'New';

      if (action !== 'New') {
        modal.classList.add('modal--edit');

        const title = Helpers.escapeHtml(target.dataset.title);
        const url = target.dataset.url;
        const screen = target.dataset.screen;

        if (screen && !url) {
          customScreen.style.display = 'block';
          customScreen.querySelector('img').src = `${screen}?refresh=${Date.now()}`;
          customScreen.querySelector('#resetCustomImage').setAttribute('data-bookmark', action);
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
      } else {
        modal.classList.add('modal--add');

        setTimeout(() => {
          titleField.focus();
        }, 150);

        modalHead.textContent = chrome.i18n.getMessage('add_bookmark');
        urlWrap.style.display = '';
        titleField.value = '';
        urlField.value = '';
      }
      form.setAttribute('data-action', action);
    }
  }
  function hide() {
    modal.classList.remove('modal--edit', 'modal--add');
    titleField.removeEventListener('input', changeTitle);
    customScreen.style.display = '';
    modalDesc.textContent = '';
    form.reset();
  }

  return {
    init
  };

})();

function networkStatus(evt) {
  if (evt.type === 'online') {
    location.reload();
    Helpers.notifications(chrome.i18n.getMessage('notice_online'), 'idConnection');
  } else {
    Helpers.notifications(chrome.i18n.getMessage('notice_offline'), 'idConnection');
  }
}


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
UI.calculateStyles();
UI.setBG();
/**
 * Bookmarks
 */
Bookmarks.init();

NewTab.init();

window.addEventListener('resize', () => UI.calculateStyles());
window.addEventListener('online', networkStatus);
window.addEventListener('offline', networkStatus);
window.addEventListener('load', () => {
  if (!navigator.onLine) Helpers.trigger('offline', window);
});
