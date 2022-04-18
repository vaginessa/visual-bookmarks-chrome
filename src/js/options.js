import '../css/options.css';
import './components/vb-select';
import Gmodal from 'glory-modal';
import TabsSlider from 'tabs-slider';
import FS from './api/fs';
import { settings } from './settings';
import UI from './components/ui';
import Localization from './plugins/localization';
import Ripple from './components/ripple';
import AutosizeTextarea from './components/autosizeTextarea';
import Toast from './components/toast';
import confirmPopup from './plugins/confirmPopup.js';
import { getFolders } from './api/bookmark';
import {
  $notifications,
  $trigger
} from './utils';
import Range from './components/range';

let modalInstance = null;
let tabsSliderInstance = null;
let textareaInstance = null;

async function init() {
  await FS.init(500);
  // Set lang attr
  // Replacement underscore on the dash because underscore is not a valid language subtag
  document.documentElement.setAttribute('lang', chrome.i18n.getMessage('@@ui_locale').replace('_', '-'));

  // Settings.init();
  await settings.init();

  UI.toggleTheme();

  Localization();

  Ripple.init('.md-ripple');

  // range settings
  Array.from(document.querySelectorAll('.js-range')).forEach(el => {
    const id = el.id;
    new Range(el, {
      value: settings.$[id],
      postfix: el.dataset.outputPostfix,
      onBlur(e) {
        const { value } = e.target;
        settings.updateKey(id, value);
      },
      ...('thumbnails_update_delay' === id) && {
        format(value) {
          return parseFloat(value).toFixed(1);
        }
      }
    });
  });

  // Tabs
  const tabs = document.querySelector('.tabs');
  tabsSliderInstance = new TabsSlider(tabs, {
    draggable: false,
    slide: parseInt(localStorage['option_tab_slide']) || 0
  });

  // textarea autosize
  textareaInstance = new AutosizeTextarea('#custom_style');

  // Modal
  modalInstance = new Gmodal(document.getElementById('modal'), {
    closeBackdrop: false
  });

  const manifest = chrome.runtime.getManifest();
  document.getElementById('ext_name').textContent = manifest.name;
  document.getElementById('ext_version').textContent = `${chrome.i18n.getMessage('version')} ${manifest.version}`;
  document.getElementById('modal_changelog_version').textContent = manifest.version;

  getOptions();

  tabs.addEventListener('tabChange', function(evt) {
    localStorage['option_tab_slide'] = evt.detail.currentIndex;
  });
  textareaInstance.el.addEventListener('textarea-autosize', function() {
    tabsSliderInstance.recalcStyles();
  });

  // Delegate change settings
  document.querySelector('.tabs').addEventListener('change', handleSetOptions);
  document.getElementById('background_image').addEventListener('change', handleSelectBackground);
  document.getElementById('background_local').addEventListener('click', handleRemoveFile);
  document.getElementById('restore_local').addEventListener('click', handleResetLocalSettings);
  document.getElementById('restore_sync').addEventListener('click', handleResetSyncSettings);
  document.getElementById('enable_sync').addEventListener('change', handleChangeSync);
  document.getElementById('clear_images').addEventListener('click', handleDeleteImages);

  document.getElementById('export').addEventListener('click', handleExportSettings);
  document.getElementById('import').addEventListener('change', handleImportSettings);
  document.getElementById('bgFile').addEventListener('change', handleUploadFile);
  document.querySelector('.info-btn').addEventListener('click', () => {
    modalInstance.open();
  });
}

function handleImportSettings(e) {
  const input = e.target;
  if (input.files && input.files[0]) {
    const reader = new FileReader();

    reader.addEventListener('load', async(e) => {
      try {
        const importSettings = JSON.parse(e.target.result);
        await settings.updateAll(importSettings);
        // Object.keys(settings).forEach(setting => {
        //   localStorage.setItem(setting, settings[setting]);
        // });
        $notifications(
          chrome.i18n.getMessage('import_settings_success')
        );
        setTimeout(() => {
          location.reload();
        }, 0);
      } catch (error) {
        Toast.show(chrome.i18n.getMessage('import_settings_failed'));
        input.value = '';
        console.warn(error);
      }
    });
    reader.readAsBinaryString(input.files[0]);
  }

}

