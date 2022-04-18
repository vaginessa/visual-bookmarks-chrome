export function getLS(key) {
  let value = null;
  try {
    value = JSON.parse(localStorage[key]);
  } catch (error) {
    value = localStorage[key];
  }
  return value;
}

export function setLS(key, value) {
  if (typeof value === 'object') {
    localStorage[key] = JSON.stringify(value);

  } else {
    localStorage[key] = value;
  }
}

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
