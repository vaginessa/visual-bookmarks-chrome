export default function() {
  const els = document.querySelectorAll('[data-locale-message]');

  Array.prototype.slice.call(els).forEach(item => {
    const msg = item.getAttribute('data-locale-message');
    if (!msg) return;
    const translation = chrome.i18n.getMessage(msg);
    if (!translation) return;

    if (~msg.indexOf('placeholder')) {
      item.placeholder = translation;
      return;
    }
    item.textContent = translation;
  });
}
