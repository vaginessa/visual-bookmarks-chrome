const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const WebpackBar = require('webpackbar');

module.exports = (env, arg) => {
  const isDev = arg.mode === 'development'
  return {
    mode: arg.mode,
    stats: {
      assets: false
    },
    devtool: arg.mode === 'development' ? 'inline-source-map' : false,
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
          // include: path.resolve(__dirname, 'src/js/components'),
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
            {
              loader: 'css-loader',
              options: {
                url: false
              }
            },
            'postcss-loader'
          ]
        }
      ]
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          // do not extract to separate file
          extractComments: false,
          terserOptions: {
            // output: { comments: false, },
            output: { comments: /@?license/i, },
            compress: { passes: 3 }
          }
        })
      ]
    },
    plugins: [
      new WebpackBar(),
      new CleanWebpackPlugin({
        verbose: false,
        cleanStaleWebpackAssets: false
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'static',
            transform(content, path) {
              if (path.includes('manifest.json') && arg.mode === 'development') {
                const manifest = JSON.parse(content.toString());
                manifest.content_security_policy = `script-src 'self' 'unsafe-eval'; object-src 'self'`
                return JSON.stringify(manifest, null, 2);
              }
              return content
            }
          }
        ]
      }),
      new MiniCssExtractPlugin({
        filename: 'css/[name].css'
      }),
      ...['newtab', 'options'].map(name => {
        return new HtmlWebpackPlugin({
          template: `./src/${name}.html`,
          filename: `${name}.html`,
          scriptLoading: 'blocking',
          minify: {
            collapseWhitespace: true,
            removeComments: true,
            removeScriptTypeAttributes: true
          },
          chunks: [name]
        })
      })
    ]
  }
};
