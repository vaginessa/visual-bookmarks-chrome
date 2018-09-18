import '../../img/broken-image.svg';
import Sortable from 'sortablejs';
import FS from './fs';
import Helpers from './helpers';

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

    // Vertical center
    if (localStorage.getItem('vertical_center') === 'true') {
      document.getElementById('content').classList.add('flex-vertical-center');
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
      createSpeedDial(startFolder());

      const id = window.location.hash.slice(1);
      if (localStorage.getItem('show_toolbar') === 'true' && select) {
        const option = select.querySelector(`#selectFolder [value="${id}"]`);
        if (!option) return;
        option.selected = true;
      }
      Helpers.customTrigger('changeFolder', container, {
        detail: {
          id: id
        }
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
        filter: '.bookmark__control',
        draggable: '.column',
        ghostClass: 'column--ghost',
        chosenClass: 'column--chosen',
        preventOnFilter: false,
        onMove(evt) {
          // do not sort create column
          if (evt.related.classList.contains('column--nosort')) {
            return false;
          }
        },
        onUpdate() {
          Array.prototype.slice.call(container.querySelectorAll('.bookmark')).forEach(function(item, index) {
            bk.move(item.getAttribute('data-sort'), {
              'parentId': container.getAttribute('data-folder'),
              'index': index
            });
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

  function generateFolderList(select) {
    // If not select element
    if (!(select instanceof HTMLSelectElement)) return;

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
    });
  }

  function genBookmark(bookmark) {

    const hasFavicon = (localStorage.getItem('show_favicon') === 'true')
      ? '<img class="bookmark__favicon" width="16" height="16" src="chrome://favicon/%url%" alt="">'
      : '';

    const screen = getCustomDial(bookmark.id);
    const thumbContainer = (screen)
      ?
      `<div class="bookmark__img" style="background-image: url('${screen}');"></div>`
      :
      `<div class="bookmark__img bookmark__img--external"
            data-fail-thumb="/img/broken-image.svg"
            data-external-thumb="%thumbnailing_service%">
      </div>`;

    const tpl =
      `<div class="column">
        <div class="bookmark" data-sort="%id%">
          ${thumbContainer}
          <div class="bookmark__control bookmark__control--left">
            <div class="bookmark__more">
              <div class="bookmark__control-wrap">
                <button class="bookmark__edit"
                        data-bookmark="bookmark"
                        data-title="%title%"
                        data-url="%url%"
                        data-id="%id%"
                        data-screen="%screen%">
                </button>
                <div class="bookmark__divider"></div>
                <button class="bookmark__screen" data-id="%id%"></button>
                <div class="bookmark__divider"></div>
                <div class="bookmark__image-upload">
                  <input type="file" name="" class="c-upload__input"
                         id="upload-%id%"
                         data-id='{"id": %id%, "site": "%site%"}'
                         accept=".jpg, .jpeg, .png">
                  <label for="upload-%id%" class="c-upload__label"></label>
                </div>
              </div>
            </div>
          </div>
          <div class="bookmark__control bookmark__control--right">
            <button class="bookmark__del--bookmark" data-id="%id%"></button>
          </div>
          <div class="bookmark__caption">
            ${hasFavicon}
            <div class="bookmark__title">%title%</div>
          </div>
          <a class="bookmark__link" href="%url%" title="%title%"></a>
        </div>
      </div>`;

    return Helpers.templater(tpl, {
      id: bookmark.id,
      url: bookmark.url,
      site: Helpers.getDomain(bookmark.url),
      screen: screen,
      // localStorage.getItem('thumbnailing_service').replace('[URL]', encodeURIComponent(bookmark.url)),
      // eslint-disable-next-line max-len
      thumbnailing_service: localStorage.getItem('thumbnailing_service').replace('[URL]', Helpers.getDomain(bookmark.url)),
      title: Helpers.escapeHtml(bookmark.title)
    });
  }

  function genFolder(bookmark) {
    let imgLayout;
    const screen = getCustomDial(bookmark.id);

    if (screen) {
      imgLayout = `<div class="bookmark__img bookmark__img--contain" style="background-image: url(${screen})"></div>`;
    } else {
      imgLayout = '<div class="bookmark__img bookmark__img--folder"></div>';
    }

    const tpl =
      `<div class="column">
        <div class="bookmark" data-sort="%id%">
          ${imgLayout}
          <div class="bookmark__control bookmark__control--left">
            <div class="bookmark__more">
              <div class="bookmark__control-wrap">
                <button class="bookmark__edit" data-bookmark="folder"
                        data-title="%title%"
                        data-id="%id%"
                        data-screen="%screen%">
                </button>
                <div class="bookmark__divider"></div>
                <div class="bookmark__image-upload">
                  <input type="file" name="" class="c-upload__input"
                         id="upload-%id%"
                         data-id='{"id": %id%}'
                         accept=".jpg, .jpeg, .png">
                  <label for="upload-%id%" class="c-upload__label"></label>
                </div>
              </div>
            </div>
          </div>
          <div class="bookmark__control bookmark__control--right">
            <button class="bookmark__del--folder" data-id="%id%"></button>
          </div>
          <div class="bookmark__caption">
            <img src="/img/folder.svg" class="bookmark__favicon" width="16" height="16" alt="">
            <div class="bookmark__title">%title%</div>
          </div>
          <a class="bookmark__link" href="#%url%" title="%title%"></a>
        </div>
      </div>`;
    return Helpers.templater(tpl, {
      id: bookmark.id,
      url: bookmark.id,
      title: Helpers.escapeHtml(bookmark.title),
      screen: screen
    });
  }

  function render(_array, isCreate = false) {
    let arr = [];

    _array.forEach(function(bookmark) {
      if (bookmark.url !== undefined) {
        arr.push(genBookmark(bookmark));
      }
      if (bookmark.children !== undefined) {
        arr.push(genFolder(bookmark));
      }
    });

    container.innerHTML =
      `${arr.join('')}
      ${isCreate
    ?
    `<div class="column--nosort">
        <div class="bookmark--create md-ripple">
          <div class="bookmark__img--add"></div>
          <a class="bookmark__link--create" id="add"></a>
        </div>
      </div>`
    : ''
  }
    `;

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

    const hasCreate = (localStorage.getItem('show_create_column') === 'true');

    bk.getSubTree(id, function(item) {
      if (item !== undefined) {
        render(item[0].children, hasCreate);
        container.setAttribute('data-folder', id);
      } else {
        Helpers.notifications(chrome.i18n.getMessage('notice_cant_find_id'));
        container.innerHTML = '';
      }
    });
  }

  function uploadScreen(data) {
    // const file = target.files[0];
    const { target, id, site } = data;

    const file = target.files[0];
    if (!file) return;

    if (!/image\/(jpe?g|png)$/.test(file.type)) {
      return alert(chrome.i18n.getMessage('alert_file_type_fail'));
    }
    target.value = '';

    const bookmark = target.closest('.bookmark');
    bookmark.innerHTML += `<div id="overlay_id_${id}" class="bookmark__overlay">${SVGLoading}</div>`;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = function() {

      Helpers.resizeScreen(reader.result, function(image) {
        const blob = Helpers.base64ToBlob(image, 'image/jpg');

        let name;
        if (site) {
          name = `${site}_${id}.jpg`;
        } else {
          name = `folder-${id}.jpg`;
        }

        FS.createDir('images', function() {
          FS.createFile(`/images/${name}`, { file: blob, fileType: 'jpg' }, function(fileEntry) {

            const obj = JSON.parse(localStorage.getItem('custom_dials'));
            obj[id] = fileEntry.toURL();
            localStorage.setItem('custom_dials', JSON.stringify(obj));

            const imgEl = bookmark.querySelector('.bookmark__img');
            const edit = bookmark.querySelector('.bookmark__edit');

            if (data.site) {
              imgEl.classList.remove('bookmark__img--external');
            } else {
              imgEl.classList.remove('bookmark__img--folder');
              imgEl.classList.add('bookmark__img--contain');
            }

            edit.setAttribute('data-screen', fileEntry.toURL());
            imgEl.style.backgroundImage = `url('${fileEntry.toURL()}?refresh=${Date.now()}')`;

            let overlay = document.getElementById('overlay_id_' + id);

            if (overlay) {
              bookmark.removeChild(overlay);
            }
            Helpers.notifications(
              chrome.i18n.getMessage('notice_thumb_image_updated')
            );

          });
        });

      });

    };

    reader.onerror = function() {
      console.warn('Image upload failed');
    };

  }

  function createScreen(bookmark, idBookmark, captureUrl) {
    bookmark.innerHTML += `<div id="overlay_id_${idBookmark}" class="bookmark__overlay">${SVGLoading}</div>`;

    const image = bookmark.querySelector('.bookmark__img');

    chrome.runtime.sendMessage({ captureUrl: captureUrl, id: idBookmark }, (response) => {

      let overlay = document.getElementById('overlay_id_' + idBookmark);

      if (response.warning) {
        console.warn(response.warning);
        if (overlay) {
          bookmark.removeChild(overlay);
        }
        return false;
      }

      image.classList.remove('bookmark__img--external');
      image.style.backgroundImage = `url('${response}?refresh=${Date.now()}')`;
      if (overlay) {
        bookmark.removeChild(overlay);
      }
    });
  }

  function search(evt) {
    const value = evt.target.value.trim().toLowerCase();
    bk.search(value, function(match) {
      if (match.length > 0) {
        if (localStorage.getItem('drag_and_drop') === 'true') {
          sort.option('disabled', true);
        }
        render(match);
      } else {
        if (localStorage.getItem('drag_and_drop') === 'true') {
          sort.option('disabled', false);
        }
        createSpeedDial(startFolder());
      }
    });
  }

  function changeFolder() {
    const id = this.value;
    window.location.hash = '#' + id;
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
      });
    }
  }

  function removeFolder(evt) {
    evt.preventDefault();
    const target = evt.target;
    const bookmark = target.closest('.column');
    if (confirm(chrome.i18n.getMessage('confirm_delete_folder'), '')) {
      const id = target.getAttribute('data-id');
      bk.removeTree(id, function() {
        container.removeChild(bookmark);
        rmCustomScreen(id);
        Helpers.customTrigger('updateFolderList', container, {
          detail: {
            isFolder: true
          }
        });
        Helpers.notifications(
          chrome.i18n.getMessage('notice_folder_removed')
        );
      });
    }
  }

  function rmCustomScreen(id, cb) {
    const screen = getCustomDial(id);
    if (!screen) return;

    const name = screen.split('/').pop();
    FS.deleteFile(`/images/${name}`, function() {
      const storage = JSON.parse(localStorage.getItem('custom_dials'));
      delete storage[id];
      localStorage.setItem('custom_dials', JSON.stringify(storage));
      cb && cb();
    });
  }

  function isValidUrl(url) {
    // The regex used in AngularJS to validate a URL + chrome internal pages & extension url & on-disk files
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
      url = 'http://' + url;
    }

    return { 'title': title, 'url': url };
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
    alert(chrome.i18n.getMessage('alert_create_fail_bookmark'));
    return false;
  }

  function updateBookmark(id, title, url, move) {
    let hash = buildBookmarkHash(title, url);
    const bookmark = container.querySelector('[data-sort="' + id + '"]');
    const editBtn = bookmark.querySelector('.bookmark__edit');
    // Actually make sure the URL being modified is valid instead of always
    // prepending http:// to it creating new valid+invalid bookmark
    if (url.length !== 0 && !isValidUrl(url)) {
      hash = undefined;
    }
    if (hash !== undefined) {

      bk.update(id, hash, function(result) {
        // if the bookmark is moved to another folder
        if (move !== id && move !== result.parentId) {
          const destination = {parentId: move};
          const bookmarkColumn = bookmark.closest('.column');
          chrome.bookmarks.move(id, destination, function() {
            container.removeChild(bookmarkColumn);

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
          bookmark.querySelector('.bookmark__link').href = (result.url) ? result.url : '#' + result.id;
          bookmark.querySelector('.bookmark__title').textContent = result.title;
          bookmark.querySelector('.bookmark__link').title = result.title;

          // If not folder
          if (result.url) {
            editBtn.setAttribute('data-url', result.url);
          }
          editBtn.setAttribute('data-title', result.title);
          // if it is a folder update folderList
          if (!result.url) {
            Helpers.customTrigger('updateFolderList', container, {
              detail: {
                isFolder: true
              }
            });
          }
        }

        Helpers.notifications(chrome.i18n.getMessage('notice_bookmark_updated'));
      });
      return true;
    }
    alert(chrome.i18n.getMessage('alert_update_fail_bookmark'));
    return false;
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
    rmCustomScreen
  };

})();

export default Bookmarks;
