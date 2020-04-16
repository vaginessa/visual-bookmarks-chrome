export default function() {
  const els = document.querySelectorAll('[data-locale-message]');

  Array.prototype.slice.call(els).forEach(item => {
    const msg = item.getAttribute('data-locale-message');
    if (!msg) return;

    // if exist params i18nString:param1,param2,param3
    const params = msg.split(':');
    if (params.length > 1) {
      const arrString = params[1].split(',').map(str => {
        return chrome.i18n.getMessage(str) || str;
      });
      item.textContent = chrome.i18n.getMessage(params[0], arrString);
    } else {
      // only string without params
      const translation = chrome.i18n.getMessage(msg);
      if (!translation) return;

      if (~msg.indexOf('placeholder')) {
        item.placeholder = translation;
        return;
      }
      item.textContent = translation;
    }
  });
}
