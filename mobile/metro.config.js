const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for solving the "exports" issue if necessary
// config.resolver.unstable_enablePackageExports = true;

module.exports = config;