function handleExportSettings() {
  const data = Object.keys(settings.$).reduce((acc, cur) => {
    if (
      ![
        'default_folder_id',
        'custom_dials',
        'background_local',
      ].includes(cur)
    ) {
      acc[cur] = settings.$[cur];
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

  const optionBackgroundSelect = document.getElementById('background_image');
  optionBackgroundSelect.value = settings.$.background_image;
  toggleBackgroundControls(settings.$.background_image);

  for (let id of Object.keys(settings.$)) {
    const elOption = document.getElementById(id);

    // goto next if element not type
    if (!elOption || !elOption.type) continue;

    if (/checkbox|radio/.test(elOption.type)) {
      elOption.checked = settings.$[id];
    } else {
      elOption.value = settings.$[id];

      // update range slider
      if (elOption.type === 'range') {
        $trigger('change', elOption);
      }


      // Triggering event at program input to the textarea(for autosize textarea)
      if (elOption === textareaInstance.el) {
        $trigger('input', textareaInstance.el);
      }
    }
  }
}

/**
 * Toggle background settings
 * @param {string} value - localStorage background_image value
 */
function toggleBackgroundControls(value) {
  Array.from(document.querySelectorAll('.js-background-settings')).forEach((item) => {
    item.hidden = true;
  });
  if (value === 'background_local') {
    // TODO: indexDB instead localStorage
    const imgSrc = localStorage.getItem('background_local');
    if (imgSrc) {
      document.querySelector('.c-upload__preview').hidden = false;
      document.getElementById('preview_upload').innerHTML = `
          <div class="c-upload__preview-image" style="background-image: url(${imgSrc}?new=${Date.now()});"><div>
        `;
    } else {
      document.querySelector('.c-upload__preview').hidden = true;
      document.getElementById('preview_upload').innerHTML = '';
    }
  }
  document.getElementById(value).hidden = false;
  tabsSliderInstance.recalcStyles();
}

function handleSetOptions(e) {
  const target = e.target.closest('.js-change');
  if (!target) return;

  const id = target.id;

  if (/checkbox|radio/.test(target.type)) {
    settings.updateKey(id, target.checked);

    // Settings that depend on each other.
    // When enabling one setting, the related setting must be disabled
    if (target.dataset.relationToggleId) {
      const id = target.dataset.relationToggleId;
      const relationEl = document.getElementById(id);
      // disable the related option only if it was initially enabled
      if (relationEl.checked) {
        relationEl.checked = !target.checked;
        settings.updateKey(id, !target.checked);
      }
    }

  } else {
    // localStorage.setItem(id, target.value);
    settings.updateKey(id, target.value);
  }

  // dark theme
  if (target.id === 'color_theme') {
    UI.toggleTheme();
  }
}

async function handleUploadFile() {
  const file = this.files[0];
  if (!file) return;

  this.closest('form').reset();

  if (!/image\/(jpe?g|png|webp)$/.test(file.type)) {
    return alert(chrome.i18n.getMessage('alert_file_type_fail'));
  }
  const fileName = `background.${file.type.replace('image/', '')}`;

  await FS.createDir('images');
  const fileEntry = await FS.createFile('/images/' + fileName, { file: file, fileType: file.type }).catch(err => err);

  document.querySelector('.c-upload__preview').hidden = false;
  document.getElementById('preview_upload').innerHTML = `
          <div class="c-upload__preview-image"
            style="background-image: url(${fileEntry.toURL()}?new=${Date.now()});">
          <div>
        `;
  localStorage.setItem('background_local', fileEntry.toURL());
  Toast.show(chrome.i18n.getMessage('notice_bg_image_updated'));
  tabsSliderInstance.recalcStyles();
}

async function handleRemoveFile(evt) {
  const target = evt.target.closest('#delete_upload');
  if (!target) return;

  const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_delete_image'));
  if (!confirmAction) return;

  evt.preventDefault();
  const preview = document.getElementById('preview_upload');
  const previewParent = preview.closest('.c-upload__preview');
  const img = localStorage.getItem('background_local');

  if (!img) return;

  const name = img.split('/').pop();

  await FS.removeFile(`/images/${name}`);
  Toast.show(chrome.i18n.getMessage('notice_image_removed'));
  localStorage.removeItem('background_local');
  preview.innerHTML = '';
  previewParent.hidden = true;
  tabsSliderInstance.recalcStyles();
}

function handleSelectBackground() {
  toggleBackgroundControls(this.value);
}

async function handleDeleteImages(evt) {
  evt.preventDefault();

  const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_delete_images'));
  if (!confirmAction) return;

  await FS.purge();
  Toast.show(chrome.i18n.getMessage('notice_images_removed'));
  localStorage.setItem('background_local', '');
  localStorage.setItem('custom_dials', '{}');
}

async function handleResetLocalSettings() {
  const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_restore_default_settings'));
  if (!confirmAction) return;

  await settings.resetLocal();

  UI.toggleTheme();
  getOptions();
  Toast.show(chrome.i18n.getMessage('notice_reset_default_settings'));
}
async function handleResetSyncSettings() {
  const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_clear_sync_settings'));
  if (!confirmAction) return;

  await settings.resetSync();
  Toast.show(chrome.i18n.getMessage('notice_sync_settings_cleared'));
}
function handleChangeSync() {
  if (this.checked) {
    chrome.storage.sync.getBytesInUse(null, async(bytes) => {
      if (bytes > 0) {
        const confirmAction = await confirmPopup(chrome.i18n.getMessage('confirm_sync_remote_settings'));

        if (confirmAction) {
          await settings.restoreFromSync();
          getOptions();
          UI.toggleTheme();
        } else {
          this.checked = false;
          settings.updateKey('enable_sync', false);
        }
      } else {
        settings.syncToStorage();
      }
    });
  }
}

async function generateFolderList() {
  const folders = await getFolders().catch(err => console.warn(err));
  if (folders) {
    const vbSelect = document.getElementById('default_folder_id');
    // vbSelect.value = localStorage.getItem('default_folder_id');
    vbSelect.value = settings.$.default_folder_id;
    vbSelect.folders = folders;
  }
}

init();
