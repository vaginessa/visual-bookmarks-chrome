import { getFolders } from '../api/bookmark';

const id = 'visual-bookmarks';

const flatRecursiveFolders = (folders, parentId) => {
  return folders.reduce((accum, current) => {
    accum.push({
      id: current.id,
      title: current.title,
      contexts: ['page'],
      parentId
    });
    if (current.children && parentId) {
      accum.push(...flatRecursiveFolders(current.children, current.id));
    }
    return accum;
  }, []);
};

const browserContextMenu = {
  init() {
    const isShow = localStorage.getItem('show_contextmenu_item') === 'true';
    if (!isShow) return;

    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError);
      }
      this.create();
    });
  },
  async create() {
    const foldersThree = await getFolders();
    const linkItems = [
      {
        id,
        title: chrome.i18n.getMessage('add_bookmark'),
        contexts: ['page']
      },
      {
        id: 'current_folder',
        title: chrome.i18n.getMessage('save_to_current_folder'),
        contexts: ['page'],
        parentId: id
      },
      {
        id: 'separator',
        type: 'separator',
        contexts: ['page'],
        parentId: id
      }
    ];

    const folders = flatRecursiveFolders(foldersThree, id);
    linkItems.push(...folders);

    for (let item of linkItems) {
      chrome.contextMenus.create(item, () => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError);
        }
      });
    }

  },
  toggle() {
    const isShow = localStorage.getItem('show_contextmenu_item') === 'true';

    if (isShow) {
      this.create();
    } else {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) return;
      });
    }
  }
};

export default browserContextMenu;
