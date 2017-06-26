import css from '../css/bookmark.css';

import './components/polyfill';
import FS from './components/fs';
import Settings from './components/settings';
import Localization from './components/localization';
import Helpers from './components/helpers';

Localization();

const Options = (() => {

  function init() {

    FS.init(500);
    Settings.init();

    document.getElementById('option_bg').addEventListener('change', selectBg, false);
    document.getElementById('bgFile').addEventListener('change', uploadFile, false);
    document.getElementById('background_local').addEventListener('click', removeFile, false);

    getOptions();

    const manifest = chrome.runtime.getManifest();
    document.getElementById('ext_name').textContent = manifest.name;
    document.getElementById('ext_version').textContent = `${chrome.i18n.getMessage('version')} ${manifest.version}`;

    const advanced = document.querySelector('.advanced');
    document.getElementById('advanced').addEventListener('change', function() {
      (this.checked)
        ? advanced.classList.add('show-advanced')
        : advanced.classList.remove('show-advanced');
    }, false);

    document.getElementById('save').addEventListener('click', setOptions, false);
    document.getElementById('restore_local').addEventListener('click', restoreLocalOptions, false);
    document.getElementById('restore_sync').addEventListener('click', clearSyncData, false);
    document.getElementById('enable_sync').addEventListener('change', checkEnableSync, false);
    document.getElementById('clear_images').addEventListener('click', deleteImages, false);
  }

  function getOptions() {
    generateFolderList();

    document.getElementById('dial_columns').value = localStorage.getItem('dial_columns');
    document.getElementById('background_color').value = localStorage.getItem('background_color');

    const optionBg = document.getElementById('option_bg');
    const options = Array.prototype.slice.call(optionBg.querySelectorAll('option'));

    options.forEach(function(item) {
      if (item.value === localStorage.getItem('background_image')) {
        item.selected = true;
        Helpers.trigger('change', optionBg);
        return;
      }
    });

    document.getElementById('background_external').value = localStorage.getItem('background_external');
    document.getElementById('thumbnailing_service').value = localStorage.getItem('thumbnailing_service');
    document.getElementById('drag_and_drop').checked = localStorage.getItem('drag_and_drop') === "true";
    document.getElementById('show_toolbar').checked = localStorage.getItem('show_toolbar') === "true";
    document.getElementById('show_favicon').checked = localStorage.getItem('show_favicon') === "true";
    document.getElementById('enable_sync').checked = localStorage.getItem('enable_sync') === "true";
  }

  function setOptions() {
    localStorage.setItem('dial_columns', document.getElementById('dial_columns').value);
    localStorage.setItem('default_folder_id', document.getElementById('selectFolder').value);
    localStorage.setItem('background_color', document.getElementById('background_color').value);
    localStorage.setItem('background_external', document.getElementById('background_external').value);
    localStorage.setItem('thumbnailing_service', document.getElementById('thumbnailing_service').value);
    localStorage.setItem('drag_and_drop', document.getElementById('drag_and_drop').checked);
    localStorage.setItem('show_toolbar', document.getElementById('show_toolbar').checked);
    localStorage.setItem('show_favicon', document.getElementById('show_favicon').checked);
    localStorage.setItem('enable_sync', document.getElementById('enable_sync').checked);
    if (localStorage.getItem('enable_sync') === 'true') {
      Settings.syncToStorage();
    }
    Helpers.notifications(
      chrome.i18n.getMessage('notice_save_settings_success')
    );
    getOptions();
  }

  function uploadFile(evt) {
    const file = this.files[0];
    if (!file) return;

    this.closest('form').reset();

    if (! /image\/(jpe?g|png)$/.test(file.type)) {
      return alert(chrome.i18n.getMessage('alert_file_type_fail'));
    }
    const fileName = `background.${file.type.replace('image/', '')}`;

    FS.createDir('images', function (dirEntry) {
      FS.createFile('/images/' + fileName, { file: file, fileType: file.type }, function (fileEntry) {
        document.querySelector('.c-upload__preview').style.display = '';
        document.getElementById('preview_upload').innerHTML = `<img class="img-fluid" src="${fileEntry.toURL()}?new=${Helpers.rand(1, 99999)}" alt="">`;
        localStorage.setItem('background_local', fileEntry.toURL());
        Helpers.notifications(
          chrome.i18n.getMessage('notice_bg_image_updated')
        );
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
    });
  }

  function selectBg(evt) {

    Array.prototype.slice.call(document.querySelectorAll('.tbl__option')).forEach(function(item) {
      item.style.display = '';
    });

    if (this.value === 'background_local') {
      const imgSrc = localStorage.getItem('background_local');
      if (imgSrc) {
        document.querySelector('.c-upload__preview').style.display = '';
        document.getElementById('preview_upload').innerHTML = `<img class="img-fluid" src="${imgSrc}" alt="">`;
      } else {
        document.querySelector('.c-upload__preview').style.display = 'none';
        document.getElementById('preview_upload').innerHTML = '';
      }
    }

    localStorage.setItem('background_image', this.value);
    document.getElementById(this.value).style.display = 'block';
  }

  function deleteImages(evt) {
    evt.preventDefault();
    if(!confirm(chrome.i18n.getMessage('confirm_delete_images'), '')) return;

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
      getOptions();
      Helpers.notifications(
        chrome.i18n.getMessage('notice_reset_default_settings')
      );
    }
  }
  function clearSyncData() {
    if (confirm(chrome.i18n.getMessage('confirm_clear_sync_settings'), '')) {
      chrome.storage.sync.clear(
        Helpers.notifications(
          chrome.i18n.getMessage('notice_sync_settings_cleared')
        )
      );
    }
  }
  function checkEnableSync() {
    if (this.checked) {
      chrome.storage.sync.getBytesInUse(null, function(bytes) {
        if (bytes > 0) {
          if (confirm(chrome.i18n.getMessage('confirm_sync_remote_settings'), '')) {
            Settings.restoreFromSync(getOptions);
          }
        }
      });
    }
  }

  function generateFolderList() {
    const select = document.getElementById('selectFolder');
    select.innerHTML = '';
    chrome.bookmarks.getTree(function(rootNode) {
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
      folderList.sort(function (a, b) {
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
  }

})();

Options.init();
