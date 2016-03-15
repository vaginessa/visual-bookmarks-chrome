/**
 * File options
 * required [eventPage.js, settings.js, helpers.js]
 */
(function(window) {
  'use strict';

  var options = (function() {

    function init() {
      getOptions();

      var manifest = chrome.runtime.getManifest();
      getEl('#ext_name').textContent = manifest.name;
      getEl('#ext_version').textContent = 'Version ' + manifest.version;

      getEl('#advanced').addEventListener('change', function() {
        (this.checked)
          ? addClass('show-advanced', getEl('.advanced'))
          : removeClass('show-advanced', getEl('.advanced'));
      }, false);

      getEl('#save').addEventListener('click', setOptions, false);
      getEl('#restore_local').addEventListener('click', restoreLocalOptions, false);
      getEl('#restore_sync').addEventListener('click', clearSyncData, false);
      getEl('#enable_sync').addEventListener('change', checkEnableSync, false);
    }

    function getOptions() {
      generateFolderList();
      getEl('#dial_columns').value = localStorage.getItem('dial_columns');
      getEl('#background_color').value = localStorage.getItem('background_color');
      getEl('#background_image').value = localStorage.getItem('background_image');
      getEl('#thumbnailing_service').value = localStorage.getItem('thumbnailing_service');
      getEl('#drag_and_drop').checked = localStorage.getItem('drag_and_drop') === "true";
      getEl('#enable_sync').checked = localStorage.getItem('enable_sync') === "true";
    }

    function setOptions() {
      localStorage.setItem('dial_columns', getEl('#dial_columns').value);
      localStorage.setItem('default_folder_id', getEl('#selectFolder').value);
      localStorage.setItem('background_color', getEl('#background_color').value);
      localStorage.setItem('background_image', getEl('#background_image').value);
      localStorage.setItem('thumbnailing_service', getEl('#thumbnailing_service').value);
      localStorage.setItem('drag_and_drop', getEl('#drag_and_drop').checked);
      localStorage.setItem('enable_sync', getEl('#enable_sync').checked);
      if(localStorage.getItem('enable_sync') === 'true') {
        syncToStorage();
      }
      window.location = 'newtab.html';
    }

    function restoreLocalOptions() {
      if(confirm('Are you sure you want to restore default settings ?')) {
        localStorage.clear();
        settings();
        getOptions();
        notifications('Default local settings are reset');
      }
    }
    function clearSyncData() {
      if (confirm("Are you sure you want to delete all previously synchronized data to start fresh?")) {
        chrome.storage.sync.clear(notifications('Data synchronization cleared'));
      }
    }
    function checkEnableSync() {
      if(this.checked) {
        chrome.storage.sync.getBytesInUse(null, function (bytes) {
          if (bytes > 0) {
            if (confirm("You have previously synchronized data!!\n"+
              "Do you want to overwrite your current local settings with your previously saved remote settings?")) {
              restoreFromSync(getOptions);
            }
          }
        });
      }
    }

    function generateFolderList() {
      var select = getEl('#selectFolder');
      select.innerHTML = '';
      chrome.bookmarks.getTree(function(rootNode) {
        var folderList = [], openList = [], node, child;
        // Never more than 2 root nodes, push both Bookmarks Bar & Other Bookmarks into array
        openList.push(rootNode[0].children[0]);
        openList.push(rootNode[0].children[1]);

        while ((node = openList.pop()) !== undefined) {
          if (node.children !== undefined) {
            if (node.parentId === "0") {
              node.path = ''; // Root elements have no parent so we shouldn't show their path
            }
            node.path += node.title;
            while ((child = node.children.pop()) !== undefined) {
              if (child.children !== undefined) {
                child.path = node.path + "/";
                openList.push(child);
              }
            }
            folderList.push(node);
          }
        }
        folderList.sort(function(a, b) {
          return a.path.localeCompare(b.path);
        });
        var frag = document.createDocumentFragment();
        folderList.forEach(function(item) {
          var option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.path;

          if(item.id === localStorage.getItem('default_folder_id')) {
            option.selected = 'selected';
          }
          frag.appendChild(option);
        })
        select.appendChild(frag);
        frag = null;
      })
    }

    return {
      init: init
    }

  })();

  options.init();

})(this);