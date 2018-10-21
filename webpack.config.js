const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

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
          options: { presets: ['env'] }
        }]
      },
      // {
      //   test: /\.(png|jpe?g|svg)/i,
      //   use: [{
      //     loader: 'file-loader',
      //     options: {
      //       name: 'img/[name].[ext]',
      //       publicPath: '/'
      //     }
      //   }]
      // },
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
                        filter: false,
                        customProperties: false
                      },
                      browsers: ['last 30 Chrome versions']
                    })
                  ];
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
    new CleanWebpackPlugin('extension/*'),
    new CopyWebpackPlugin([
      { from: 'static' }
    ]),
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
