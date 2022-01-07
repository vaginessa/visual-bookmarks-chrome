import { $uid } from './utils';

const DEFAULTS = {
  color_theme: 'os',
  background_image: 'background_noimage',
  background_external: '',
  default_folder_id: 1,
  dial_columns: 7,
  dial_width: 70, // value in percent (50,60,70,80,90)
  vertical_center: false,
  sort_by_newest: false,
  drag_and_drop: true,
  auto_generate_thumbnail: true,
  enable_sync: false,
  show_toolbar: true,
  show_contextmenu_item: true,
  show_settings_icon: true,
  show_create_column: true,
  show_bookmark_title: true,
  show_favicon: true,
  open_link_newtab: false,
  thumbnails_update_button: true,
  thumbnails_update_recursive: false,
  thumbnails_update_delay: 0.5,
  custom_style: '',
  without_confirmation: false,
  services_enable: false,
  services_list: [
    { id: $uid(), name: 'youtube', link: 'https://www.youtube.com' },
    { id: $uid(), name: 'search', link: 'https://google.com' },
    { id: $uid(), name: 'translate', link: 'https://translate.google.com' },
    { id: $uid(), name: 'gmail', link: 'https://mail.google.com/mail' },
    { id: $uid(), name: 'drive', link: 'https://drive.google.com/' },
    { id: $uid(), name: 'photos', link: 'https://photos.google.com' }
  ],
  folder_preview: false,
  close_tab_after_adding_bookmark: false
};

export default {
  init() {
    // Creates default localStorage values if they don't already exist
    Object.keys(DEFAULTS).forEach(function(name) {
      if (localStorage.getItem(name) === null) {
        const value = (name === 'services_list')
          ? JSON.stringify(DEFAULTS[name])
          : DEFAULTS[name];

        localStorage.setItem(name, value);
      }
    });

    // Replace option thumbnailing_service
    const arr = [
      'http://free.pagepeeker.com/v2/thumbs.php?size=x&url=[URL]',
      'http://api.webthumbnail.org/?width=500&height=400&screen=1280&url=[URL]'
    ];
    if (arr.indexOf(localStorage.getItem('thumbnailing_service')) > -1) {
      localStorage.setItem('thumbnailing_service', DEFAULTS['thumbnailing_service']);
    }
  },
  restoreFromSync(cb) {
    chrome.storage.sync.get(function(sync_object) {
      Object.keys(sync_object).forEach(function(key) {
        // because of different id`s on different computers, we will exclude the default folder from synchronization
        if (key !== 'default_folder_id') {
          localStorage.setItem(key, sync_object[key]);
        }
      });
      cb && cb();
    });
  },
  syncToStorage() {
    let settings_object = {};
    Object.keys(DEFAULTS).forEach(function(key) {
      // because of different id`s on different computers, we will exclude the default folder from synchronization
      if (localStorage[key] && key !== 'default_folder_id') {
        settings_object[key] = localStorage[key];
      }
    });
    chrome.storage.sync.set(settings_object);
  },
  syncSingleToStorage(key) {
    let settings_object = {};
    if (localStorage[key] && key !== 'default_folder_id') {
      settings_object[key] = localStorage[key];
    }
    chrome.storage.sync.set(settings_object);
  }
};
