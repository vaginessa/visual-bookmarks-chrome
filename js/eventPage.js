// Restore settings from chrome.storage.sync API
function restoreFromSync(cb) {
  chrome.storage.sync.get(function (sync_object) {
    Object.keys(sync_object).forEach(function(key) {
      localStorage.setItem(key, sync_object[key]);
    });
    cb && cb();
  });
}

// Sync settings to chrome.storage.sync API
function syncToStorage() {
  var settings_object = {};
  Object.keys(localStorage).forEach(function(key) {
    settings_object[key] = localStorage[key];
  });
  chrome.storage.sync.set(settings_object);
}

// Listen for sync events and update from synchronized data
if (localStorage.getItem('enable_sync') === 'true') {
  chrome.storage.onChanged.addListener(function(obj, areaName) {
    restoreFromSync();
    window.location.reload();
  });
}