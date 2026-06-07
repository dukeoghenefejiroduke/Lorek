const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

config.watchFolders = [__dirname];
config.resolver.blockList = [
  /.*\/node_modules\/.*\/node_modules\/.*/,
];

module.exports = config;
