const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background/index.ts',
    content: './src/content/selection.ts',
    popup: './src/popup/popup.ts',
    options: './src/options/options.ts'
  },
  output: {
    path: path.resolve(__dirname, 'extension'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.extension.json',
            transpileOnly: true
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/popup/index.html',
          to: 'popup.html'
        },
        {
          from: 'src/options/index.html',
          to: 'options.html'
        },
        {
          from: 'extension/manifest.json',
          to: 'manifest.json'
        }
      ]
    })
  ],
  optimization: {
    minimize: false // Keep readable for debugging
  }
};
