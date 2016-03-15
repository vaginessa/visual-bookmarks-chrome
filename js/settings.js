(function(window, undefined) {
  'use strict';

  window.settings = function() {
    var default_values = {
      background_color: "#f7f7f7",
      background_image: "",
      default_folder_id: "1",
      dial_columns: 5,
      drag_and_drop: "true",
      enable_sync: "false",
      // force_http: "true",
      thumbnailing_service: "http://api.webthumbnail.org/?width=500&height=400&screen=1280&url=[URL]"
    };

    // Creates default localStorage values if they don't already exist
    Object.keys(default_values).forEach(function(name) {
      if (localStorage.getItem(name) === null) {
        localStorage.setItem(name, default_values[name]);
      }
    });
  }
})(this)