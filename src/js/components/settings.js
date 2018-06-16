const Settings = (() => {

  let default_values = {
    background_color: '#f7f7f7',
    background_image: 'background_color',
    background_external: '',
    default_folder_id: 1,
    dial_columns: 5,
    dial_width: 70, // value in percent (60,70,80,90)
    vertical_center: 'false',
    drag_and_drop: 'true',
    auto_generate_thumbnail: 'true',
    enable_sync: 'false',
    show_toolbar: 'true',
    show_settings_icon: 'true',
    show_create_column: 'true',
    show_favicon: 'true',
    thumbnailing_service: 'https://logo.clearbit.com/[URL]'
  };

  function init() {
    // Creates default localStorage values if they don't already exist
    Object.keys(default_values).forEach(function(name) {
      if (localStorage.getItem(name) === null) {
        localStorage.setItem(name, default_values[name]);
      }
    });

    // Replace option thumbnailing_service
    const arr = [
      'http://free.pagepeeker.com/v2/thumbs.php?size=x&url=[URL]',
      'http://api.webthumbnail.org/?width=500&height=400&screen=1280&url=[URL]'
    ];
    if (arr.indexOf(localStorage.getItem('thumbnailing_service')) > -1) {
      localStorage.setItem('thumbnailing_service', default_values['thumbnailing_service']);
    }

    // if (localStorage.getItem('enable_sync') === 'true') {
    //   chrome.storage.onChanged.addListener(function(e) {
    //     console.log(e);
    //     // Settings.restoreFromSync();
    //     // window.location.reload();
    //   });
    // }
  }

  function restoreFromSync(cb) {
    chrome.storage.sync.get(function(sync_object) {
      Object.keys(sync_object).forEach(function(key) {
        // because of different id`s on different computers, we will exclude the default folder from synchronization
        if (key !== 'default_folder_id') {
          localStorage.setItem(key, sync_object[key]);
        }
      });
      cb && cb();
    });
  }

  function syncToStorage() {
    let settings_object = {};
    Object.keys(default_values).forEach(function(key) {
      // because of different id`s on different computers, we will exclude the default folder from synchronization
      if (localStorage[key] && key !== 'default_folder_id') {
        settings_object[key] = localStorage[key];
      }
    });
    chrome.storage.sync.set(settings_object);
  }

  return {
    init,
    restoreFromSync,
    syncToStorage
  };

})();

export default Settings;
