const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
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
          options: { presets: ['@babel/env'] }
        }]
      },
      {
        test: /\.css$/,
        exclude: [/node_modules/],
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ]
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin('extension/*'),
    new CopyWebpackPlugin([
      { from: 'static' }
    ]),
    new MiniCssExtractPlugin({
      filename: 'css/bookmark.css'
    }),
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
