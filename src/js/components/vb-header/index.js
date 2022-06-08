import '../vb-select';
import html from './template.html';
import { $createElement } from '../../utils';
import { getFolders } from '../../api/bookmark';

class VbHeader extends HTMLElement {
  connectedCallback() {
    this.#render();
    this.#attachEvents();
  }

  disconnectedCallback() {
    this.#dettachEvents();
  }

  async #render() {
    this.backNode = null;
    this.initialHash = window.location.hash;
    this.insertAdjacentHTML('afterbegin', html);
    this.headerNode = this.querySelector('.header');
    this.inputNode = this.querySelector('input');
    this.resetNode = this.querySelector('#searchReset');
    // get select component
    this.selectNode = this.querySelector('vb-select-folders');
    this.inputNode.placeholder = this.getAttribute('placeholder');

    // initial folder id
    this.initialFolderId = this.getAttribute('initial-folder-id');
    // current folder id
    this.folderId = this.getAttribute('folder-id');


    // this.selectNode.setAttribute('initial-folder-id', this.initialFolderId);
    this.selectNode.setAttribute('folder-id', this.folderId);
    // get folders list for select component
    this.selectNode.folders = await getFolders();

    this.#hashchange();
  }

  #attachEvents() {
    this.handleInput = this.#onInput.bind(this);
    this.handleReset = this.#onReset.bind(this);
    this.handleHash = this.#hashchange.bind(this);
    this.handleSelectHash = this.#onSelectHash.bind(this);
    this.handleUpdateFolders = this.#updateFolders.bind(this);

    this.inputNode.addEventListener('input', this.handleInput);
    this.resetNode.addEventListener('click', this.handleReset);
    this.selectNode.addEventListener('vb:select:change', this.handleSelectHash);

    // listen for folder change event
    document.addEventListener('changeFolder', this.handleHash);
    // listen for folders update event
    document.addEventListener('updateFolderList', this.handleUpdateFolders);
  }

  #dettachEvents() {
    this.inputNode.removeEventListener('input', this.handleInput);
    this.resetNode.removeEventListener('click', this.handleReset);
    this.selectNode.removeEventListener('vb:select:change', this.handleSelectHash);
    document.removeEventListener('changeFolder', this.handleHash);
    document.removeEventListener('updateFolderList', this.handleUpdateFolders);
  }

  async #updateFolders(e) {
    if (e.detail?.isFolder && this.selectNode) {
      this.selectNode.folders = await getFolders();
    }
  }

  #hashchange() {
    const hash = window.location.hash.slice(1);

    if (hash && hash !== this.initialFolderId) {
      if (!this.backNode) {
        this.backNode = $createElement(
          'button',
          {
            class: 'back'
          },
          {
            innerHTML: `<svg width="20" height="20"><use xlink:href="/img/symbol.svg#arrow_back"/></svg>`
          }
        );
        this.handleBack = this.#onBack.bind(this);
        this.headerNode.insertAdjacentElement('afterbegin', this.backNode);
        this.backNode.addEventListener('click', this.handleBack);
      }
    } else {
      if (this.backNode) {
        this.backNode.removeEventListener('click', this.handleBack);
        this.backNode.remove();
        this.backNode = null;
      }
    }
    this.selectNode.setAttribute('folder-id', hash || this.initialFolderId);
  }

  #onSelectHash(e) {
    window.location.hash = e.detail;
  }

  #onBack() {
    // if initialHash does not match location hash
    // can go back in history
    // until the hashes are equal
    if (this.initialHash === window.location.hash) {
      window.location.hash = this.initialFolderId;
    } else {
      window.history.back();
    }
  }

  #onReset() {
    this.inputNode.value = '';
    this.inputNode.dispatchEvent(
      new CustomEvent('vb:searchreset', {
        bubbles: true,
        cancelable: true
      })
    );
    this.resetNode.classList.remove('is-show');
    this.inputNode.focus();
  }

  #onInput(e) {
    const search = e.target.value;
    this.dispatchEvent(
      new CustomEvent('vb:search', {
        detail: {
          search
        },
        bubbles: true,
        cancelable: true
      })
    );

    this.resetNode.classList.toggle('is-show', search.trim().length);
  }
}

window.customElements.define('vb-header', VbHeader);
