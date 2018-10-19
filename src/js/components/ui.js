import Helpers from './helpers';

const UI = (() => {
  return {
    setBG() {
      const bgEl = document.getElementById('bg');
      const bgState = localStorage.getItem('background_image');

      if (bgState === 'background_color') {
        bgEl.style.backgroundColor = localStorage.getItem('background_color');
        setTimeout(() => {
          bgEl.style.opacity = 1;
        }, 20);
        return;
      }

      const resource = (bgState === 'background_local')
        ? localStorage.getItem('background_local')
        : localStorage.getItem('background_external');

      if (resource && resource !== '') {
        Helpers.imageLoaded(resource, {
          done(data) {
            document.body.classList.add('stealth-header');
            bgEl.style.backgroundImage = `url('${data}')`;
            bgEl.style.opacity = 1;
          },
          fail(e) {
            console.warn(`Local background image resource problem: ${e}`);
            bgEl.style.opacity = 1;
          }
        });
      }
    },
    calculateStyles() {
      const doc = document.documentElement;
      const grid = document.getElementById('bookmarks');
      const gap = parseInt(window.getComputedStyle(doc).getPropertyValue('--grid-gap'), 10);
      const columns = parseInt(localStorage.getItem('dial_columns'));
      const ratio = 4 / 3;

      // Calculate and set container width
      const lsGridWidth = parseInt(localStorage.getItem('dial_width'));
      const gridWidth = Math.floor(window.innerWidth * (lsGridWidth / 100));

      doc.style.setProperty('--container-width', `${gridWidth}px`);

      // Calculate column dimensions
      const colWidth = Math.floor((grid.offsetWidth - ((columns - 1) * gap)) / columns);
      const colHeight = Math.floor(colWidth / ratio);

      // if column width less than 120px do not update styles
      if (colWidth < 120) {
        doc.style.setProperty('--grid-column-width', '');
        doc.style.setProperty('--grid-row-height', '');
        doc.style.setProperty('--grid-columns', '');
        return;
      }

      doc.style.setProperty('--grid-column-width', `${colWidth}px`);
      doc.style.setProperty('--grid-row-height', `${colHeight}px`);
      doc.style.setProperty('--grid-columns', columns);
    }
  };
})();

export default UI;
