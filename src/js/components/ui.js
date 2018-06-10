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
      // if (window.innerWidth < 768) { return (document.getElementById('generateStyles').innerHTML = ''); }
      const styles = document.getElementById('generateStyles');

      // If window width < 992 clear calculate styles
      if (window.innerWidth < 992) {
        styles.innerHTML = '';
        return;
      }

      const container = document.getElementById('includeThree');
      const columns = parseInt(localStorage.getItem('dial_columns'));
      const ratio = 4 / 3;

      // Calculate and set container width
      const lsWidth = parseInt(localStorage.getItem('dial_width'));
      const containerWidth = Math.floor(window.innerWidth * (lsWidth / 100));
      styles.innerHTML = `.container {width: ${containerWidth}px}`;

      // Calculate column dimensions
      const colWidth = Math.floor(container.offsetWidth / columns);
      const colHeight = Math.floor(colWidth / ratio);

      // if column width less than 120px do not update styles
      if (colWidth < 120) return;

      // otherwise apply computed styles
      styles.innerHTML += `
      .content .bookmarks { justify-content: flex-start; }
        .bookmarks .column, .bookmarks .column--nosort {
          width: ${colWidth}px; height: ${colHeight}px
        }`;
    }
  };
})();

export default UI;
