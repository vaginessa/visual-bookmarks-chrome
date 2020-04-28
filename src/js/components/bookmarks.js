// import '../img/broken-image.svg';
import Sortable from 'sortablejs';
import Toast from './toast';
import FS from '../api/fs';
import {
  getFolders,
  move,
  getSubTree,
  search as searchBookmarks,
  remove,
  removeTree,
  create,
  update
} from '../api/bookmark';
import {
  $debounce,
  $customTrigger,
  $templater,
  $getDomain,
  $escapeHtml,
  $shuffle,
  $imageLoaded,
  $createElement,
  $notifications,
  $resizeScreen,
  $base64ToBlob,
  $isValidUrl
} from './helpers';

/**
 * Bookmarks module
 */
const Bookmarks = (() => {
  const container = document.getElementById('bookmarks');
  const SVGLoading =
    `<svg class="loading" id="loading" viewBox="0 0 100 100">` +
      `<defs>` +
        `<linearGradient id="%id%">` +
          `<stop offset="5%" stop-color="#4285f4"></stop>` +
          `<stop offset="95%" stop-color="#b96bd6"></stop>` +
        `</linearGradient>` +
      `</defs>` +
      `<circle class="path" fill="none" stroke="url(#%id%)" stroke-width="8" stroke-linecap="round" cx="50" cy="50" r="40"></circle>` +
    `</svg>`;
  let sort = null;
  let isGeneratedThumbs = false;

  async function init() {
    if (!container) return;

    if (!localStorage.getItem('custom_dials')) {
      localStorage.setItem('custom_dials', '{}');
    }

    await FS.init(500);
    const used = await FS.usedAndRemaining();
    // if fileSystem is empty, reset LS settings
    if (used === 0) {
      localStorage.setItem('custom_dials', '{}');
      localStorage.setItem('background_local', '');
    }

    // Vertical center
    if (localStorage.getItem('vertical_center') === 'true') {
      container.classList.add('grid--vcenter');
    }

    // Hide the settings icon if setting_icon disable
    if (localStorage.getItem('show_settings_icon') === 'false') {
      const icon = document.getElementById('settings_icon');
      icon.parentNode.removeChild(icon);
    }

    // Dragging option
    if (localStorage.getItem('drag_and_drop') === 'true') {
      sort = Sortable.create(container, {
        animation: 200,
        filter: '.bookmark__action',
        draggable: '.bookmark',
        ghostClass: 'bookmark--ghost',
        chosenClass: 'bookmark--chosen',
        preventOnFilter: false,
        onMove(evt) {
          // do not sort create column
          if (evt.related.classList.contains('bookmark--nosort')) {
            return false;
          }
        },
        onUpdate() {
          Array.from(container.querySelectorAll('.bookmark')).forEach(async(item, index) => {
            await move(item.getAttribute('data-id'), {
              'parentId': container.getAttribute('data-folder'),
              'index': index
            }).catch(err => console.warn(err));
          });
        }
      });
    }

    // Search bookmarks if toolbar enable
    if (localStorage.getItem('show_toolbar') === 'true') {
      await import(/* webpackChunkName: "webcomponents/vb-header" */'./vb-header');
      const vbHeader = document.createElement('vb-header');
      const folderList = await generateFolderList();
      vbHeader.setAttribute('placeholder', chrome.i18n.getMessage('placeholder_input_search'));
      vbHeader.setAttribute('folder', localStorage.getItem('default_folder_id'));
      document.querySelector('header').appendChild(vbHeader);
      vbHeader.folders = folderList;

      const searchHandler = $debounce(({ detail }) => {
        search(detail.search);
      }, 500);
      const searchResetHandler = () => {
        createSpeedDial(startFolder());
        if (localStorage.getItem('drag_and_drop') === 'true') {
          sort.option('disabled', false);
        }
      };

      vbHeader.addEventListener('vb:search', searchHandler);
      vbHeader.addEventListener('vb:searchreset', searchResetHandler);
    }

    // Create speeddial
    createSpeedDial(startFolder());

    // Change the current dial if the page hash changes
    window.addEventListener('hashchange', function() {
      const folderId = startFolder();
      createSpeedDial(folderId);
      $customTrigger('changeFolder', container, {
        detail: { folderId },
        bubbles: true
      });
    }, false);

    container.addEventListener('updateFolderList', async function(e) {
      const vbHeader = document.querySelector('vb-header');
      if (e.detail?.isFolder && vbHeader) {
        vbHeader.folders = await generateFolderList();
      }
    });
  }

  function startFolder() {
    let folderId = localStorage.getItem('default_folder_id');
    if (window.location.hash !== '') {
      folderId = window.location.hash.slice(1);
    }
    return folderId;
  }

  async function generateFolderList(activeFolder = null, itemId = null) {
    const folders = await getFolders().catch(err => console.warn(err));
    if (!folders) return;

    const folderId = activeFolder ? activeFolder : startFolder();
    const optionsArr = [];
    const processTree = (three, pass = 0) => {
      for (let folder of three) {
        if (itemId !== folder.id && folder.parentId !== itemId) {
          let prefix = '-'.repeat(pass);
          if (pass > 0) {
            prefix = `&nbsp;&nbsp;${prefix}` + '&nbsp;';
          }

          const name = `${prefix} ${folder.title}`;
          optionsArr.push(`<option${folder.id === folderId ? ' selected' : ''} value="${folder.id}">${name}</option>`);
          if (folder.children.length) {
            processTree(folder.children, pass + 1);
          }
        }
      }
    };
    processTree(folders);
    return Promise.resolve(optionsArr);
  }

  function genBookmark(bookmark) {

    const hasFavicon = (localStorage.getItem('show_favicon') === 'true')
      ? `<img class="bookmark__favicon" width="16" height="16" src="chrome://favicon/%url%" alt="">`
      : ``;

    const screen = getCustomDial(bookmark.id);
    // key screen destructuring
    // the old key does not contain nested properties(image, custom), so we assign the key value to the variable image
    // the key may be undefined,in this case we are trying to work with an empty object
    const { image = screen, custom = false } = screen || {};
    const thumbContainer = (image)
      ?
      `<div class="bookmark__img${custom ? ' bookmark__img--contain' : ''}" style="background-image: url('${image}');"></div>`
      :
      `<div class="bookmark__img bookmark__img--external"
        data-fail-thumb="/img/broken-image.svg"
        data-external-thumb="%thumbnailing_service%">
      </div>`;

    const tpl =
      `<a class="bookmark"
        data-id="%id%"
        href="%url%" title="%title%"
        ${(localStorage.getItem('open_link_newtab') === 'true') ? `target="_blank" rel="noopener noreferrer"` : ``}>
        <div class="bookmark__wrap">
          <button class="bookmark__action"></button>
          ${thumbContainer}
          <div class="bookmark__caption">
            ${hasFavicon}
            <span class="bookmark__title">%title%</span>
          </div>
        </div>
        </a>`;

    return $templater(tpl, {
      id: bookmark.id,
      url: bookmark.url,
      site: $getDomain(bookmark.url),
      // localStorage.getItem('thumbnailing_service').replace('[URL]', encodeURIComponent(bookmark.url)),
      thumbnailing_service: localStorage.getItem('thumbnailing_service').replace('[URL]', $getDomain(bookmark.url)),
      title: $escapeHtml(bookmark.title)
    });
  }

  function genFolder(bookmark) {
    let imgLayout;
    const screen = getCustomDial(bookmark.id);

    if (localStorage.getItem('folder_preview') === 'true') {
      const folderChildren = renderFolderChildren(bookmark);
      imgLayout = folderChildren ? folderChildren : `<div class="bookmark__img bookmark__img--folder"></div>`;
    } else {
      // key screen destructuring
      // the old key does not contain nested properties(image, custom), so we assign the key value to the variable image
      // the key may be undefined,in this case we are trying to work with an empty object
      const { image = screen } = screen || {};

      if (image) {
        imgLayout = `<div class="bookmark__img bookmark__img--contain" style="background-image: url(${image})"></div>`;
      } else {
        imgLayout = `<div class="bookmark__img bookmark__img--folder"></div>`;
      }
    }

    const tpl =
    `<a class="bookmark"
      data-id="%id%"
      href="#%url%" title="%title%"
      data-folder>
      <div class="bookmark__wrap">
        <button class="bookmark__action"></button>
        ${imgLayout}
        <div class="bookmark__caption">
          <img src="/img/folder.svg" class="bookmark__favicon" width="16" height="16" alt="">
          <span class="bookmark__title">%title%</span>
        </div>
      </div>
      </a>`;

    return $templater(tpl, {
      id: bookmark.id,
      parentId: bookmark.parentId,
      url: bookmark.id,
      title: $escapeHtml(bookmark.title),
    });
  }

  function renderFolderChildren(bookmark) {
    // if the folder is empty or if there are only folders inside the bookmark, display the default icon
    if (!bookmark.children) return false;

    const subChildrenFolderCount = bookmark.children.reduce((acc, cur) => {
      if (cur.children) acc += 1;
      return acc;
    }, 0);

    if (!bookmark.children.length || subChildrenFolderCount === bookmark.children.length) {
      return false;
    }

    const shuffleChildren = $shuffle(bookmark.children.filter(item => !item.children)).slice(0, 4);
    const thumbnailingService = localStorage.getItem('thumbnailing_service');

    const childs = shuffleChildren.map(child => {
      let { image = null } = getCustomDial(child.id) || {};
      return image
        ? `<div class="bookmark__childrens" style="background-image: url(${image})"></div>`
        : `<div class="bookmark__childrens bookmark__img--external"
            data-fail-thumb="/img/broken-image.svg"
            data-external-thumb="${thumbnailingService.replace('[URL]', $getDomain(child.url))}">
          </div>`;
    }).join('');
    return `<div class="bookmark__summary-folder">${childs}</div>`;
  }

  function render(_array, isCreate = false) {
    let arr = _array.map(function(bookmark) {
      if (bookmark.url !== undefined) {
        return genBookmark(bookmark);
      }
      if (bookmark.children !== undefined) {
        return genFolder(bookmark);
      }
    });

    isCreate && arr.push(
      `<button class="bookmark--create bookmark--nosort md-ripple" id="add" data-create="New">
        <div class="bookmark__img--add"></div>
      </button>`
    );

    container.innerHTML = arr.join('');

    // loaded external images
    const thumbs = container.querySelectorAll('.bookmark__img--external');
    for (let img of thumbs) {
      $imageLoaded(img.dataset.externalThumb, {
        done(data) {
          img.style.backgroundImage = `url(${data})`;
        },
        fail() {
          img.classList.remove('bookmark__img--external');
          img.classList.add('bookmark__img--broken');
          img.style.backgroundImage = `url(${img.dataset.failThumb})`;
        }
      });
    }
  }

  function createSpeedDial(id) {
    container.innerHTML = '';
    const hasCreate = (localStorage.getItem('show_create_column') === 'true');

    getSubTree(id)
      .then(item => {
        // folder by id exists
        if (!container.classList.contains('grid')) {
          container.classList.add('grid');
        }
        render(item[0].children, hasCreate);
        container.setAttribute('data-folder', id);
      })
      .catch(() => {
        Toast.show(chrome.i18n.getMessage('notice_cant_find_id'));
        container.classList.remove('grid');
        container.innerHTML =
            `<div class="not-found">
              <div class="not-found__wrap">
                <div class="not-found__icon"></div>
                <div class="not-found__text">
                  ${chrome.i18n.getMessage('not_found_text')}
                </div>
                <a class="btn md-ripple" href="#1">${chrome.i18n.getMessage('not_found_link_text')}</a>
              </div>
            </div>`;
      });
  }

  function getCustomDial(id) {
    const storage = JSON.parse(localStorage.getItem('custom_dials'));
    return storage[id];
  }

  function renderProgressToast(sum) {
    const i18n = chrome.i18n.getMessage('thumbnails_creation', ['<strong id="progress-text">0</strong>', sum]);
    const progressToast = $createElement(
      'div', {
        class: 'progress-toast'
      },
      {
        innerHTML:
          `<div class="progress-toast__icon">${SVGLoading.replace(/%id%/g, Date.now())}</div>` +
          `<div class="progress-toast__text">${i18n}</div>`
      }
    );
    return progressToast;
  }

  function flattenArrayBookmarks(arr) {
    return [].concat(...arr.map(item => {
      return Array.isArray(item.children) ? flattenArrayBookmarks(item.children) : item;
    }));
  }

  function autoUpdateThumb() {
    if (isGeneratedThumbs) return;
    const id = startFolder();
    // getChildren(id)
    getSubTree(id)
      .then(async(items) => {
        // check recursively or not
        const children = (localStorage.getItem('thumbnails_update_recursive') === 'true')
          // create a flat array of nested bookmarks
          ? flattenArrayBookmarks(items[0].children)
          // only first level bookmarks without folders
          : items[0].children.filter(item => item.url);

        // create notification toast
        const progressToast = renderProgressToast(children.length);
        document.body.appendChild(progressToast);
        const progressText = document.getElementById('progress-text');

        isGeneratedThumbs = true;
        $customTrigger('thumbnails:updating', container);

        for (const [index, b] of children.entries()) {
          // updating toast progress
          progressText.textContent = index + 1;
          // get capture
          const response = await captureScreen(b.url, b.id);
          if (response.warning) continue;

          // save to localstorage
          updateStorageCustomDials(b.id, response, false);
          try {
            // if we can, then update the bookmark in the DOM
            const bookmark = container.querySelector(`[data-id="${b.id}"]`);
            const image = bookmark.querySelector('.bookmark__img');
            image.className = 'bookmark__img';
            image.style.backgroundImage = `url('${response}?refresh=${Date.now()}')`;
          } catch (err) {}
        }

        isGeneratedThumbs = false;
        $notifications(
          chrome.i18n.getMessage('notice_thumbnails_update_complete')
        );
        $customTrigger('thumbnails:updated', container);
        progressToast.remove();
      });
  }

  function updateStorageCustomDials(id, url, custom = false) {
    const obj = JSON.parse(localStorage.getItem('custom_dials'));
    obj[id] = {
      image: url,
      custom
    };
    localStorage.setItem('custom_dials', JSON.stringify(obj));
    return obj;
  }

  function uploadScreen(data) {
    const folderPreviewOff = localStorage.getItem('folder_preview') !== 'true';
    const { target, id, site } = data;
    const file = target.files[0];
    if (!file) return;

    if (!/image\/(jpe?g|png|webp)$/.test(file.type)) {
      return alert(chrome.i18n.getMessage('alert_file_type_fail'));
    }
    target.value = '';

    const bookmark = document.querySelector(`[data-id="${id}"]`);
    const overlay = $createElement('div', {
      class: 'bookmark__overlay'
    }, {
      innerHTML: SVGLoading.replace(/%id%/g, Date.now())
    });
    bookmark.appendChild(overlay);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async function() {
      const image = await $resizeScreen(reader.result);
      const blob = $base64ToBlob(image, 'image/jpg');
      const name = (site) ? `${site}_${id}.jpg` : `folder-${id}.jpg`;

      await FS.createDir('images');
      const fileEntry = await FS.createFile(`/images/${name}`, { file: blob, fileType: 'jpg' });

      updateStorageCustomDials(id, fileEntry.toURL(), !!site);

      // update view only if folder_preview option is off or if the tab is not a folder
      if (folderPreviewOff || data.site) {
        const imgEl = bookmark.querySelector('.bookmark__img');
        if (data.site) {
          imgEl.classList.remove('bookmark__img--external', 'bookmark__img--broken');
        } else {
          imgEl.classList.remove('bookmark__img--folder');
        }
        imgEl.classList.add('bookmark__img--contain');

        imgEl.style.backgroundImage = `url('${fileEntry.toURL()}?refresh=${Date.now()}')`;
      }

      overlay.remove();
      Toast.show(chrome.i18n.getMessage('notice_thumb_image_updated'));
    };

    reader.onerror = function() {
      console.warn('Image upload failed');
    };

  }

  function captureScreen(captureUrl, id) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ captureUrl, id }, (response) => {
        if (response.warning) {
          console.warn(response.warning);
        }
        resolve(response);
      });
    });
  }

  async function createScreen(bookmark, idBookmark, captureUrl) {
    if (!bookmark) return;

    const overlay = $createElement('div', {
      class: 'bookmark__overlay'
    }, {
      innerHTML: SVGLoading
    });
    bookmark.appendChild(overlay);
    bookmark.classList.add('disable-events');
    const image = bookmark.querySelector('.bookmark__img');
    const response = await captureScreen(captureUrl, idBookmark);

    if (!response.warning) {
      image.className = 'bookmark__img';
      image.style.backgroundImage = `url('${response}?refresh=${Date.now()}')`;
      bookmark.classList.remove('disable-events');
      updateStorageCustomDials(idBookmark, response);
    }

    overlay.remove();
    bookmark.classList.remove('disable-events');
  }

  function search(query) {
    const isdnd = localStorage.getItem('drag_and_drop') === 'true';
    searchBookmarks(query)
      .then(match => {
        if (match.length > 0) {
          if (isdnd) {
            sort.option('disabled', true);
          }
          render(match);
        } else {
          if (isdnd) {
            sort.option('disabled', false);
          }
          createSpeedDial(startFolder());
        }
      });
  }

  function removeBookmark(bookmark) {
    if (confirm(chrome.i18n.getMessage('confirm_delete_bookmark'), '')) {
      const id = bookmark.getAttribute('data-id');
      remove(id)
        .then(() => {
          bookmark.remove();
          rmCustomScreen(id);
          Toast.show(chrome.i18n.getMessage('notice_bookmark_removed'));
        });
    }
  }

  function removeFolder(bookmark) {
    if (confirm(chrome.i18n.getMessage('confirm_delete_folder'), '')) {
      const id = bookmark.getAttribute('data-id');
      removeTree(id)
        .then(() => {
          bookmark.remove();
          rmCustomScreen(id);
          $customTrigger('updateFolderList', container, {
            detail: {
              isFolder: true
            }
          });
          Toast.show(chrome.i18n.getMessage('notice_folder_removed'));
        });
    }
  }

  async function rmCustomScreen(id, cb) {
    const screen = getCustomDial(id);
    const { image = screen } = screen || {};
    if (!image) return;

    const name = image.split('/').pop();
    await FS.removeFile(`/images/${name}`);
    const storage = JSON.parse(localStorage.getItem('custom_dials'));
    delete storage[id];
    localStorage.setItem('custom_dials', JSON.stringify(storage));
    cb && cb();
  }

  function buildBookmarkHash(title, url) {
    if (!title.length) {
      return undefined;
    }
    // Chrome won't create bookmarks without HTTP
    if (!$isValidUrl(url) && url.length) {
      url = `http://${url}`;
    }

    return { title, url };
  }

  function createBookmark(title, url) {
    let hash = buildBookmarkHash(title, url);
    if (hash === undefined) {
      alert(chrome.i18n.getMessage('alert_create_fail_bookmark'));
      return false;
    }
    hash.parentId = container.getAttribute('data-folder');

    create(hash)
      .then(result => {
        let html;
        if (result.url) {
          html = genBookmark(result);
        } else {
          html = genFolder(result);
        }
        container.querySelector('.bookmark--nosort').insertAdjacentHTML('beforeBegin', html);
        const bookmark = container.querySelector(`[data-id="${result.id}"]`);

        if (result.url) {
          if (localStorage.getItem('auto_generate_thumbnail') === 'true') {
            createScreen(bookmark, result.id, result.url);
          } else {
            const image = bookmark.querySelector('.bookmark__img');
            image.classList.add('bookmark__img--external');
            $imageLoaded(image.dataset.externalThumb, {
              done(data) {
                image.style.backgroundImage = `url(${data})`;
              },
              fail() {
                image.style.backgroundImage = image.dataset.failThumb;
              }
            });
          }
        } else {
          $customTrigger('updateFolderList', container, {
            detail: {
              isFolder: true
            }
          });
        }
      });
    return true;
  }

  function updateBookmark(id, title, url, moveId) {
    let hash = buildBookmarkHash(title, url);
    const bookmark = container.querySelector(`[data-id="${id}"]`);
    // Actually make sure the URL being modified is valid instead of always
    // prepending http:// to it creating new valid+invalid bookmark
    if (url.length !== 0 && !$isValidUrl(url)) {
      hash = undefined;
    }
    if (hash === undefined) {
      alert(chrome.i18n.getMessage('alert_update_fail_bookmark'));
      return false;
    }

    update(id, hash)
      .then(result => {
        // if the bookmark is moved to another folder
        if (moveId !== id && moveId !== result.parentId) {

          move(id, { parentId: moveId })
            .then(() => {
              bookmark.remove();
              // if it is a folder update folderList
              if (!result.url) {
                $customTrigger('updateFolderList', container, {
                  detail: {
                    isFolder: true
                  }
                });
              }
            });
        } else {
          // else update bookmark view
          bookmark.href = result.url ? result.url : `#${result.id}`;
          bookmark.title = result.title;
          bookmark.querySelector('.bookmark__title').textContent = result.title;
          // if it is a folder update folderList
          if (!result.url) {
            $customTrigger('updateFolderList', container, {
              detail: {
                isFolder: true
              }
            });
          }
        }
        Toast.show(chrome.i18n.getMessage('notice_bookmark_updated'));
      });
    return true;
  }

  return {
    init,
    createBookmark,
    updateBookmark,
    removeBookmark,
    removeFolder,
    generateFolderList,
    createScreen,
    uploadScreen,
    rmCustomScreen,
    autoUpdateThumb,
    getCustomDial
  };

})();

export default Bookmarks;
