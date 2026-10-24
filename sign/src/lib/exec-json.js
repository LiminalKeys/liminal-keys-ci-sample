'use strict';

const exec = require('@actions/exec');
const { redactSecrets } = require('./redaction');

/**
 * @typedef {{ exitCode: number; stdout: string; stderr: string }} ExecJsonResult
 */

/**
 * Run a command and capture stdout/stderr without echoing secrets.
 * @param {string} command
 * @param {string[]} args
 * @param {import('@actions/exec').ExecOptions & { secrets?: string[] }} options
 * @returns {Promise<ExecJsonResult>}
 */
async function execCapture(command, args, options = {}) {
  const secrets = options.secrets ?? [];
  let stdout = '';
  let stderr = '';
  const exitCode = await exec.exec(command, args, {
    ...options,
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data) => {
        stdout += data.toString();
      },
      stderr: (data) => {
        stderr += data.toString();
      },
    },
  });

  return {
    exitCode,
    stdout: redactSecrets(stdout, secrets),
    stderr: redactSecrets(stderr, secrets),
  };
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
  execCapture,
  parseLastJsonObject,
  pickEnrollFields,
};
