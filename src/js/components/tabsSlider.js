export default class TasbSlider {
  constructor(selector) {
    // this.currentId = 0;
    // this.tabs
    // this.bar
    // this.controls
    // this.content
    // this.sections
    // this.line
    // this.width
    // this.handlerClick
    // this.handlerResize - null;

    this.init(selector);
  }

  index(el) {
    const children = el.parentNode.children;
    let i = 0;
    for (; i < children.length; i++) {
      if (children[i] === el) {
        break;
      }
    }
    return i;
  }

  recalc() {
    this.dimmensions();
  }

  dimmensions() {
    this.setSliderLine();

    const w = this.tabs.offsetWidth;
    const h = this.sections[this.currentId].offsetHeight;

    this.sections.forEach(item => {
      item.style.width = `${w}px`;
    });

    this.content.style.cssText = `
      transform: translateX(-${w * this.currentId}px);
      height: ${h}px;
      width: ${w * this.sections}px;
    `;
  }

  selectTab(e) {
    const target = e.target.closest('.tabs__controls');
    if (!target) return;
    this.currentId = this.index(target);

    this.dimmensions();
    this.setSliderLine();
  }

  setSliderLine() {
    const {offsetWidth, offsetLeft} = this.controls[this.currentId];

    this.line.style.cssText = `
      width: ${offsetWidth}px;
      transform: translateX(${offsetLeft}px);
    `;
  }

  init(selector) {
    this.tabs = document.querySelector(selector);

    if (!this.tabs || this.tabs.activated) return;

    this.tabs.activated = true;
    this.currentId = 0;
    this.bar = this.tabs.querySelector('.tabs__bar');
    this.controls = Array.prototype.slice.call(this.bar.querySelectorAll('.tabs__controls'));
    this.content = this.tabs.querySelector('.tabs__content');
    this.sections = Array.prototype.slice.call(this.content.querySelectorAll('.tabs__section'));
    this.line = document.createElement('span');
    this.line.className = 'tabs__line';

    this.bar.appendChild(this.line);
    this.setSliderLine();
    this.dimmensions();

    this.handlerClick = this.selectTab.bind(this);
    this.handlerResize = this.dimmensions.bind(this);

    this.bar.addEventListener('click', this.handlerClick);
    window.addEventListener('resize', this.handlerResize);
  }
}
