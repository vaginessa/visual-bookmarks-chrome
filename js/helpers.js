/**
 * Helpers
 */
function getEl(selector, context) {
  if(selector.charAt(0) === '#') {
    return document.getElementById(selector.slice(1));
  }
  return ((context) ? context : document).querySelector(selector);
}
function getElAll(selector, context) {
  return [].slice.call( ((context) ? context : document).querySelectorAll(selector) );
}

function templater(tpl, data) {
  return tpl.replace(/\{(.*?)\}/g, function(str, a) {
    return data[a] || '';
  });
}

function hasClass(cls, el) {
  return new RegExp('(^|\\s+)' + cls + '(\\s+|$)').test(el.className);
}
function addClass(cls, el) {
  if( ! hasClass(cls, el) )
    return el.className += (el.className === '') ? cls : ' ' + cls;
}
function removeClass(cls, el) {
  el.className = el.className.replace(new RegExp('(^|\\s+)' + cls + '(\\s+|$)'), '');
}
function toggleClass(cls, el) {
  ( ! hasClass(cls, el)) ? addClass(cls, el) : removeClass(cls, el);
}

Element && function(ElementPrototype) {
    ElementPrototype.matches = ElementPrototype.matches ||
    ElementPrototype.matchesSelector ||
    ElementPrototype.webkitMatchesSelector ||
    ElementPrototype.msMatchesSelector ||
    function(selector) {
        var node = this, nodes = (node.parentNode || node.document).querySelectorAll(selector), i = -1;
        while (nodes[++i] && nodes[i] != node);
        return !!nodes[i];
    }
}(Element.prototype);

// closest polyfill
Element && function(ElementPrototype) {
    ElementPrototype.closest = ElementPrototype.closest ||
    function(selector) {
        var el = this;
        while (el.matches && !el.matches(selector)) el = el.parentNode;
        return el.matches ? el : null;
    }
}(Element.prototype);

Element.prototype.trigger = function(evt) {
  var event = document.createEvent('HTMLEvents');
  event.initEvent(evt, true, false);
  this.dispatchEvent(event);
}

var notifications = function(message, delay) {
  delay = delay || 5000;

  if(window.timerNotice) {
    chrome.notifications.clear(message);
    clearTimeout(window.timerNotice);
  }

  chrome.notifications.create(message, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Visual bookmarks',
    message: message
  }, function() {
    window.timerNotice = setTimeout(function() {
      chrome.notifications.clear(message);
    }, delay)
  })

};