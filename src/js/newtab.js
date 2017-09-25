import css from '../css/bookmark.css';

import './components/polyfill';
import Sortable from 'sortablejs';
import Settings from './components/settings';
import Localization from './components/localization';
import Ripple from './components/ripple';
import FS from './components/fs';
import Helpers from './components/helpers';


if (!localStorage.getItem('custom_dials')) {
  localStorage.setItem('custom_dials', '{}');
}

FS.init(500);
FS.usedAndRemaining(function(used) {
  if (used === 0) {
    localStorage.setItem('custom_dials', '{}');
    localStorage.setItem('background_local', '');
  }
});

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
 * Bookmarks module
 */
const Bookmarks = (() => {
  const bk = chrome.bookmarks;
  const SVGLoading = `
    <svg class="loading" viewBox= "0 0 100 100" xmlns= "http://www.w3.org/2000/svg" >
      <circle class="path" fill="none" stroke-width="8" stroke-linecap="round" cx="50" cy="50" r="40"></circle>
    </svg>
  `;

  const container = document.getElementById('includeThree');
  let sort = null;

  function init() {
    if (!container) return;

    // header show
    if (localStorage.getItem('show_toolbar') === 'false') {
      // document.getElementById('header').style.display = 'none';
      document.getElementById('main').classList.add('hidden-toolbar');
    } else {
      generateFolderList();
    }

    // Vertical center
    if (localStorage.getItem('vertical_center') === 'true') {
      document.getElementById('content').classList.add('flex-vertical-center');
    }

    // Create speeddial
    createSpeedDial(startFolder());

    container.addEventListener('change', function(evt) {
      if (!evt.target.closest('.c-upload__input')) return;

      evt.preventDefault();
      const id = evt.target.getAttribute('data-id');
      folderScreen(evt.target, id);
    });

    container.addEventListener('click', function(evt) {
      if (evt.target.matches('.bookmark__del--bookmark')) {
        removeBookmark(evt);
      }
      else if (evt.target.closest('.bookmark__del--folder')) {
        removeFolder(evt);
      }
      else if (evt.target.matches('.bookmark__edit')) {
        const bookmark = evt.target.closest('.bookmark');
        const title = bookmark.querySelector('.bookmark__title').textContent;
        let url   = bookmark.querySelector('.bookmark__link').getAttribute('href');
        if (url.charAt(0) === '#') {
          url = '';
        }
        const id = evt.target.getAttribute('data-id');
        const screen = getCustomDial(id);
        Modal.show(id, title, url, screen);
      }
      else if (evt.target.matches('.bookmark__screen')) {
        evt.preventDefault();
        const bookmark = evt.target.closest('.bookmark');
        const idBookmark = bookmark.getAttribute('data-sort');
        const captureUrl = bookmark.querySelector('.bookmark__link').href;

        createScreen(bookmark, idBookmark, captureUrl);
      }
      else if (evt.target.matches('#add')) {
        Modal.show('New', '', '');
      }
    }, false);

    document.getElementById('closeModal').addEventListener('click', function() {
      Modal.hide();
    }, false);

    document.body.addEventListener('keydown', function(evt) {
      if (evt.which === 27) {
        Helpers.trigger('click', document.getElementById('closeModal'));
      }
    }, false);

    document.getElementById('formBookmark').addEventListener('submit', function(evt) {
      evt.preventDefault();

      const id = this.getAttribute('data-action');
      const title = document.getElementById('title').value;
      const url = document.getElementById('url').value;
      if (id !== 'New') {
        if (updateBookmark(id, title, url)) {
          Modal.hide();
        }
      }
      else {
        if (createBookmark(title, url)) {
          Modal.hide();
        }
      }
    }, false);

    // Reset custom image
    document.getElementById('resetCustomImage').addEventListener('click', function(evt) {
      evt.preventDefault();
      // if (!confirm('Delete this image?')) return;
      if (!confirm( chrome.i18n.getMessage('confirm_delete_image') )) return;

      const target = evt.target;
      // const data = JSON.parse(target.getAttribute('data-bookmark'));
      const id = target.getAttribute('data-bookmark');
      rmCustomScreen(id, function() {
        const bookmark = container.querySelector('[data-sort="' + id + '"]');
        bookmark.querySelector('.bookmark__img').style.backgroundImage = '';
        bookmark.querySelector('.bookmark__img').classList.add('bookmark__img--folder');

        target.closest('#customScreen').style.display = '';
        // Helpers.notifications('This image has been removed');
        Helpers.notifications(chrome.i18n.getMessage('notice_image_removed') );
      });

    });

    // Search bookmarks
    const searchDebounce = Helpers.debounce(function(evt) {
      search(evt);
    }, 500);
    document.getElementById('bookmarkSearch').addEventListener('input', searchDebounce, false);

    // Change the current dial if the page hash changes
    window.addEventListener('hashchange', function(evt) {
      createSpeedDial(startFolder());
      generateFolderList();
    }, false);

    // Dragging option
    if (localStorage.getItem('drag_and_drop') === 'true') {
      sort = Sortable.create(container, {
        animation: 200,
        filter: '.bookmark__control',
        draggable: '.column',
        ghostClass: 'column--ghost',
        chosenClass: 'column--chosen',
        preventOnFilter: false,
        onUpdate: function() {
          Array.prototype.slice.call(container.querySelectorAll('.bookmark')).forEach(function(item, index) {
            bk.move(item.getAttribute('data-sort'), {
              'parentId': container.getAttribute('data-folder'),
              'index': index
            })
          })
        }
      });
    }

  }

  function startFolder() {
    let folderId = localStorage.getItem('default_folder_id');
    if (window.location.hash !== '') {
      folderId = window.location.hash.slice(1);
    }
    return folderId;
  }

  function generateFolderList() {
    const select = document.getElementById('selectFolder');
    select.innerHTML = '';
    select.removeEventListener('change', changeFolder, false);
    bk.getTree(function(rootNode) {
      let folderList = [], openList = [], node, child;
      // Never more than 2 root nodes, push both Bookmarks Bar & Other Bookmarks into array
      openList.push(rootNode[0].children[0]);
      openList.push(rootNode[0].children[1]);

      while ((node = openList.pop()) !== undefined) {
        if (node.children !== undefined) {
          if (node.parentId === '0') {
            node.path = ''; // Root elements have no parent so we shouldn't show their path
          }
          node.path += node.title;
          while ((child = node.children.pop()) !== undefined) {
            if (child.children !== undefined) {
              child.path = node.path + '/';
              openList.push(child);
            }
          }
          folderList.push(node);
        }
      }
      folderList.sort(function(a, b) {
        return a.path.localeCompare(b.path);
      });

      let arr = [];
      folderList.forEach(function(item) {
        arr.push(`<option${item.id === startFolder() ? ' selected' : ''} value="${item.id}">${item.path}</option>`);
      });
      select.innerHTML = arr.join('');

      select.addEventListener('change', changeFolder, false);
    });
  }

  function genBookmark(bookmark) {

    const hasFavicon = (localStorage.getItem('show_favicon') === 'true')
      ? '<img class="bookmark__favicon" width="16" height="16" src="chrome://favicon/{url}" alt="">'
      : '';

    const screen = getCustomDial(bookmark.id);
    const thumbContainer = (screen)
      ?
        `<div class="bookmark__img" style="background-image: url('${screen}');"></div>`
      :
        `<div class="bookmark__img bookmark__img--external" data-fail-thumb="/img/404.svg" data-external-thumb="{thumbnailing_service}"></div>`;

    const tpl =
      `<div class="column">
        <div class="bookmark" data-sort="{id}">
          ${thumbContainer}
          <div class="bookmark__control bookmark__control--left">
            <button class="bookmark__edit" data-bookmark="bookmark" data-title="{title}" data-url="{url}" data-id="{id}"></button>
            <div class="bookmark__divider"></div>
            <button class="bookmark__screen" data-id="{id}"></button>
          </div>
          <div class="bookmark__control bookmark__control--right">
            <button class="bookmark__del--bookmark" data-id="{id}"></button>
          </div>
          <div class="bookmark__caption">
            ${hasFavicon}
            <div class="bookmark__title">{title}</div>
          </div>
          <a class="bookmark__link" href="{url}" title="{title}"></a>
        </div>
      </div>`;

    return Helpers.templater(tpl, {
      id: bookmark.id,
      url: bookmark.url,
      // thumbnailing_service: localStorage.getItem('thumbnailing_service').replace('[URL]', encodeURIComponent(bookmark.url)),
      thumbnailing_service: localStorage.getItem('thumbnailing_service').replace('[URL]', Helpers.getDomain(bookmark.url)),
      title: bookmark.title,
    });
  }

  function genFolder(bookmark) {
    let imgLayout;
    const screen = getCustomDial(bookmark.id);

    if (screen) {
      imgLayout = `<div class="bookmark__img" style="background-image: url(${screen})"></div>`;
    } else {
      imgLayout = '<div class="bookmark__img bookmark__img--folder"></div>';
    }

    const tpl =
      `<div class="column">
        <div class="bookmark" data-sort="{id}">
          ${imgLayout}
          <div class="bookmark__control bookmark__control--left">
            <button class="bookmark__edit" data-bookmark="folder" data-title="{title}" data-id="{id}"></button>
            <div class="bookmark__divider"></div>
            <div class="bookmark__image-folder">
              <input type="file" name="" id="folderImage-{id}" class="c-upload__input" data-id="{id}">
              <label for="folderImage-{id}" class="c-upload__label"></label>
            </div>
          </div>
          <div class="bookmark__control bookmark__control--right">
            <button class="bookmark__del--folder" data-id="{id}"></button>
          </div>
          <div class="bookmark__caption">
            <img src="/img/folder.svg" class="bookmark__favicon" width="16" height="16" alt="">
            <div class="bookmark__title">{title}</div>
          </div>
          <a class="bookmark__link" href="#{url}" title="{title}"></a>
        </div>
      </div>`;
    return Helpers.templater(tpl, {
      id: bookmark.id,
      url: bookmark.id,
      title: bookmark.title,
    });
  }

  function render(_array) {
    let arr = [];

    // container.innerHTML = `<div class="dial-loading">${SVGLoading}</div>`;
    // let storage = JSON.parse(localStorage.getItem('custom_dials'));
    _array.forEach(function(bookmark) {
      if (bookmark.url !== undefined) {
        arr.push(genBookmark(bookmark));
      }
      if (bookmark.children !== undefined) {
        arr.push(genFolder(bookmark));
      }
    });
    // setTimeout(() => {
      container.innerHTML =
      `${arr.join('')}
        <div class="column--nosort">
          <div class="bookmark--create">
            <div class="bookmark__img--add"></div>
            <a class="bookmark__link--create" id="add"></a>
          </div>
        </div>`;

      // loaded external images
      const thumbs = container.querySelectorAll('.bookmark__img--external');
      for (let img of thumbs) {
        Helpers.imageLoaded(img.dataset.externalThumb, {
          done(data) {
            img.style.backgroundImage = `url(${data})`;
          },
          fail() {
            img.style.backgroundImage = `url(${img.dataset.failThumb})`;
          }
        });
      }

    // }, 20);
  }

  function getCustomDial(id) {
    const storage = JSON.parse(localStorage.getItem('custom_dials'));
    let image;
    if (storage) {
      image = storage[id];
    }
    return image;
  }

  function createSpeedDial(id) {
    bk.getSubTree(id, function(item) {
      if (item !== undefined) {
        render(item[0].children);
        container.setAttribute('data-folder', id);
      }
      else {
        Helpers.notifications(chrome.i18n.getMessage('notice_cant_find_id'), 15000);
      }
    })
  }

  function folderScreen(target, id) {
    const file = target.files[0];
    if (!file) return;

    if (! /image\/(jpe?g|png)$/.test(file.type)) {
      return alert(chrome.i18n.getMessage('alert_file_type_fail'));
    }
    target.value = '';

    const bookmark = target.closest('.bookmark');
    let overlay;
    bookmark.innerHTML += `<div id="overlay_id_${id}" class="bookmark__overlay">${SVGLoading}</div>`;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = function() {

      Helpers.resizeScreen(reader.result, function (image) {
        const blob = Helpers.base64ToBlob(image, 'image/jpg');
        const name = `folder-${id}.jpg`;

        FS.createDir('images', function (dirEntry) {
          FS.createFile(`/images/${name}`, { file: blob, fileType: 'jpg' }, function (fileEntry) {

            const obj = JSON.parse(localStorage.getItem('custom_dials'));
            obj[id] = fileEntry.toURL();
            localStorage.setItem('custom_dials', JSON.stringify(obj));

            const imgEl = bookmark.querySelector('.bookmark__img');
            imgEl.classList.remove('bookmark__img--folder');
            imgEl.style.backgroundImage = `url('${fileEntry.toURL()}?refresh=${Helpers.rand(1, 9999)}')`;

            if (overlay = document.getElementById('overlay_id_' + id)) {
              bookmark.removeChild(overlay);
            }
            Helpers.notifications(
              chrome.i18n.getMessage('notice_folder_image_updated')
            );

          });
        });

      });

    }

    reader.onerror = function() {
      console.warn('Image upload failed');
    }

  }

  function createScreen(bookmark, idBookmark, captureUrl) {

    let overlay;

    bookmark.innerHTML += `<div id="overlay_id_${idBookmark}" class="bookmark__overlay">${SVGLoading}</div>`;

    const image = bookmark.querySelector('.bookmark__img');

    chrome.runtime.sendMessage({ captureUrl: captureUrl, id: idBookmark }, (response) => {

      if (response.warning) {
        console.warn(response.warning)
        if (overlay = document.getElementById('overlay_id_' + idBookmark)) {
          bookmark.removeChild(overlay);
        }

        Helpers.imageLoaded(image.dataset.externalThumb, {
          done(data) {
            image.style.backgroundImage = `url(${data})`;
          },
          fail() {
            image.style.backgroundImage = `url(${image.dataset.failThumb})`;
          }
        })
        return false;
      }

      image.classList.remove('bookmark__img--external');
      image.style.backgroundImage = `url('${response}?refresh=${Helpers.rand(1, 9999)}')`;
      if (overlay = document.getElementById('overlay_id_' + idBookmark)) {
        bookmark.removeChild(overlay);
      }
    });
  }

  function search(evt) {
    const value = evt.target.value.trim().toLowerCase();
    let arr = [];
    bk.search(value, function(match) {
      if (match.length > 0) {
        if (localStorage.getItem('drag_and_drop') === 'true') {
          sort.option('disabled', true);
        }
        render(match);
      }
      else {
        if (localStorage.getItem('drag_and_drop') === 'true') {
          sort.option('disabled', false);
        }
        createSpeedDial(startFolder());
      }
    })
  }

  function changeFolder(evt) {
    const id = this.value;
    window.location.hash = '#' + id;
    createSpeedDial(id);
  }

  function removeBookmark(evt) {
    evt.preventDefault();
    const target = evt.target;
    const bookmark = target.closest('.column');
    if (confirm(chrome.i18n.getMessage('confirm_delete_bookmark'), '')) {
      const id = target.getAttribute('data-id');
      bk.remove(id, function() {
        container.removeChild(bookmark);
        rmCustomScreen(id);
        Helpers.notifications(
          chrome.i18n.getMessage('notice_bookmark_removed')
        );
      })
    }
  }

  function removeFolder(evt) {
    evt.preventDefault();
    const target = evt.target;
    const bookmark = target.closest('.column');
    if (confirm(chrome.i18n.getMessage('confirm_delete_folder'), '')) {
      const id = target.getAttribute('data-id');
      bk.removeTree(id, function () {
        container.removeChild(bookmark);
        rmCustomScreen(id);
        generateFolderList();
        Helpers.notifications(
          chrome.i18n.getMessage('notice_folder_removed')
        );
      });
    }
  }

  function rmCustomScreen(id, cb = function(){}) {
    const screen = getCustomDial(id);
    if (!screen) return;

    const name = screen.split('/').pop();
    FS.deleteFile(`/images/${name}`, function () {
      const storage = JSON.parse(localStorage.getItem('custom_dials'));
      delete storage[id];
      localStorage.setItem('custom_dials', JSON.stringify(storage));
      cb();
    });
  }

  function isValidUrl(url) {
    //The regex used in AngularJS to validate a URL + chrome internal pages & extension url & on-disk files
    const URL_REGEXP = /^(http|https|ftp|file|chrome|chrome-extension):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
    if (URL_REGEXP.test(url)) {
      return true;
    }
    return false;
  }

  function buildBookmarkHash(title, url) {
    if (title.length === 0) {
      return undefined;
    }
    // Chrome won't create bookmarks without HTTP
    if (!isValidUrl(url) && url.length !== 0) {
      url = "http://" + url;
    }

    return { "title": title, "url": url };
  }

  function createBookmark(title, url) {
    let hash = buildBookmarkHash(title, url);
    if (hash !== undefined) {
      hash.parentId = container.getAttribute('data-folder');
      bk.create(hash, function(result) {
        let html;
        if (result.url) {
          html = genBookmark(result);
        } else {
          html = genFolder(result);
        }
        container.querySelector('.column--nosort').insertAdjacentHTML('beforeBegin', html);
        const bookmark = container.querySelector('[data-sort="' + result.id + '"]');

        if (result.url) {
          if (localStorage.getItem('auto_generate_thumbnail') === 'true') {
            createScreen(bookmark, result.id, result.url);
          } else {
            const image = bookmark.querySelector('.bookmark__img');
            image.classList.add('bookmark__img--external');
            Helpers.imageLoaded(image.dataset.externalThumb, {
              done(data) {
                image.style.backgroundImage = `url(${data})`;
              },
              fail() {
                image.style.backgroundImage = image.dataset.failThumb;
              }
            })
          }
        }
      });
      return true;
    }
    alert(chrome.i18n.getMessage('alert_create_fail_bookmark'));
    return false;
  }

  function updateBookmark(id, title, url) {
    let hash = buildBookmarkHash(title, url);
    const bookmark = container.querySelector('[data-sort="' + id + '"]');
    const dataEdit = bookmark.querySelector('.bookmark__edit');
    //Actually make sure the URL being modified is valid instead of always
    //prepending http:// to it creating new valid+invalid bookmark
    if (url.length !== 0 && !isValidUrl(url)) {
      hash = undefined;
    }
    if (hash !== undefined) {
      bk.update(id, hash, function(result) {
        bookmark.querySelector('.bookmark__link').href = (result.url) ? result.url : '#' + result.id;
        bookmark.querySelector('.bookmark__title').textContent = result.title;
        bookmark.querySelector('.bookmark__link').title = result.title;
        Helpers.notifications(chrome.i18n.getMessage('notice_bookmark_updated'));
      });
      return true;
    }
    alert(chrome.i18n.getMessage('alert_update_fail_bookmark') )
    return false;
  }

  return {
    init: init
  };

})();

