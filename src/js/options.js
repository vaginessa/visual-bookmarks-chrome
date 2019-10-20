import '../css/bookmark.css';

import TabsSlider from 'tabs-slider';
import FS from './components/fs';
import Settings from './components/settings';
import UI from './components/ui';
import Localization from './components/localization';
import Ripple from './components/ripple';
import Helpers from './components/helpers';
import AutosizeTextarea from './components/autosizeTextarea';

// Set lang attr
// Replacement underscore on the dash because underscore is not a valid language subtag
document.documentElement.setAttribute('lang', chrome.i18n.getMessage('@@ui_locale').replace('_', '-'));

UI.toggleTheme();

Localization();

Ripple.init('.md-ripple');

// Tabs
const tabs = document.querySelector('.tabs');
let tabsSlider = new TabsSlider(tabs, {
  draggable: false,
  slide: parseInt(localStorage['option_tab_slide']) || 0
});
tabs.addEventListener('tabChange', function(evt) {
  localStorage['option_tab_slide'] = evt.detail.currentIndex;
});

// textarea autosize
const textarea = new AutosizeTextarea('#custom_style');
textarea.el.addEventListener('textarea-autosize', function() {
  tabsSlider.recalcStyles();
});

const Options = (() => {

  function init() {

    FS.init(500);
    Settings.init();

    document.getElementById('background_image').addEventListener('change', selectBg, false);

    getOptions();

    const manifest = chrome.runtime.getManifest();
    document.getElementById('ext_name').textContent = manifest.name;
    document.getElementById('ext_version').textContent = `${chrome.i18n.getMessage('version')} ${manifest.version}`;

    // Delegate change settings
    document.querySelector('.tabs').addEventListener('change', setOptions);

    // actions with a local picture
    document.getElementById('bgFile').addEventListener('change', uploadFile, false);
    document.getElementById('background_local').addEventListener('click', removeFile, false);

    document.getElementById('restore_local').addEventListener('click', restoreLocalOptions, false);
    document.getElementById('restore_sync').addEventListener('click', clearSyncData, false);
    document.getElementById('enable_sync').addEventListener('change', checkEnableSync, false);
    document.getElementById('clear_images').addEventListener('click', deleteImages, false);

    document.getElementById('export').addEventListener('click', exportSettings, false);
    document.getElementById('import').addEventListener('change', importSettings, false);
  }

  function importSettings(e) {
    const input = e.target;
    if (input.files && input.files[0]) {
      const reader = new FileReader();

      reader.addEventListener('load', function(e) {
        try {
          const settings = JSON.parse(e.target.result);
          Object.keys(settings).forEach(setting => {
            localStorage.setItem(setting, settings[setting]);
          });
          Helpers.notifications(
            chrome.i18n.getMessage('import_settings_success')
          );
          setTimeout(() => {
            location.reload();
          }, 0);
        } catch (error) {
          Helpers.notifications(
            chrome.i18n.getMessage('import_settings_failed')
          );
          input.value = '';
          console.warn(error);
        }
      });
      reader.readAsBinaryString(input.files[0]);
    }

  }

  function exportSettings() {
    const data = Object.keys(localStorage).reduce((acc, cur) => {
      if (
        ![
          'default_folder_id',
          'custom_dials',
          'background_local',
        ].includes(cur)
      ) {
        acc[cur] = localStorage[cur];
      }
      return acc;
    }, {});

    const file = new Blob([JSON.stringify(data)], {type: 'text/plain'});
    // TODO: permission is required to download
    // chrome.downloads.download({
    //   url: URL.createObjectURL(file),
    //   filename: 'visual-bookmarks-settings.backup'
    // });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = 'visual-bookmarks-settings.backup';
    a.click();
    a.remove();
  }

  function getOptions() {
    generateFolderList();

    const optionBg = document.getElementById('background_image');
    const options = Array.prototype.slice.call(optionBg.querySelectorAll('option'));
    options.forEach(function(item) {
      if (item.value === localStorage.getItem('background_image')) {
        item.selected = true;
        Helpers.trigger('change', optionBg);
        return;
      }
    });

    for (let id of Object.keys(localStorage)) {
      const elOption = document.getElementById(id);

      // goto next if element not type
      if (!elOption || !elOption.type) continue;

      if (/checkbox|radio/.test(elOption.type)) {
        elOption.checked = localStorage.getItem(id) === 'true';
      } else {
        elOption.value = localStorage.getItem(id);
        // Triggering event at program input to the textarea(for autosize textarea)
        if (elOption === textarea.el) {
          Helpers.trigger('input', textarea.el);
        }
      }
    }
  }

  function setOptions(e) {
    const target = e.target.closest('.js-change');
    if (!target) return;

    const id = target.id;

    if (/checkbox|radio/.test(target.type)) {
      localStorage.setItem(id, target.checked);
    } else {
      localStorage.setItem(id, target.value);

    }

    // dark theme
    if (target.id === 'dark_theme') {
      UI.toggleTheme();
    }

    if (target.id === 'show_contextmenu_item') {
      const state = target.checked.toString();
      chrome.runtime.sendMessage({ showContextMenuItem: state });
    }

    if (localStorage.getItem('enable_sync') === 'true' && id !== 'enable_sync') {
      Settings.syncToStorage();
    }
  }

  function uploadFile() {
    const file = this.files[0];
    if (!file) return;

    this.closest('form').reset();

    if (!/image\/(jpe?g|png)$/.test(file.type)) {
      return alert(chrome.i18n.getMessage('alert_file_type_fail'));
    }
    const fileName = `background.${file.type.replace('image/', '')}`;

    FS.createDir('images', function() {
      FS.createFile('/images/' + fileName, { file: file, fileType: file.type }, function(fileEntry) {
        document.querySelector('.c-upload__preview').style.display = '';
        document.getElementById('preview_upload').innerHTML = `
          <div class="c-upload__preview-image"
               style="background-image: url(${fileEntry.toURL()}?new=${Date.now()});">
          <div>
        `;
        localStorage.setItem('background_local', fileEntry.toURL());
        Helpers.notifications(
          chrome.i18n.getMessage('notice_bg_image_updated')
        );
        tabsSlider.recalcStyles();
      });
    });

  }

  function removeFile(evt) {
    const target = evt.target.closest('#delete_upload');
    if (!target) return;

    if (!confirm(chrome.i18n.getMessage('confirm_delete_image'), '')) return;

    evt.preventDefault();
    const preview = document.getElementById('preview_upload');
    const previewParent = preview.closest('.c-upload__preview');
    const img = localStorage.getItem('background_local');

    if (!img) return;

    const name = img.split('/').pop();

    FS.deleteFile(`/images/${name}`, function() {
      Helpers.notifications(
        chrome.i18n.getMessage('notice_image_removed')
      );
      localStorage.removeItem('background_local');
      preview.innerHTML = '';
      previewParent.style.display = 'none';
      tabsSlider.recalcStyles();
    });
  }

  function selectBg() {

    Array.prototype.slice.call(document.querySelectorAll('.tbl__option')).forEach(function(item) {
      item.style.display = '';
    });

    if (this.value === 'background_local') {
      const imgSrc = localStorage.getItem('background_local');
      if (imgSrc) {
        document.querySelector('.c-upload__preview').style.display = '';
        document.getElementById('preview_upload').innerHTML = `
          <div class="c-upload__preview-image" style="background-image: url(${imgSrc}?new=${Date.now()});"><div>
        `;
      } else {
        document.querySelector('.c-upload__preview').style.display = 'none';
        document.getElementById('preview_upload').innerHTML = '';
      }
    }

    // localStorage.setItem('background_image', this.value);
    document.getElementById(this.value).style.display = 'block';
    tabsSlider.recalcStyles();
  }

  function deleteImages(evt) {
    evt.preventDefault();
    if (!confirm(chrome.i18n.getMessage('confirm_delete_images'), '')) return;

    FS.purge();
    Helpers.notifications(chrome.i18n.getMessage('notice_images_removed'));
    localStorage.setItem('background_local', '');
    localStorage.setItem('custom_dials', '{}');
  }

  function restoreLocalOptions() {
    if (confirm(chrome.i18n.getMessage('confirm_restore_default_settings'), '')) {
      // localStorage.clear();

      Object.keys(localStorage).forEach(function(property) {
        if (property === 'background_local' || property === 'custom_dials') {
          return;
        }
        localStorage.removeItem(property);
      });
      Settings.init();
      UI.toggleTheme();
      getOptions();
      Helpers.notifications(
        chrome.i18n.getMessage('notice_reset_default_settings')
      );
    }
  }
  function clearSyncData() {
    if (confirm(chrome.i18n.getMessage('confirm_clear_sync_settings'), '')) {
      chrome.storage.sync.clear(() => {
        Helpers.notifications(
          chrome.i18n.getMessage('notice_sync_settings_cleared')
        );
        // after cleaning, if synch is enabled, force to synch the current settings
        if (localStorage.getItem('enable_sync') === 'true') {
          Settings.syncToStorage();
        }
      });
    }
  }
  function checkEnableSync() {
    if (this.checked) {
      chrome.storage.sync.getBytesInUse(null, bytes => {
        if (bytes > 0) {
          if (confirm(chrome.i18n.getMessage('confirm_sync_remote_settings'), '')) {
            Settings.restoreFromSync(getOptions);
            // window.location.reload();
          } else {
            this.checked = false;
            localStorage.setItem('enable_sync', 'false');
          }
        } else {
          Settings.syncToStorage();
        }
      });
    }
  }

  function generateFolderList() {
    const select = document.getElementById('default_folder_id');
    select.innerHTML = '';
    chrome.bookmarks.getTree(function(rootNode) {
      let folderList = [], openList = [], node, child;
      // Never more than 2 root nodes, push both Bookmarks Bar & Other Bookmarks into array
      // openList.push(rootNode[0].children[0]);
      // openList.push(rootNode[0].children[1]);
      // root folders
      openList = rootNode[0].children.map(item => {
        return item;
      });

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
      const folderId = localStorage.getItem('default_folder_id');
      folderList.forEach(function(item) {
        arr.push(`<option${item.id === folderId ? ' selected' : ''} value="${item.id}">${item.path}</option>`);
      });
      select.innerHTML = arr.join('');
    });
  }

  return {
    init: init
  };

})();

Options.init();
