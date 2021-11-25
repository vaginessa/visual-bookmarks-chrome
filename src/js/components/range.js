export default class Range {
  #el = null;
  #outputEl = null;
  #options = {
    value: null,
    postfix: ''
  };
  #min;
  #max;

  constructor(el, options) {
    if (!el) {
      return;
    }

    this.#el = el;
    this.#options = Object.assign({}, this.#options, options);

    this.#min = this.#el.min || 0;
    this.#max = this.#el.max || 100;

    const { selectorOutput } = this.#el.dataset;
    this.#outputEl = document.querySelector(selectorOutput);

    const value = this.#options.value ? this.#options.value : this.#el.value;

    this.#setOutput(value);
    this.#updateTrackFill(value);

    this.#attachEvents();
  }

  #attachEvents() {
    this.handleInput = this.#input.bind(this);
    this.handleChange = this.#change.bind(this);
    this.handleBlur = this.#blur.bind(this);

    this.#el.addEventListener('input', this.handleInput);
    this.#el.addEventListener('change', this.handleChange);
    this.#el.addEventListener('blur', this.handleBlur);
  }

  #updateTrackFill(value) {
    const percent = ~~((value - this.#min) / (this.#max - this.#min) * 100);
    this.#el.style.setProperty('--range-track-fill', `${percent}%`);
  }

  #setOutput(value) {
    if (this.#outputEl) {
      this.#outputEl.textContent = `${value}${this.#options.postfix}`;
    }
  }

  #input(e) {
    this.#updateTrackFill(e.target.value);
    this.#setOutput(e.target.value);
    this.#options.onInput && this.#options.onInput(e);
  }

  #change(e) {
    this.#updateTrackFill(e.target.value);
    this.#setOutput(e.target.value);
    this.#options.onChange && this.#options.onChange(e);
  }

  #blur(e) {
    this.#options.onBlur && this.#options.onBlur(e);
  }
}
