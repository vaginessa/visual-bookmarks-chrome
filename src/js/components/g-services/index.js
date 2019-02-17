import Sortable from 'sortablejs';
import html from './template.html';

const reorderArray = (event, originalArray) => {
  const movedItem = originalArray.find((item, index) => index === event.oldIndex);
  const remainingItems = originalArray.filter((item, index) => index !== event.oldIndex);

  const reorderedItems = [
    ...remainingItems.slice(0, event.newIndex),
    movedItem,
    ...remainingItems.slice(event.newIndex)
  ];

  return reorderedItems;
};

class GoogleServices extends HTMLElement {
  constructor() {
    super();

    const shadowRoot = this.attachShadow({ mode: 'open' });
    const template = document.createElement('template');
    template.innerHTML = html;
    shadowRoot.appendChild(
      template.content.cloneNode(true)
    );

    this._isActive = false;

    this._trigger = this.shadowRoot.querySelector('.trigger');
    this._content = this.shadowRoot.querySelector('.popup');
    this._grid = this._content.querySelector('.list');
  }

  _attachEvents() {
    this._handlerToggle = this._toggle.bind(this);
    this._handlerKeyClose = this._closeByKey.bind(this);
    this._handlerClickClose = this._closeByClick.bind(this);

    this._trigger.addEventListener('click', this._handlerToggle);
    document.addEventListener('click', this._handlerClickClose);
    document.addEventListener('keydown', this._handlerKeyClose);
  }

  _dettachEvents() {
    this._trigger.removeEventListener('click', this._handlerToggle);
    document.removeEventListener('click', this._handlerClickClose);
    document.removeEventListener('keydown', this._handlerKeyClose);

    delete this._handlerToggle;
    delete this._handlerKeyClose;
    delete this._handlerClickClose;
  }

  _closeByClick(e) {
    if (this._isActive && this !== e.target) {
      this._hide();
    }
  }

  _closeByKey(e) {
    if (e.which === 27 && this._isActive) {
      this._hide();
    }
  }

  _show() {
    this._trigger.classList.add('is-active');
    this._content.classList.add('is-open');
    this._isActive = true;
    this.dispatchEvent(new CustomEvent('open'), {
      bubbles: true,
      cancelable: true
    });
  }

  _hide() {
    this._trigger.classList.remove('is-active');
    this._content.classList.remove('is-open');
    this._isActive = false;
    this.dispatchEvent(new CustomEvent('close'), {
      bubbles: true,
      cancelable: true
    });
  }

  _toggle() {
    !this._isActive
      ? this._show()
      : this._hide();
  }

  _render() {
    this._data = JSON.parse(this.dataset.services);
    const str = this._data.map(item => {
      return `
          <a class="item" href="${item.link}">
            <div class="item-logo is-${item.name}"></div>
            <div class="item-name">${item.name}</div>
          </a>
      `;
    }).join('');
    this._grid.innerHTML = str;
    this._items = [...this._grid.querySelectorAll('.item')];
  }

  connectedCallback() {
    // render component
    this._render();

    // attach Events
    this._attachEvents();

    // external plugin
    this._sortable = new Sortable(this._grid, {
      animation: 150,
      ghostClass: 'ghost',
      onUpdate: (e) => {
        this._data = reorderArray(e, this._data);
        this.dispatchEvent(
          new CustomEvent('sort', {
            detail: {
              services: this._data
            },
            bubbles: true,
            cancelable: true
          })
        );
      }
    });
  }

  disconnectedCallback() {
    this._dettachEvents();
    this._sortable.destroy();
    delete this._sortable;
  }
}

window.customElements.define('g-services', GoogleServices);
