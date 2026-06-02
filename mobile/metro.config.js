const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package exports as it causes issues with some libraries in this environment
config.resolver.unstable_enablePackageExports = false;

// Ensure common extensions are prioritized correctly
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
