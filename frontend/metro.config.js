const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

config.watchFolders = [__dirname];
config.resolver.assetExts.push('wasm');
config.resolver.blockList = [
  /\.expo[\\/]types/,
  /(\/__tests__\/.*)$/,
  /node_modules\/(@types|jest|eslint|typescript)\/.*/,
  /node_modules\/.*\/android\/.*/,
  /node_modules\/.*\/ios\/.*/,
];

module.exports = config;
