(function(window) {

  'use strict';

/**
 * Bookmarks module
 */
  var bookmarks = (function() {
    var bk = chrome.bookmarks;

    var container = getEl('#includeThree'),
    sort = null;

    function init() {
      if(!container) return;

      // settings.js
      settings();

      // Create speeddial & generate folder list
      generateFolderList();
      createSpeedDial(startFolder());

      container.addEventListener('click', function(evt) {
        if(evt.target.matches('.bookmark__del--bookmark')) {
          removeBookmark(evt);
        }
        else if(evt.target.matches('.bookmark__del--folder')) {
          removeFolder(evt);
        }
        else if(evt.target.matches('.bookmark__edit')) {
          evt.preventDefault();
          var bookmark = evt.target.closest('.bookmark');
          var title = getEl('.bookmark__title', bookmark).textContent;
          var url = getEl('.bookmark__link', bookmark).getAttribute('href');
          if(url.charAt(0) === '#') {
            url = '';
          }
          var id = evt.target.getAttribute('data-id');
          Modal.show(id, title, url);
        }
        else if(evt.target.matches('#add')) {
          Modal.show('New', '', '');
        }
      }, false);

      getEl('#closeModal').addEventListener('click', function() {
        Modal.hide();
      }, false);
      document.body.addEventListener('keydown', function(evt) {
        if(evt.which === 27) {
          getEl('#closeModal').trigger('click');
        }
      }, false);

      getEl('#formBookmark').addEventListener('submit', function(evt) {
        evt.preventDefault();
        var id = this.getAttribute('data-action');
        var title = getEl('#title').value;
        var url = getEl('#url').value;
        if(id !== 'New') {
          if(updateBookmark(id, title, url)) {
            Modal.hide();
          }
        }
        else {
          if(createBookmark(title, url)) {
            Modal.hide();
          }
        }
      }, false);

      // Search bookmarks
      getEl('#bookmarkSearch').addEventListener('input', search, false);

      // Change the current dial if the page hash changes
      window.addEventListener('hashchange', function(evt) {
        createSpeedDial(startFolder());
        generateFolderList();
        // show|hide back default id folder
        var url = evt.newURL.split('/').pop();
        if(url === 'newtab.html' || url === 'newtab.html#' + localStorage.getItem('default_folder_id')) {
          removeClass('show-back', getEl('#back'));
        } else {
          addClass('show-back', getEl('#back'));
        }
      }, false);


      // Dragging option
      if(localStorage.getItem('drag_and_drop') === 'true') {
        sort = Sortable.create(container, {
          animation: 200,
          filter: '.bookmark__control',
          draggable: '.column',
          onUpdate: function() {
            getElAll('.bookmark', container).forEach(function(item, index) {
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
      var folderId = localStorage.getItem('default_folder_id');
      if(window.location.hash !== '') {
        folderId = window.location.hash.slice(1);
      }
      return folderId;
    }

    function generateFolderList() {
      var select = getEl('#selectFolder');
      select.innerHTML = '';
      select.removeEventListener('change', changeFolder, false);
      chrome.bookmarks.getTree(function(rootNode) {
        var folderList = [], openList = [], node, child;
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
        // var frag = document.createDocumentFragment();
        folderList.forEach(function(item) {
          var option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.path;

          if(item.id === startFolder()) {
            option.selected = 'selected';
          }
          // frag.appendChild(option);
          select.appendChild(option);
        })
        // select.appendChild(frag);
        select.addEventListener('change', changeFolder, false);
      })
    }

    function genBookmark(bookmark) {
      var tpl =
        '<div class="column">'+
            '<figure class="bookmark" data-sort="{id}">'+
              '<div class="bookmark__img" style="background-image: url({thumbnailing_service})"></div>'+
              '<figcaption class="bookmark__caption">'+
                '<div class="bookmark__control">'+
                  '<div class="bookmark__edit" data-bookmark="bookmark" data-title="{title}" data-url="{url}" data-id="{id}"></div>'+
                  '<div class="bookmark__divider"></div>'+
                  '<div class="bookmark__del--bookmark" data-id="{id}"></div>'+
                '</div>'+
                '<div class="bookmark__bottom">'+
                  '<div class="bookmark__title">{title}</div>'+
                '</div>'+
                '<a class="bookmark__link" href="{url}" title="{title}"></a>'+
              '</figcaption>'+
            '</figure>'+
        '</div>';
        return templater(tpl, {
          id: bookmark.id,
          url: bookmark.url,
          thumbnailing_service: localStorage.getItem('thumbnailing_service').replace('[URL]', encodeURIComponent(bookmark.url)),
          title: bookmark.title,
        });
    }

    function genFolder(bookmark) {
      var tpl =
        '<div class="column">'+
            '<figure class="bookmark" data-sort="{id}">'+
              '<div class="bookmark__img--folder"></div>'+
              '<figcaption class="bookmark__caption">'+
                '<div class="bookmark__control">'+
                  '<div class="bookmark__edit" data-bookmark="folder" data-title="{title}" data-id="{id}"></div>'+
                  '<div class="bookmark__divider"></div>'+
                  '<div class="bookmark__del--folder" data-id="{id}"></div>'+
                '</div>'+
                '<div class="bookmark__bottom">'+
                  '<div class="bookmark__title">{title}</div>'+
                '</div>'+
                '<a class="bookmark__link" href="#{url}" title="{title}"></a>'+
              '</figcaption>'+
            '</figure>'+
        '</div>';
        return templater(tpl, {
          id: bookmark.id,
          url: bookmark.id,
          title: bookmark.title,
        });
    }

    function render(_array) {
      var arr = [];
      _array.forEach(function(bookmark) {
        if(bookmark.url !== undefined) {
          arr.push(genBookmark(bookmark));
        }
        if(bookmark.children !== undefined) {
          arr.push(genFolder(bookmark));
        }
      });
      container.innerHTML = arr.join('');
    }

    function createSpeedDial(id) {
      var arr = [];
      bk.getSubTree(id, function(item) {
        if(item !== undefined) {
          render(item[0].children);
          container.setAttribute('data-folder', id);
          var createColumn = document.createElement('div');
          createColumn.className = 'column--nosort';
          createColumn.innerHTML = '<div class="bookmark--create"><div class="bookmark__img--add"></div><a class="bookmark__link--create" id="add"></a></div>';
          container.appendChild(createColumn);
        }
        else {
          notifications('Can\'t find folder by id. Maybe you have not synced bookmarks', 15000);
        }
      })
    }

    function search(evt) {
      var value = evt.target.value.trim().toLowerCase();
      var arr = [];
      bk.search(value, function(match) {
        if(match.length > 0) {
          if(localStorage.getItem('drag_and_drop') === 'true') {
            sort.option('disabled', true);
          }
          render(match);
        }
        else {
          if(localStorage.getItem('drag_and_drop') === 'true') {
            sort.option('disabled', false);
          }
          createSpeedDial(startFolder());
        }
      })
    }

    function changeFolder(evt) {
      var id = this.value;
      window.location.hash = '#' + id;
      createSpeedDial(id);
    }

    function removeBookmark(evt) {
      evt.preventDefault();
      var target = evt.target;
      var bookmark = target.closest('.column');
      if(confirm('Are you sure you want to delete the bookmark ?', '')) {
        var id = target.getAttribute('data-id');
        bk.remove(id, function() {
          bookmark.parentNode.removeChild(bookmark);
          notifications('Bookmark removed.');
        })
      }
    }

    function removeFolder(evt) {
      evt.preventDefault();
      var target = evt.target;
      var bookmark = target.closest('.column');
      if(confirm('Are you sure you want to delete the folder and all its contents ?', '')) {
        var id = target.getAttribute('data-id');
        bk.removeTree(id, function() {
          bookmark.parentNode.removeChild(bookmark);
          generateFolderList();
          notifications('Folder removed.');
        })
      }
    }

    function isValidUrl(url) {
      //The regex used in AngularJS to validate a URL + chrome internal pages & extension url & on-disk files
      var URL_REGEXP = /^(http|https|ftp|file|chrome|chrome-extension):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
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
      var hash = buildBookmarkHash(title, url);
      if (hash !== undefined) {
        hash.parentId = container.getAttribute('data-folder');
        bk.create(hash, function(result) {
          var html;
          if(result.url) {
            html = genBookmark(result);
          } else {
            html = genFolder(result);
          }
          getEl('.column--nosort', container).insertAdjacentHTML('beforeBegin', html);
        });
        return true;
      }
      // else {
        alert("- Adding a new Folder only requires a Title \n- Adding a new Bookmark requires both a Title and a URL");
        return false
      // }
    }

    function updateBookmark(id, title, url) {
      var hash = buildBookmarkHash(title, url);
      var bookmark = getEl('[data-sort="'+ id +'"]');
      var dataEdit = getEl('.bookmark__edit', bookmark);
      //Actually make sure the URL being modified is valid instead of always
      //prepending http:// to it creating new valid+invalid bookmark
      if (url.length !== 0 && !isValidUrl(url)) {
        hash = undefined;
      }
      if (hash !== undefined) {
        chrome.bookmarks.update(id, hash, function(result) {
          getEl('.bookmark__link', bookmark).href = (result.url) ? result.url : '#' + result.id;
          getEl('.bookmark__title', bookmark).textContent = result.title;
          getEl('.bookmark__link', bookmark).title = result.title;
          notifications('Bookmark updated');
        });
        return true;
      }
      alert("Editing an existing Bookmark requires both a Title and a valid URL in Chrome\n\n" +
        "For example, valid URL's start with: \n - http:// \n - https:// \n - ftp://");
      return false;
    }

    return {
      init: init
    };

  })();

/**
 * UI
 */

var UI = (function() {
  return {
    setBG: function () {
      var body = document.body;
      body.style.backgroundColor = localStorage.getItem('background_color');
      if(localStorage.getItem('background_image') !== '') {
        var bgEl = getEl('#bg'),
            src = localStorage.getItem('background_image'),
            image = new Image();
        image.onload = function() {
          bgEl.style.backgroundImage = 'url(' + src + ')';
          bgEl.style.opacity = 1;
          bgEl = image = null;
        }
        image.src = src;
      }
    },
    calculateStyles: function() {
      if(window.innerWidth < 768) { return (getEl('#generateStyles').innerHTML = ''); }
      var ratio = 4 / 3,
      container = Math.floor(getEl('#includeThree').offsetWidth),
      styles    = getEl('#generateStyles'),
      colWidth  = Math.floor(container / localStorage.getItem('dial_columns')),
      colHeight = colWidth / ratio;

      styles.innerHTML = '.column, .column--nosort {width: ' + colWidth + 'px; height: ' + colHeight + 'px}';

    }
  }
})();



/**
 * Modal
 */
var Modal = (function() {
  var isActive = null;
  var overlay = getEl('#modal-overlay');
  var modal = getEl('#modal');
  var form = getEl('#formBookmark');
  var modalHead = getEl('#modalHead');
  var titleField = getEl('#title');
  var urlField = getEl('#url');
  var main = getEl('#main');
  var pageY;

  return {
    show: function(action, title, url) {
      if(isActive) return;

      // if action not New show modal edit
      if(action !== 'New') {
        modalHead.textContent = 'Edit bookmark - ' + title
        titleField.value = title;
        if(url) {
          urlField.style.display = '';
          urlField.value = url;
        }
        else {
          urlField.style.display = 'none';
        }
      }
      else {
        setTimeout(function() {
          titleField.focus();
        }, 100);
        modalHead.textContent = 'Add bookmark';
        urlField.style.display = '';
        titleField.value = '';
        urlField.value = '';
      }
      form.setAttribute('data-action', action);
      pageY = window.pageYOffset;
      main.style.top = -pageY + 'px';
      addClass('fixed', main);
      addClass('modal--show', overlay);
      addClass('modal--show', modal);
      isActive = true;
    },
    hide: function() {
      if(!isActive) return;
      removeClass('fixed', main);
      main.style.top = '';
      window.scrollTo(0, pageY);
      removeClass('modal--show', overlay);
      removeClass('modal--show', modal);
      isActive = null;
    }
  };
})();



bookmarks.init();
UI.setBG();
UI.calculateStyles();

window.addEventListener('resize', function() {
  UI.calculateStyles();
}, false);

getEl('.icon-back__link').addEventListener('click', function(evt) {
  evt.preventDefault();
  window.history.back();
})

})(this);