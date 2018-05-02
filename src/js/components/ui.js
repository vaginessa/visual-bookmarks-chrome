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
      const columns = parseInt(localStorage.getItem('dial_columns'));
      const styles = document.getElementById('generateStyles');
      const ratio = 4 / 3;

      // if there are 8 or more columns and a small resolution
      if (columns >= 8 && window.innerWidth < 1200) {
        const colWidth = Math.floor(1170 / columns);
        const colHeight = colWidth / ratio;
        styles.innerHTML = `.bookmarks {justify-content: center} .column, .column--nosort {width: ${colWidth}px; height: ${colHeight}px}`;
        return;
      }

      if (window.innerWidth < 768) return;

      const container = Math.floor(document.getElementById('includeThree').offsetWidth);
      const colWidth = Math.floor(container / columns);
      const colHeight = colWidth / ratio;
      styles.innerHTML = `.column, .column--nosort {width: ${colWidth}px; height: ${colHeight}px}`;
    }
  }
})();

export default UI;
