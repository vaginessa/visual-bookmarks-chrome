import { $customTrigger } from './helpers';

class AutosizeTextarea {
  constructor(el, maxHeight = 300) {
    if (!el) return false;

    if (typeof el === 'string') {
      this.el = document.querySelector(el);
    } else {
      this.el = el;
    }

    if (!(this.el instanceof Element)) {
      return false;
    }

    if (this.el.instance) return this.el.instance;

    this.el.instance = this;
    this.maxHeight = maxHeight;
    this.padding = this.getVerticalPadding();
    this.initHeight = this.el.clientHeight - this.padding;
    this.inputHandler = this.inputHandler.bind(this);

    this.el.addEventListener('input', this.inputHandler);
  }

  getVerticalPadding() {
    const { paddingTop, paddingBottom } = window.getComputedStyle(this.el, null);
    return parseInt(paddingTop, 10) + parseInt(paddingBottom, 10);
  }

  inputHandler() {
    let newHeight = 0;

    if ((this.el.scrollHeight - this.padding) > this.maxHeight){
      this.el.style.overflowY = 'scroll';
      newHeight = this.maxHeight;
    } else {
      this.el.style.overflowY = 'hidden';
      this.el.style.height = 'auto';
      newHeight = this.el.scrollHeight - this.padding;
    }

    if (this.initHeight >= newHeight) {
      newHeight = this.initHeight;
    }

    this.el.style.height = newHeight + 'px';
    $customTrigger('textarea-autosize', this.el, {
      height: newHeight
    });
  }

  destroy() {
    if (!this.el) return;

    this.el.removeEventListener('input', this.inputHandler);
    this.el.removeAttribute('style');

    delete this.el.instance;
    Object.keys(this).forEach(item => {
      delete this[item];
    });
  }
}

export default AutosizeTextarea;
