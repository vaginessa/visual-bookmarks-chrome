module.exports = ({ webpack }) => ({
  plugins: {
    'postcss-import': {},
    'postcss-nesting': {},
    'autoprefixer': {},
    'css-mqpacker': {},
    'postcss-csso': webpack.mode === 'production' ? {} : false
  }
});
