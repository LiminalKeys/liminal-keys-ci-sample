'use strict';

const path = require('node:path');

const HOST_APP = '/Applications/Liminal Keys Virtual Smartcard.app';
const HOST_CLI = `${HOST_APP}/Contents/Helpers/LiminalKeysHostCLI`;

function resolveActionRoot(fromDirname) {
  if (process.env.GITHUB_ACTION_PATH) {
    return process.env.GITHUB_ACTION_PATH;
  }
  const leaf = path.basename(fromDirname);
  if (leaf === 'main' || leaf === 'post') {
    return path.join(fromDirname, '..', '..');
  }
  return path.join(fromDirname, '..');
}

function setupScriptPath(actionRoot) {
  return path.join(actionRoot, 'scripts', 'liminal-keys-ci-setup.sh');
}

function teardownScriptPath(actionRoot) {
  return path.join(actionRoot, 'scripts', 'liminal-keys-ci-teardown.sh');
}

module.exports = {
  HOST_APP,
  HOST_CLI,
  resolveActionRoot,
  setupScriptPath,
  teardownScriptPath,
};
