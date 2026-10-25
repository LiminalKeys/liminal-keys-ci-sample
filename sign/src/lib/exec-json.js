'use strict';

const { spawn } = require('node:child_process');
const { redactSecrets } = require('./redaction');

/**
 * @typedef {{ exitCode: number; stdout: string; stderr: string }} ExecJsonResult
 */

/**
 * Run a command and capture stdout/stderr without echoing secrets.
 *
 * Uses child_process.spawn (not @actions/exec exec()) so executable paths
 * containing spaces (e.g. Liminal Keys Host CLI) are not split by argStringToArray.
 *
 * @param {string} executable
 * @param {string[]} args
 * @param {import('@actions/exec').ExecOptions & { secrets?: string[] }} options
 * @returns {Promise<ExecJsonResult>}
 */
/**
 * @param {string} executable
 * @param {string[] | undefined} args
 * @param {import('@actions/exec').ExecOptions} options
 */
function buildSpawnOptions(executable, args, options = {}) {
  const spawnArgs = args ?? [];
  const { secrets: _secrets, env, cwd, ...spawnOptions } = options;
  return {
    file: executable,
    args: spawnArgs,
    options: {
      ...spawnOptions,
      env: env ?? process.env,
      cwd,
      shell: false,
    },
  };
}

async function execCapture(executable, args, options = {}) {
  const secrets = options.secrets ?? [];
  const { file, args: spawnArgs, options: spawnOptions } = buildSpawnOptions(
    executable,
    args,
    options,
  );

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(file, spawnArgs, spawnOptions);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      stderr += err.message;
      resolve({
        exitCode: 1,
        stdout: redactSecrets(stdout, secrets),
        stderr: redactSecrets(stderr, secrets),
      });
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: redactSecrets(stdout, secrets),
        stderr: redactSecrets(stderr, secrets),
      });
    });
  });
}

const cliJson = require('./cli-json');

module.exports = {
  buildSpawnOptions,
  execCapture,
  ...cliJson,
};
