module.exports = {
  plugins: [
    require('postcss-import'),
    require('postcss-nesting'),
    require('autoprefixer'),
    require("css-mqpacker"),
    require('postcss-csso')
  ]
};
