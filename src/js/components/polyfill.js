Element.prototype.matches = Element.prototype.matches || function matches(selector) {

  var element = this;
  var elements = (element.document || element.ownerDocument).querySelectorAll(selector);
  var index = 0;

  while (elements[index] && elements[index] !== element) {
    ++index;
  }

  return !!elements[index];
};
Element.prototype.closest = Element.prototype.closest || function closest(selector) {
  var node = this;

  while (node) {
    if (node.matches(selector)) return node;
    else node = node.parentElement;
  }

  return null;
};

export {};
