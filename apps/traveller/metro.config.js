const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch the whole workspace and resolve hoisted/workspace
// packages (e.g. @layo/contracts) from both this app's and the root's
// node_modules. See https://docs.expo.dev/guides/monorepos/.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// NOTE: unlike Yarn/npm workspaces, pnpm's node_modules is already strict
// (symlinked per-package), so `disableHierarchicalLookup` must stay off here —
// turning it on breaks resolution of nested deps like @react-navigation/native
// that expo-router depends on internally.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
