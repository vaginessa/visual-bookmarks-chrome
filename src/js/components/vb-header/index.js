import html from './template.html';
import { $createElement } from '../../utils';

class VbHeader extends HTMLElement {
  connectedCallback() {
    this._render();
    this._attachEvents();
  }

  disconnectedCallback() {
    this._dettachEvents();
  }

  _render() {
    this.insertAdjacentHTML('afterbegin', html);
    this._headerNode = this.querySelector('.header');
    this._inputNode = this.querySelector('input');
    this._resetNode = this.querySelector('#searchReset');
    this._selectNode = this.querySelector('select');
    this._backNode = null;

    this._inputNode.placeholder = this.getAttribute('placeholder');
    this._folderId = this.getAttribute('folder');

    this._hashchange();
  }

  set folders(arr) {
    if (!this._selectNode) {
      throw new Error('custom item must be in the DOM');
    }
    this._selectNode.innerHTML = arr.join('');
  }

  _attachEvents() {
    this._inputHandler = this._input.bind(this);
    this._resetHandler = this._reset.bind(this);
    this._hashHandler = this._hashchange.bind(this);
    this._selectHandler = this._select.bind(this);

    this._inputNode.addEventListener('input', this._inputHandler);
    this._resetNode.addEventListener('click', this._resetHandler);
    this._selectNode.addEventListener('change', this._selectHandler);
    document.addEventListener('changeFolder', this._hashHandler);
  }

  _dettachEvents() {
    this._inputNode.removeEventListener('input', this.inputHandler);
    this._resetNode.removeEventListener('click', this.resetHandler);
    this._selectNode.removeEventListener('change', this.selectHandler);
    document.removeEventListener('changeFolder', this.hashHandler);

    delete this._inputHandler;
    delete this._resetHandler;
    delete this._hashHandler;
    delete this._selectHandler;
  }

  _hashchange() {
    const hash = window.location.hash.slice(1);
    if (hash && hash !== this._folderId) {
      if (!this._backNode) {
        this._backNode = $createElement(
          'button',
          {
            class: 'back'
          },
          {
            innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="1" stroke-linecap="square" stroke-linejoin="arcs"><path d="M19 12H6M12 5l-7 7 7 7"/></svg>`
          }
        );
        this._headerNode.insertAdjacentElement('afterbegin', this._backNode);
        this._backNode.addEventListener('click', this._back);
      }
    } else {
      if (this._backNode) {
        this._backNode.removeEventListener('click', this._back);
        this._backNode.remove();
        this._backNode = null;
      }
    }

    const value = hash ? hash : this._folderId;
    const option = this._selectNode.querySelector(`[value="${value}"]`);
    option && (option.selected = true);
  }

  _select(e) {
    window.location.hash = e.target.value;
  }

  _back() {
    window.history.back();
  }

  _reset() {
    this._inputNode.value = '';
    this._inputNode.dispatchEvent(
      new CustomEvent('vb:searchreset', {
        bubbles: true,
        cancelable: true
      })
    );
    this._resetNode.classList.remove('is-show');
    this._inputNode.focus();
  }

  _input(e) {
    const search = e.target.value.trim();
    this.dispatchEvent(
      new CustomEvent('vb:search', {
        detail: {
          search
        },
        bubbles: true,
        cancelable: true
      })
    );

    this._resetNode.classList.toggle('is-show', search.length);
  }
}

window.customElements.define('vb-header', VbHeader);
