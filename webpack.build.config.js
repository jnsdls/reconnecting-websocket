var webpack = require('webpack');
var path = require('path');

var plugins = [
  new webpack.optimize.DedupePlugin(),
  new webpack.optimize.OccurenceOrderPlugin(),
  new webpack.DefinePlugin({
    '__DEV__': false,
    'process.env': {
      NODE_ENV: JSON.stringify('production'),
    },
  }),
];
plugins.push(new webpack.optimize.UglifyJsPlugin());


module.exports = {
  entry: path.resolve(__dirname, './src/reconnecting-websocket.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd',
    library: 'ReconnectingWebSocket',
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['es2015'],
        },
      },
    ],
  },
  plugins: plugins,
};