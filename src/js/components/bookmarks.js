// import '../img/broken-image.svg';
import Sortable from 'sortablejs';
import Toast from './toast';
import FS from '../api/fs';
import Helpers from './helpers';
import {
  getFolders,
  move,
  getChildren,
  getSubTree,
  search as searchBookmarks,
  remove,
  removeTree,
  create,
  update } from '../api/bookmark';

/**
 * Bookmarks module
 */
const Bookmarks = (() => {
  const container = document.getElementById('bookmarks');
  const SVGLoading = document.getElementById('loading').outerHTML;
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

    // Create speeddial
    createSpeedDial(startFolder());

    // Hide the settings icon if setting_icon disable
    if (localStorage.getItem('show_settings_icon') === 'false') {
      const icon = document.getElementById('settings_icon');
      icon.parentNode.removeChild(icon);
    }

    // Search bookmarks if toolbar enable
    let select;
    if (localStorage.getItem('show_toolbar') === 'false') {
      document.getElementById('header').remove();
      document.getElementById('main').classList.add('hidden-toolbar');
    } else {
      const searchReset = document.getElementById('searchReset');
      select = document.getElementById('selectFolder');
      generateFolderList(select);
      select.addEventListener('change', changeFolder, false);

      const searchDebounce = Helpers.debounce(function(evt) {
        const value = evt.target.value;

        (value.length > 0)
          ? searchReset.classList.add('show')
          : searchReset.classList.remove('show');

        search(evt);
      }, 500);
      const fieldEl = document.getElementById('bookmarkSearch');
      fieldEl.addEventListener('input', searchDebounce, false);
      // Form input reset handler
      searchReset.addEventListener('click', function() {
        fieldEl.value = '';
        // Helpers.trigger('input', fieldEl);
        createSpeedDial(startFolder());
        fieldEl.focus();
        searchReset.classList.remove('show');

        if (localStorage.getItem('drag_and_drop') === 'true') {
          sort.option('disabled', false);
        }
      }, false);
    }

    // Change the current dial if the page hash changes
    window.addEventListener('hashchange', function() {
      const folderId = startFolder();
      createSpeedDial(folderId);
      if (localStorage.getItem('show_toolbar') === 'true' && select) {
        const option = select.querySelector(`#selectFolder [value="${folderId}"]`);
        if (!option) return;
        option.selected = true;
      }
      Helpers.customTrigger('changeFolder', container, {
        detail: { folderId }
      });
    }, false);

    container.addEventListener('updateFolderList', function(e) {
      if (!select) return;
      if (e.detail && e.detail.isFolder) {
        generateFolderList(select);
      }
    });

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

  }

  function startFolder() {
    let folderId = localStorage.getItem('default_folder_id');
    if (window.location.hash !== '') {
      folderId = window.location.hash.slice(1);
    }
    return folderId;
  }

  async function generateFolderList(select, activeFolder = null, itemId = null) {
    // If not select element
    if (!(select instanceof HTMLSelectElement)) return;

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
    // eslint-disable-next-line require-atomic-updates
    select.innerHTML = optionsArr.join('');
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
        href="%url%" title="%title%">
        ${(localStorage.getItem('open_link_newtab') === 'true') ? `target="_blank" rel="noopener noreferrer"` : ``}
        <div class="bookmark__wrap">
          <button class="bookmark__action"></button>
          ${thumbContainer}
          <div class="bookmark__caption">
            ${hasFavicon}
            <span class="bookmark__title">%title%</span>
          </div>
        </div>
        </a>`;

    return Helpers.templater(tpl, {
      id: bookmark.id,
      url: bookmark.url,
      site: Helpers.getDomain(bookmark.url),
      // localStorage.getItem('thumbnailing_service').replace('[URL]', encodeURIComponent(bookmark.url)),
      // eslint-disable-next-line max-len
      thumbnailing_service: localStorage.getItem('thumbnailing_service').replace('[URL]', Helpers.getDomain(bookmark.url)),
      title: Helpers.escapeHtml(bookmark.title)
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

    return Helpers.templater(tpl, {
      id: bookmark.id,
      parentId: bookmark.parentId,
      url: bookmark.id,
      title: Helpers.escapeHtml(bookmark.title),
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

    const shuffleChildren = Helpers.shuffle(bookmark.children.filter(item => !item.children)).slice(0, 4);
    const thumbnailingService = localStorage.getItem('thumbnailing_service');

    const childs = shuffleChildren.map(child => {
      let { image = null } = getCustomDial(child.id) || {};
      return image
        ? `<div class="bookmark__childrens" style="background-image: url(${image})"></div>`
        : `<div class="bookmark__childrens bookmark__img--external"
            data-fail-thumb="/img/broken-image.svg"
            data-external-thumb="${thumbnailingService.replace('[URL]', Helpers.getDomain(child.url))}">
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
      Helpers.imageLoaded(img.dataset.externalThumb, {
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

  function getCustomDial(id) {
    const storage = JSON.parse(localStorage.getItem('custom_dials'));
    return storage[id];
  }

  function autoUpdateThumb() {
    if (isGeneratedThumbs) return;
    const id = startFolder();
    getChildren(id)
      .then(async(items) => {
        isGeneratedThumbs = true;
        document.body.classList.add('thumbnails-updating');
        Helpers.customTrigger('thumbnails:updating', container);

        for (let b of items) {
          if (!b.url) continue;
          const bookmark = container.querySelector(`[data-id="${b.id}"]`);
          await createScreen(bookmark, b.id, b.url);
        }
        isGeneratedThumbs = false;
        document.body.classList.remove('thumbnails-updating');
        Helpers.notifications(
          chrome.i18n.getMessage('notice_thumbnails_update_complete')
        );
        Helpers.customTrigger('thumbnails:updated', container);
      });
  }

  function createSpeedDial(id) {
    container.innerHTML = '';
    const hasCreate = (localStorage.getItem('show_create_column') === 'true');

    getSubTree(id)
      .then(item => {
        // if the folder by id exists
        if (item !== undefined && item[0] !== undefined && item[0].children !== undefined) {
          if (!container.classList.contains('grid')) {
            container.classList.add('grid');
          }
          render(item[0].children, hasCreate);
          container.setAttribute('data-folder', id);
        } else {
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
        }
      });
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
    bookmark.innerHTML += `<div class="bookmark__overlay">${SVGLoading}</div>`;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async function() {
      const image = await Helpers.resizeScreen(reader.result);
      const blob = Helpers.base64ToBlob(image, 'image/jpg');
      const name = (site) ? `${site}_${id}.jpg` : `folder-${id}.jpg`;

      await FS.createDir('images');
      const fileEntry = await FS.createFile(`/images/${name}`, { file: blob, fileType: 'jpg' });

      const obj = JSON.parse(localStorage.getItem('custom_dials'));
      obj[id] = {
        image: fileEntry.toURL(),
        custom: !!site
      };
      localStorage.setItem('custom_dials', JSON.stringify(obj));

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

      let overlay = bookmark.querySelector('.bookmark__overlay');
      if (overlay) {
        overlay.remove();
      }
      Toast.show(chrome.i18n.getMessage('notice_thumb_image_updated'));
    };

    reader.onerror = function() {
      console.warn('Image upload failed');
    };

  }

  function createScreen(bookmark, idBookmark, captureUrl) {
    if (!bookmark) return;

    bookmark.classList.add('disable-events');
    bookmark.innerHTML += `<div class="bookmark__overlay">${SVGLoading}</div>`;

    const image = bookmark.querySelector('.bookmark__img');

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ captureUrl: captureUrl, id: idBookmark }, (response) => {

        let overlay = bookmark.querySelector('.bookmark__overlay');

        if (response.warning) {
          console.warn(response.warning);
          if (overlay) {
            overlay.remove();
            bookmark.classList.remove('disable-events');
          }
          // reject();
          // return the promise even if it was not possible to make a thumbnail, to continue generating the folder thumbnails
          resolve();
          return false;
        }

        image.className = 'bookmark__img';
        image.style.backgroundImage = `url('${response}?refresh=${Date.now()}')`;
        bookmark.classList.remove('disable-events');

        const obj = JSON.parse(localStorage.getItem('custom_dials'));
        obj[idBookmark] = {
          image: response,
          custom: false
        };
        localStorage.setItem('custom_dials', JSON.stringify(obj));

        if (overlay) {
          overlay.remove();
        }
        resolve();
      });

    });

  }

  function search(evt) {
    const value = evt.target.value.trim().toLowerCase();
    const isdnd = localStorage.getItem('drag_and_drop') === 'true';
    searchBookmarks(value)
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

  function changeFolder() {
    const id = this.value;
    window.location.hash = `#${id}`;
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
          Helpers.customTrigger('updateFolderList', container, {
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
    if (!Helpers.isValidUrl(url) && url.length) {
      url = 'http://' + url;
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

    // const result = await create(hash).catch(err => console.warn(err));
    // if (!result) return false;
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
            Helpers.imageLoaded(image.dataset.externalThumb, {
              done(data) {
                image.style.backgroundImage = `url(${data})`;
              },
              fail() {
                image.style.backgroundImage = image.dataset.failThumb;
              }
            });
          }
        } else {
          Helpers.customTrigger('updateFolderList', container, {
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
    if (url.length !== 0 && !Helpers.isValidUrl(url)) {
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
                Helpers.customTrigger('updateFolderList', container, {
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
            Helpers.customTrigger('updateFolderList', container, {
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
