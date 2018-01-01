export default {

  transitionEnd() {
    let prefix = {
      'transition': 'transitionend',
      'webkitTransition': 'webkitTransitionEnd'
    };
    let fake = document.createElement('fake');
    for (let name in prefix) {
      if (fake.style[name] !== undefined) {
        return prefix[name];
      }
    }
    return false;
  },

  debounce(func, wait, immediate) {
    let timeout = null;

    return function () {
      const context = this,
        args = arguments;

      const later = () => {
        timeout = null;

        if (!immediate) {
          func.apply(context, args);
        }
      }

      const callNow = immediate && !timeout;

      clearTimeout(timeout);

      timeout = setTimeout(later, wait);

      if (callNow) {
        func.apply(context, args);
      }
    }
  },

  trigger(evt, el) {
    let event = document.createEvent('HTMLEvents');
    event.initEvent(evt, true, false);
    el.dispatchEvent(event);
  },

  templater(tpl, data) {
    return tpl.replace(/\%(.*?)\%/g, function (str, a) {
      return data[a] || '';
    });
  },

  notifications(message, delay = 5000) {

    if (window.timerNotice) {
      chrome.notifications.clear(message);
      clearTimeout(window.timerNotice);
    }

    chrome.notifications.create(message, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Visual bookmarks',
      message: message
    }, function () {
      window.timerNotice = setTimeout(() => {
        chrome.notifications.clear(message);
      }, delay)
    })

  },

  imageLoaded(img, cbObj) {
    // for (let img of imgsPath) {
    const image = new Image();

    image.onload = () => {
      cbObj.done && cbObj.done(img);
    }
    image.onerror = () => {
      cbObj.fail && cbObj.fail(img)
    }

    image.src = img;
    // }
  },

  base64ToBlob(base64, type, callback) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    let dataURI = base64;
    let contentType = type || '';

    let byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    let mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    var bb = new Blob([ab], { type: contentType });
    if (callback) return callback(bb);
    return bb;
  },

  resizeScreen(image, callback) {
    let img = new Image();
    let maxHeight = 300;
    img.onload = function () {
      if (maxHeight < img.height) {
        img.width *= maxHeight / img.height;
        img.height = maxHeight;
      }
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      callback(canvas.toDataURL('image/jpg'))
    }
    img.src = image;
  },

  rand(min, max) {
    return Math.round(
      min - 0.5 + Math.random() * (max - min + 1)
    );
  },

  getDomain(url) {
    return url.replace(/https?:\/\/(www.)?/i, '').replace(/\/.*/i, '');
  }

}
