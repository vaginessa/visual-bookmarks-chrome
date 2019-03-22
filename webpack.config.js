const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    newtab: './src/js/newtab.js',
    options: './src/js/options.js',
    eventPage: './src/js/eventPage.js',
  },
  output: {
    path: path.resolve(__dirname, 'extension'),
    filename: 'js/[name].js',
  },
  resolve: {
    modules: ['node_modules']
  },
  module: {
    rules: [
      {
        test: /\.html$/,
        include: path.resolve(__dirname, 'src/js/components'),
        use: {
          loader: 'html-loader',
          options: {
            minimize: true
          }
        }
      },
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
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          output: { comments: false },
          compress: { passes: 3 }
        }
      })
    ]
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false
    }),
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
