var webpack = require('webpack');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    newtab: './src/js/newtab.js',
    options: './src/js/options.js',
    eventPage: './src/js/eventPage.js',
  },
  output: {
    path: __dirname + '/extension/',
    filename: 'js/[name].js',
  },
  resolve: {
    modules: ['node_modules']
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [/node_modules/],
        use: [{
          loader: 'babel-loader',
          options: { presets: ['es2015'] }
        }]
      },
      {
        test: /\.(png|jpe?g|svg)/i,
        loader: 'file-loader?name=[name].[ext]&publicPath=../img/&outputPath=img/'
      },
      {
        test: /\.css$/,
        exclude: [/node_modules/],
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'css-loader',
              options: {
                minimize: true
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                plugins: function() {
                  return [
                    require('postcss-cssnext')({
                      features: {
                        filter: false
                      },
                      browsers: ['last 30 Chrome versions']
                    })
                  ]
                }
              }
            }
          ],
          publicPath: 'extension'
        })
      }
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({}),
    new ExtractTextPlugin('./css/bookmark.css'),
    new HtmlWebpackPlugin({
      template: './src/newtab.html',
      filename: 'newtab.html',
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeScriptTypeAttributes: true
      },
      chunks: ['newtab']
    }),
    new HtmlWebpackPlugin({
      template: './src/options.html',
      filename: 'options.html',
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeScriptTypeAttributes: true
      },
      chunks: ['options']
    })
  ]
};
