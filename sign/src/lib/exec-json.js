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

/**
 * @param {string} stdout
 * @returns {Record<string, unknown>}
 */
function parseLastJsonObject(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('CLI returned empty stdout; expected JSON with --json.');
  }
  const lines = trimmed.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) {
      continue;
    }
    try {
      return JSON.parse(line);
    } catch {
      // keep scanning
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Failed to parse CLI JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
function pickEnrollFields(payload) {
  const signingSha1 =
    payload.signingSha1 ??
    payload.signing_sha1 ??
    payload.signingSHA1 ??
    payload['signing-sha1'];
  const deviceId = payload.deviceId ?? payload.device_id ?? payload['device-id'];
  const expiresAt = payload.expiresAt ?? payload.expires_at ?? payload['expires-at'];

  if (!signingSha1 || !deviceId) {
    throw new Error('CLI JSON missing signingSha1 or deviceId fields.');
  }
  return {
    signingSha1: String(signingSha1).replace(/[\s:]/g, '').toUpperCase(),
    deviceId: String(deviceId),
    expiresAt: expiresAt ? String(expiresAt) : '',
  };
}

module.exports = {
  buildSpawnOptions,
  execCapture,
  parseLastJsonObject,
  pickEnrollFields,
};
