const Settings = (() => {

  let default_values = {
    background_color: "#f7f7f7",
    background_image: "background_color",
    background_external: "",
    default_folder_id: 1,
    dial_columns: 5,
    drag_and_drop: "true",
    auto_generate_thumbnail: "true",
    enable_sync: "false",
    show_toolbar: "true",
    show_favicon: "true",
    thumbnailing_service: "http://free.pagepeeker.com/v2/thumbs.php?size=x&url=[URL]"
  };

  function init() {
    // Creates default localStorage values if they don't already exist
    Object.keys(default_values).forEach(function (name) {
      if (localStorage.getItem(name) === null) {
        localStorage.setItem(name, default_values[name]);
      }
    });

    if (localStorage.getItem('enable_sync') === 'true') {
      chrome.storage.onChanged.addListener(function (obj, areaName) {
        Settings.restoreFromSync();
        window.location.reload();
      });
    }
  }

  function restoreFromSync(cb) {
    chrome.storage.sync.get(function (sync_object) {
      Object.keys(sync_object).forEach(function (key) {
        localStorage.setItem(key, sync_object[key]);
      });
      cb && cb();
    });
  }

  function syncToStorage() {
    let settings_object = {};
    Object.keys(default_values).forEach(function (key) {
      if (localStorage[key]) {
        settings_object[key] = localStorage[key];
      }
    });
    chrome.storage.sync.set(settings_object);
  }

  return {
    init,
    restoreFromSync,
    syncToStorage
  }

})();

export default Settings;
