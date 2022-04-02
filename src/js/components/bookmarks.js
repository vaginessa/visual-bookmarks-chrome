import Sortable from 'sortablejs';
import Toast from './toast';
import FS from '../api/fs';
import {
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
  $escapeHtml,
  $shuffle,
  $createElement,
  $notifications,
  $resizeScreen,
  $base64ToBlob,
  $isValidUrl
} from '../utils';
import { SVG_LOADER } from '../constants';
import  confirmPopup from '../plugins/confirmPopup.js';
import './vb-bookmark';

/**
 * Bookmarks module
 */
const Bookmarks = (() => {
  const container = document.getElementById('bookmarks');
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
    if (
      localStorage.getItem('drag_and_drop') === 'true' &&
      localStorage.getItem('sort_by_newest') !== 'true'
    ) {
      observerDropzone();
      initDrag(container);
    }

    // Search bookmarks if toolbar enable
    if (localStorage.getItem('show_toolbar') === 'true') {
      await import(/* webpackChunkName: "webcomponents/vb-header" */'./vb-header');
      const vbHeader = document.createElement('vb-header');
      vbHeader.setAttribute('placeholder', chrome.i18n.getMessage('placeholder_input_search'));
      vbHeader.setAttribute('initial-folder-id', localStorage.getItem('default_folder_id'));
      vbHeader.setAttribute('folder-id', startFolder());
      document.querySelector('header').appendChild(vbHeader);

      const searchHandler = $debounce(({ detail }) => {
        search(detail.search);
      }, 500);
      const searchResetHandler = () => {
        createSpeedDial(startFolder());
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
  }

  function observerDropzone() {
    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          const dropzone = node.querySelector('.bookmark__dropzone');
          if (!dropzone) continue;
          initDrag(dropzone);
        }

        for (let node of mutation.removedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          const dropzone = node.querySelector('.bookmark__dropzone');
          if (!dropzone) continue;

          dropzone.sortInstance?.destroy();
          delete dropzone.sortInstance;
        }
      }
    });

    observer.observe(container, {
      childList: true
    });
  }

  // helper to turn on the dropzone lighting
  function showDropzone(target) {
    [...container.querySelectorAll('.bookmark__dropzone')]
      .forEach(el => {
        const bookmark = el.closest('.bookmark');
        if (bookmark.dataset.id !== target.dataset.id) {
          el.classList.add('is-activate');
        }
      });
  }

  // helper to turn off the dropzone backlight
  function hideDropzone() {
    [...container.querySelectorAll('.is-activate')]
      .forEach(el => el.classList.remove('is-activate'));
  }

  function initDrag(el) {
    el.sortInstance = Sortable.create(el, {
      group: {
        name: 'shared',
        pull: 'clone'
      },
      animation: 200,
      fallbackOnBody: true,
      filter: '.bookmark__action',
      draggable: '.bookmark',
      removeCloneOnHide: false,
      ghostClass: 'bookmark--ghost',
      chosenClass: 'bookmark--chosen',
      preventOnFilter: false,
      onStart(evt) {
        showDropzone(evt.item);
      },
      onEnd(evt) {
        if (!evt.pullMode) {
          hideDropzone();
        }
      },
      /**
       * Sortable onMove event
       * @param {Object} event - sortablejs event
       * @param {HTMLElement} event.to - HTMLElement target list
       * @param {HTMLElement} event.related - HTMLElement on which have guided
       */
      onMove({ to, related }) {
        container.querySelector('.has-highlight')?.classList.remove('has-highlight');
        if (to.matches('.bookmark__dropzone')) {
          to.classList.add('has-highlight');
        }
        // do not sort create column
        if (related.classList.contains('bookmark--nosort')) {
          return false;
        }
      },
      /**
       * Sortable onAdd event
       * @param {Object} event -sortablejs event
       * @param {HTMLElement} event.item - dragging element
       * @param {HTMLElement} event.clone -clone for dragging element
       * @param {HTMLElement} event.target - dropzone element
       *
       */
      onAdd({ item, clone, target }) {
        const id = item.dataset.id;
        const parentId = target.dataset.id;

        // preparation for animation
        item.style.transformOrigin = 'center bottom';
        // animation of moving a bookmark to a folder(Web Animations API)
        let itemAnimation = item.animate([
          {
            opacity: 1,
            transform: 'scale3d(0.475, 0.475, 0.475) translate3d(0, -20px, 0)',
            animationTimingFunction: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
            offset: 0.4
          },
          {
            opacity: 0,
            transform: 'scale3d(0.1, 0.1, 0.1) translate3d(0, 100px, 0)',
            animationTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1)'
          }
        ], 550);
        // waiting animationend
        itemAnimation.onfinish = () => {
          // remove clone bookmark
          clone.remove();
          // remove bookmark node from DOM
          item.remove();
          // hide highlight dropzone
          hideDropzone();
          // move the bookmark to the target folder
          move(id, { parentId })
            .then(() => {
              const isFolder = item.hasAttribute('is-folder');
              // if the folder run the updateFolderList trigger
              isFolder && $customTrigger('updateFolderList', document, {
                detail: {
                  isFolder: true
                }
              });
            });
        };
      },
      onUpdate() {
        Array.from(container.querySelectorAll('.bookmark')).forEach(async(item, index) => {
          await move(item.getAttribute('data-id'), {
            'parentId': container.dataset.folder,
            'index': index
          }).catch(err => console.warn(err));
        });
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

  function genBookmark(bookmark) {
    const screen = getCustomDial(bookmark.id);
    // key screen destructuring
    // the old key does not contain nested properties(image, custom), so we assign the key value to the variable image
    // the key may be undefined,in this case we are trying to work with an empty object
    const { image = screen, custom = false } = screen || {};
    const vbBookmark = document.createElement('a', {is: 'vb-bookmark'});
    Object.assign(vbBookmark, {
      id: bookmark.id,
      url: bookmark.url,
      title: $escapeHtml(bookmark.title),
      image,
      isCustomImage: custom,
      openNewTab: localStorage.getItem('open_link_newtab') === 'true',
      hasTitle: localStorage.getItem('show_bookmark_title') === 'true',
      hasFavicon: localStorage.getItem('show_favicon') === 'true'
    });
    return vbBookmark;
  }

  function genFolder(bookmark) {
    let image;
    const screen = getCustomDial(bookmark.id);
    const folderPreview = localStorage.getItem('folder_preview') === 'true';

    if (!folderPreview) {
      image = screen?.image;
    }

    const vbBookmark = document.createElement('a', {is: 'vb-bookmark'});
    Object.assign(vbBookmark, {
      id: bookmark.id,
      url: `#${bookmark.id}`,
      title: $escapeHtml(bookmark.title),
      isFolder : true,
      hasFolderPreview: folderPreview,
      folderChidlren: folderPreview ? renderFolderChildren(bookmark) : [],
      image,
      openNewTab: localStorage.getItem('open_link_newtab') === 'true',
      hasTitle: localStorage.getItem('show_bookmark_title') === 'true',
      hasFavicon: localStorage.getItem('show_favicon') === 'true',
      isDND: localStorage.getItem('drag_and_drop') === 'true'
    });
    return vbBookmark;
  }

  function renderFolderChildren(bookmark) {
    // if the folder is empty or if there are only folders inside the bookmark, display the default icon
    if (!bookmark.children) return [];

    const subChildrenFolderCount = bookmark.children.reduce((acc, cur) => {
      if (cur.children) acc += 1;
      return acc;
    }, 0);

    if (
      !bookmark.children.length ||
      subChildrenFolderCount === bookmark.children.length
    ) {
      return [];
    }

    const shuffleChildren = $shuffle(
      bookmark.children
        .filter(item => !item.children)
        .map(item => {
          // key screen destructuring
          // the old key does not contain nested properties(image, custom), so we assign the key value to the variable image
          // the key may be undefined,in this case we are trying to work with an empty object
          let { image = null } = getCustomDial(item.id) || {};
          item.image = image;
          return item;
        })
    ).slice(0, 4);
    return shuffleChildren;
  }

  function clearContainer() {
    if (!container.firstChild) return;

    while (container.firstChild) {
      container.firstChild.remove();
    }
  }

  /**
   * Render bookmarks
   * @param {Array.<BookmarkTreeNode>} arr - array of bookmarks
   * @param {boolean} [isCreate=false] - show add bookmark button
   */
  function render(arr, isCreate = false) {
    clearContainer();

    const fragment = document.createDocumentFragment();
    arr.forEach(bookmark => {
      if (bookmark.url) {
        fragment.appendChild(genBookmark(bookmark));
      } else {
        fragment.appendChild(genFolder(bookmark));
      }
    });

    container.appendChild(fragment);

    isCreate && container.appendChild(
      $createElement('button', {
        id: 'add',
        class: 'bookmark--create bookmark--nosort md-ripple',
        'data-create': 'New'
      })
    );
  }

  function createSpeedDial(id) {
    const dnd = (localStorage.getItem('drag_and_drop') === 'true');
    if (dnd) {
      // if dnd instance exist and disabled(after search) turn it on
      if (container.sortInstance?.options?.disabled) {
        container.sortInstance?.option('disabled', false);
      }
    }

    const hasCreate = (localStorage.getItem('show_create_column') === 'true');

    return getSubTree(id)
      .then(item => {
        // folder by id exists
        if (!container.classList.contains('grid')) {
          container.classList.add('grid');
        }
        // sort by newest
        if (localStorage.getItem('sort_by_newest') === 'true') {
          item[0].children.sort((a, b) => b.dateAdded - a.dateAdded);
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
    const i18n = chrome.i18n.getMessage(
      'thumbnails_creation',
      [
        '<strong id="progress-text">0</strong>',
        sum
      ]
    );
    const progressToast = $createElement(
      'div', {
        class: 'progress-toast'
      },
      {
        innerHTML:
          `<div class="progress-toast__icon">${SVG_LOADER}</div>` +
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
    getSubTree(id)
      .then(async(items) => {
        // check recursively or not
        const children = (localStorage.getItem('thumbnails_update_recursive') === 'true')
          // create a flat array of nested bookmarks
          ? flattenArrayBookmarks(items[0].children)
          // only first level bookmarks without folders
          : items[0].children.filter(item => item.url);

        // sort by newest
        if (localStorage.getItem('sort_by_newest') === 'true') {
          children.sort((a, b) => b.dateAdded - a.dateAdded);
        }

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
            const bookmark = document.getElementById(b.id);
            bookmark.image = `${response}?refresh=${Date.now()}`;
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

  /**
   * Save image to storage
   * @param {string} id - bookmark id
   * @param {string} url - bookmark url
   * @param {boolean} [custom=false] - user image
   * @returns
   */
  function updateStorageCustomDials(id, url, custom = false) {
    const obj = JSON.parse(localStorage.getItem('custom_dials'));
    obj[id] = {
      image: url,
      custom
    };
    localStorage.setItem('custom_dials', JSON.stringify(obj));
    return obj;
  }

  /**
   * Upload user image for thumbnail
   * @param {Object} data
   * @param {HTMLInputElement} data.target - input file
   * @param {string} data.id
   * @param {(string|undefined)} data.site - domain
   */
  function uploadScreen(data) {
    const folderPreviewOff = localStorage.getItem('folder_preview') !== 'true';
    const { target, id, site } = data;
    const file = target.files[0];
    if (!file) return;

    if (!/image\/(jpe?g|png|webp)$/.test(file.type)) {
      return alert(chrome.i18n.getMessage('alert_file_type_fail'));
    }
    target.value = '';

    const bookmark = document.getElementById(id);
    bookmark.hasOverlay = true;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    const fileExtension = file.type.split('/').pop();

    reader.onload = async function() {
      const image = await $resizeScreen(reader.result);
      const blob = $base64ToBlob(image, file.type);
      const name = (site) ? `${site}_${id}.${fileExtension}` : `folder-${id}.${fileExtension}`;

      await FS.createDir('images');
      const fileEntry = await FS.createFile(`/images/${name}`, { file: blob, fileType: fileExtension });

      updateStorageCustomDials(id, fileEntry.toURL(), true);

      // update view only if folder_preview option is off or if the tab is not a folder
      if (folderPreviewOff || site) {
        bookmark.isCustomImage = true;
        bookmark.image = `${fileEntry.toURL()}?refresh=${Date.now()}`;
      }

      bookmark.hasOverlay = false;
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

    bookmark.hasOverlay = true;
    const response = await captureScreen(captureUrl, idBookmark);

    if (!response.warning) {
      bookmark.isCustomImage = false;
      bookmark.image = `${response}?refresh=${Date.now()}`;
      updateStorageCustomDials(idBookmark, response);
    }

    bookmark.hasOverlay = false;
  }

  function search(query) {
    const dnd = localStorage.getItem('drag_and_drop') === 'true';
    searchBookmarks(query)
      .then(match => {
        if (match.length > 0) {
          if (dnd) {
            // if dnd we turn off sorting and destroy nested instances
            container.sortInstance?.option('disabled', true);
          }
          render(match);
        } else {
          createSpeedDial(startFolder());
        }
      });
  }

  async function removeBookmark(bookmark) {
    if (localStorage.getItem('without_confirmation') === 'false') {
      const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_delete_bookmark'));
      if (!confirmAction) return;
    }

    const id = bookmark.getAttribute('data-id');
    remove(id)
      .then(() => {
        bookmark.remove();
        rmCustomScreen(id);
        Toast.show(chrome.i18n.getMessage('notice_bookmark_removed'));
      });
  }

  async function removeFolder(bookmark) {
    if (localStorage.getItem('without_confirmation') === 'false') {
      // if (!confirm(chrome.i18n.getMessage('confirm_delete_folder'), '')) return;
      const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_delete_folder'));
      if (!confirmAction) return;
    }

    const { id } = bookmark;
    removeTree(id)
      .then(() => {
        bookmark.remove();
        rmCustomScreen(id);
        $customTrigger('updateFolderList', document, {
          detail: {
            isFolder: true
          }
        });
        Toast.show(chrome.i18n.getMessage('notice_folder_removed'));
      });
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
        let bookmark;
        if (result.url) {
          bookmark = genBookmark(result);
        } else {
          bookmark = genFolder(result);
        }
        container.querySelector('.bookmark--nosort').insertAdjacentElement('beforeBegin', bookmark);

        if (result.url) {
          if (localStorage.getItem('auto_generate_thumbnail') === 'true') {
            createScreen(bookmark, result.id, result.url);
          }
        } else {
          $customTrigger('updateFolderList', document, {
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
    const bookmark = document.getElementById(id);
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
              // if it is a folder update folderList
              if (!result.url) {
                $customTrigger('updateFolderList', document, {
                  detail: {
                    isFolder: true
                  }
                });
              }
              bookmark.remove();
            });
        } else {
          // if it is a folder update folderList
          if (!result.url) {
            $customTrigger('updateFolderList', document, {
              detail: {
                isFolder: true
              }
            });
          }
          // else update bookmark view
          bookmark.title = result.title;
          bookmark.url = result.url ? result.url : `#${result.id}`;
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
    createScreen,
    uploadScreen,
    rmCustomScreen,
    autoUpdateThumb,
    getCustomDial
  };

})();

export default Bookmarks;
