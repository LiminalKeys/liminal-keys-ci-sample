'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const entries = ['../dist/main/index.js', '../dist/post/index.js'];

function isModuleNotFoundOutput(output) {
  return /Cannot find module|MODULE_NOT_FOUND|Error \[ERR_MODULE_NOT_FOUND\]/.test(output);
}

for (const entry of entries) {
  const absPath = path.join(__dirname, entry);
  const result = spawnSync(
    process.execPath,
    ['-e', 'require(process.argv[1])', absPath],
    { encoding: 'utf8', timeout: 30_000 },
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.error) {
    console.error(`Dist bundle failed to load (${entry}):`, result.error.message);
    process.exit(1);
  }

  if (isModuleNotFoundOutput(output)) {
    console.error(`Dist bundle failed to load (${entry}):\n${output}`);
    process.exit(1);
  }

  // Bundles run top-level Action code (e.g. darwin guard → setFailed → exit 1 on Linux).
  // Any non–module-not-found outcome means require() resolved all bundled deps.
}
