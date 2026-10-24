'use strict';

const path = require('node:path');

const HOST_APP = '/Applications/Liminal Keys Virtual Smartcard.app';
const HOST_CLI = `${HOST_APP}/Contents/Helpers/LiminalKeysHostCLI`;

function setupScriptPath(actionRoot) {
  return path.join(actionRoot, 'scripts', 'liminal-keys-ci-setup.sh');
}

function teardownScriptPath(actionRoot) {
  return path.join(actionRoot, 'scripts', 'liminal-keys-ci-teardown.sh');
}

module.exports = {
  HOST_APP,
  HOST_CLI,
  setupScriptPath,
  teardownScriptPath,
};