const Modal = (() => {
  const overlay = document.getElementById('modal-overlay'),
      modal = document.getElementById('modal'),
      form = document.getElementById('formBookmark'),
      modalHead = document.getElementById('modalHead'),
      titleField = document.getElementById('title'),
      urlField = document.getElementById('url'),
      customScreen = document.getElementById('customScreen'),
      main = document.getElementById('main'),
      body = document.body;
  let isActive = null,
      pageY;

  return {
    show(action, title, url, screen) {
      if (isActive) return;

      // if action not New show modal edit
      if (action !== 'New') {

        if (screen && !url) {
          customScreen.style.display = 'block';
          customScreen.querySelector('img').src = `${screen}?refresh=${Helpers.rand(1, 9999)}`;
          customScreen.querySelector('#resetCustomImage').setAttribute('data-bookmark', action);
        }

        // modalHead.innerHTML = `Edit bookmark - <span>${title}</span>`;
        modalHead.innerHTML = `${chrome.i18n.getMessage('edit_bookmark')} - <span>${title}</span>`;
        titleField.value = title;

        if (url) {
          urlField.style.display = '';
          urlField.value = url;
        }
        else {
          urlField.style.display = 'none';
        }
      }
      else {
        setTimeout(() => {
          titleField.focus();
        }, 100);
        // modalHead.textContent = 'Add bookmark';
        modalHead.textContent = chrome.i18n.getMessage('add_bookmark');
        urlField.style.display = '';
        titleField.value = '';
        urlField.value = '';
      }
      form.setAttribute('data-action', action);
      pageY = window.pageYOffset;
      main.style.top = `${-pageY}px`;
      main.classList.add('fixed');
      body.classList.add('modal--show');
      isActive = true;
    },
    hide() {
      if (!isActive) return;

      body.classList.remove('modal--show');
      setTimeout(() => {
        main.classList.remove('fixed');
        main.style.top = '';
        window.scrollTo(0, pageY);
        pageY = null;
        customScreen.style.display = '';
        form.reset();
      }, 250);

      isActive = null;
    }
  };
})();

