export const storage = {
  local: {
    get(key) {
      return new Promise(resolve => {
        chrome.storage.local.get(key, resolve);
      });
    },
    set(obj) {
      return new Promise(resolve => {
        chrome.storage.local.set(obj, resolve);
      });
    }
  },
  sync: {
    get(key) {
      return new Promise(resolve => {
        chrome.storage.sync.get(key, resolve);
      });
    },
    set(obj) {
      return new Promise(resolve => {
        chrome.storage.sync.set(obj, resolve);
      });
    }
  }
};
