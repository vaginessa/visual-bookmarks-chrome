const Toast = (() => {
  let settings = {
    position: 'bottom-left',
    modClass: '',
    hideByClick: true,
    delay: 5000
  };

  let toast = createElement('div', {
    className: 'toast',
    innerHTML: '<div class="toast__body"></div'
  });
  document.body.appendChild(toast);

  let toastBody = toast.querySelector('.toast__body');
  let closeBtn = null;
  let timer = null;
  let isShow = false;
  // let queue = [];

  function createElement(tag, options) {
    const element = Object.assign(document.createElement(tag), options);
    return element;
  }

  function show(data) {
    if (isShow) {
      // return queue.push(data);
      return hide(() => show(data));
    }

    if (typeof data === 'string') {
      settings.message = data;
    } else {
      Object.assign(settings, data);
    }

    toast.classList.add(`toast--${settings.position}`);

    toastBody.innerHTML = `<div class="toast__message">${settings.message}</div>`;
    if (settings.hideByClick) {
      closeBtn = createElement('button', {
        className: 'toast__btn',
        innerHTML: `<svg version="1.1" width="24" height="24" viewBox="0 0 24 24" fill="#000"><path d="M18.984 6.422l-5.578 5.578 5.578 5.578-1.406 1.406-5.578-5.578-5.578 5.578-1.406-1.406 5.578-5.578-5.578-5.578 1.406-1.406 5.578 5.578 5.578-5.578z"></path></svg>`
      });
      toastBody.appendChild(closeBtn);
      closeBtn.addEventListener('click', closeHandler);
    }

    if (settings.modClass) {
      toast.classList.add(settings.modClass);
    }

    toast.style.display = 'block';
    isShow = true;

    window.requestAnimationFrame(() => {
      toast.classList.add('toast-enter');
    });

    if (settings.delay) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        hide();
      }, settings.delay);
    }
  }

  function closeHandler(e) {
    e.preventDefault();
    closeBtn.removeEventListener(e.type, closeHandler);
    hide();
  }

  function hide(fn) {
    if (!isShow) return;
    if (timer) clearTimeout(timer);

    window.requestAnimationFrame(() => toast.classList.remove('toast-enter'));

    const handler = (e) => {
      if (e.target !== toast) return;
      isShow = false;
      toast.removeEventListener(e.type, handler);
      toast.className = 'toast';
      toast.style.display = 'none';
      fn && fn();
      // if (queue.length > 0) {
      //   setTimeout(() => {
      //     show(queue.shift());
      //   }, 20);
      // }
    };
    toast.addEventListener('transitionend', handler);
  }

  return {
    show,
  };

})();

export default Toast;
