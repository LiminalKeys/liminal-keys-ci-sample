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

/**
 * @param {import('@actions/exec').ExecOptions & { secrets?: string[]; timeoutMs?: number }} options
 */
async function execCapture(executable, args, options = {}) {
  const secrets = options.secrets ?? [];
  const timeoutMs = options.timeoutMs;
  const { file, args: spawnArgs, options: spawnOptions } = buildSpawnOptions(
    executable,
    args,
    options,
  );

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(file, spawnArgs, spawnOptions);

    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    if (timeoutMs != null && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
        setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore
          }
        }, 2000).unref?.();
      }, timeoutMs);
      timer.unref?.();
    }

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      stderr += err.message;
      resolve({
        exitCode: 1,
        stdout: redactSecrets(stdout, secrets),
        stderr: redactSecrets(stderr, secrets),
        timedOut,
      });
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout: redactSecrets(stdout, secrets),
        stderr: redactSecrets(stderr, secrets),
        timedOut,
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
