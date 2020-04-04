const API = chrome.bookmarks;
const RUNTIME = chrome.runtime;

const recurseFolders = (arr) => {
  return arr.reduce((accum, current) => {
    if (current.children) {
      accum.push({
        title: current.title,
        id: current.id,
        parentId: current.parentId,
        children: recurseFolders(current.children)
      });
    }
    return accum;
  }, []);
};

export function getThree() {
  return new Promise((resolve, reject) => {
    API.getTree(function(rootNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      const rootFolders = rootNode[0].children.map(item => item);
      resolve(rootFolders);
    });
  });
}

// Retrieves folders
export function getFolders() {
  return new Promise((resolve, reject) => {
    API.getTree(function(rootNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      const root = rootNode[0].children.map(item => item);
      const folders = recurseFolders(root);
      resolve(folders);
    });
  });
}

export function get(id) {
  return new Promise((resolve, reject) => {
    API.get(id, function(BookmarkTreeNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve(BookmarkTreeNode);
    });
  });
}

// Retrieves the children of the specified BookmarkTreeNode id.
export function getChildren(id) {
  return new Promise((resolve, reject) => {
    API.getChildren(id, function(BookmarkTreeNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve(BookmarkTreeNode);
    });
  });
}

// Retrieves part of the Bookmarks hierarchy, starting at the specified node.
export function getSubTree(id) {
  return new Promise((resolve, reject) => {
    API.getSubTree(id, function(BookmarkTreeNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve(BookmarkTreeNode);
    });
  });
}

// Creates a bookmark or folder under the specified parentId. If url is NULL or missing, it will be a folder.
export function create(bookmark) {
  return new Promise((resolve, reject) => {
    API.create(bookmark, function(BookmarkNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve(BookmarkNode);
    });
  });
}

// Updates the properties of a bookmark or folder. Specify only the properties that you want to change; unspecified properties will be left unchanged. Note: Currently, only 'title' and 'url' are supported.
export function update(id, bookmark) {
  return new Promise((resolve, reject) => {
    API.update(id, bookmark, function(BookmarkNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve(BookmarkNode);
    });
  });
}

// Moves the specified BookmarkTreeNode to the provided location.
export function move(id, destination) {
  return new Promise((resolve, reject) => {
    API.move(id, destination, function(BookmarkNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve(BookmarkNode);
    });
  });
}

// Removes a bookmark or an empty bookmark folder.
export function remove(id) {
  return new Promise((resolve, reject) => {
    API.remove(id, function() {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve();
    });
  });
}

// Recursively removes a bookmark folder.
export function removeTree(id) {
  return new Promise((resolve, reject) => {
    API.removeTree(id, function() {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve();
    });
  });
}

// Search
export function search(query) {
  return new Promise((resolve, reject) => {
    API.search(query, function(BookmarkTreeNode) {
      if (RUNTIME.lastError) {
        reject(RUNTIME.lastError);
      }
      resolve(BookmarkTreeNode);
    });
  });
}
