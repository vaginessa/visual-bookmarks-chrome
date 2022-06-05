export const FAVICON_SRC = `chrome://favicon/size/16@2x`;

export const SVG_LOADER =
`<svg class="loading" id="loading" viewBox="0 0 100 100">` +
  `<defs>` +
    `<linearGradient id="%id%">` +
      `<stop offset="5%" stop-color="#4285f4"></stop>` +
      `<stop offset="95%" stop-color="#b96bd6"></stop>` +
    `</linearGradient>` +
  `</defs>` +
  `<circle class="path" fill="none" stroke="url(#%id%)" stroke-width="8" stroke-linecap="round" cx="50" cy="50" r="40"></circle>` +
`</svg>`;

export const SERVICES_COUNT = 20;

export const REGEXP_URL_PATTERN = /^(https?|ftp|file|edge|chrome|(chrome-)?extension):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/i;

export const THUMBNAIL_POPUP_WIDTH = 1170;
export const THUMBNAIL_POPUP_HEIGHT = 720;