const UI = (() => {
  return {
    setBG() {
      const bgEl = document.getElementById('bg');
      const bgState = localStorage.getItem('background_image');

      if (bgState === 'background_color') {
        bgEl.style.backgroundColor = localStorage.getItem('background_color');
        setTimeout(() => {
          bgEl.style.opacity = 1;
        }, 20);
        return;
      }

      const resource = (bgState === 'background_local')
        ? localStorage.getItem('background_local')
        : localStorage.getItem('background_external');

      if (resource && resource !== '') {
        Helpers.imageLoaded(resource, {
          done(data) {
            bgEl.style.backgroundImage = `url('${data}')`;
            bgEl.style.opacity = 1;
          },
          fail() {
            console.warn(`Local background image resource problem: ${e.type}`);
            bgEl.style.opacity = 1;
          }
        });
      }
    },
    calculateStyles(e) {
      // if (window.innerWidth < 768) { return (document.getElementById('generateStyles').innerHTML = ''); }

      const columns = parseInt(localStorage.getItem('dial_columns'));
      const styles = document.getElementById('generateStyles');
      const ratio = 4 / 3;

      if (columns >= 8 && window.innerWidth < 1170) {
        console.log(columns)
        const colWidth = Math.floor(1170  / columns);
        const colHeight = colWidth / ratio;
        styles.innerHTML = `.bookmarks {justify-content: center} .column, .column--nosort {width: ${colWidth}px; height: ${colHeight}px}`;
        return;
      }

      if (window.innerWidth < 768) return;

      const container = Math.floor(document.getElementById('includeThree').offsetWidth);
      const colWidth = Math.floor(container / columns);
      const colHeight = colWidth / ratio;
      styles.innerHTML = `.column, .column--nosort {width: ${colWidth}px; height: ${colHeight}px}`;
    }
  }
})();

UI.calculateStyles();
Bookmarks.init();

window.addEventListener('load', () => UI.setBG(),);
window.addEventListener('resize', e => UI.calculateStyles(e));
