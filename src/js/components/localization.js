export default function() {
  const els = document.querySelectorAll('[data-locale-message]');

  Array.prototype.slice.call(els).forEach(item => {
    const msg = item.getAttribute('data-locale-message');
    if (~msg.indexOf('placeholder')) {
      item.placeholder = chrome.i18n.getMessage(msg);
      return;
    }
    item.textContent = chrome.i18n.getMessage(msg);
  });
}
