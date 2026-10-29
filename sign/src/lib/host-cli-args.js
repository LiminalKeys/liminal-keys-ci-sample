'use strict';

/** Options documented in HostCLISupport.swift help (Host CLI 1.0.0-beta.4). */
const HOST_CLI_OPTION_FLAGS = new Set([
  '--api-base-url',
  '--enrollment-code',
  '--device-name',
  '--state-dir',
  '--identity',
  '--tenant-id',
  '--ttl',
  '--auth',
  '--yes',
  '--direct',
  '--version',
  '--json',
  '--no-publish',
  '--require-publish',
  '--require-enrolled',
  '--help',
  '-h',
]);

/**
 * @param {number} ttlMinutes
 * @returns {string}
 */
function formatCiTtlDuration(ttlMinutes) {
  return `${ttlMinutes}m`;
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {number} params.ttlMinutes
 * @param {string} params.apiBaseUrl
 * @param {string | undefined} params.identitySha1
 * @param {boolean} params.useCiKey
 * @returns {string[]}
 */
function buildCiEnrollArgs({ tenantId, ttlMinutes, apiBaseUrl, identitySha1, useCiKey }) {
  const args = [
    'ci',
    'enroll',
    '--tenant-id',
    tenantId,
    '--ttl',
    formatCiTtlDuration(ttlMinutes),
    '--api-base-url',
    apiBaseUrl,
    '--auth',
    useCiKey ? 'ci-key' : 'github-oidc',
    '--json',
  ];
  if (identitySha1) {
    args.push('--identity', identitySha1);
  }
  return args;
}

/**
 * @param {object} params
 * @param {string} params.identitySha1
 * @param {string} [params.apiBaseUrl]
 * @returns {string[]}
 */
function buildCiSignCheckArgs({ identitySha1, apiBaseUrl }) {
  const args = ['ci', 'sign-check', '--identity', identitySha1, '--json'];
  if (apiBaseUrl) {
    args.push('--api-base-url', apiBaseUrl);
  }
  return args;
}

/**
 * @param {object} [params]
 * @param {string} [params.apiBaseUrl]
 * @returns {string[]}
 */
function buildCiUnenrollArgs({ apiBaseUrl } = {}) {
  const args = ['ci', 'unenroll', '--json'];
  if (apiBaseUrl) {
    args.push('--api-base-url', apiBaseUrl);
  }
  return args;
}

/**
 * Lightweight bridge reachability check before ci enroll (Host `status --json`).
 *
 * @param {string} [apiBaseUrl]
 * @returns {string[]}
 */
function buildHostStatusArgs({ apiBaseUrl } = {}) {
  const args = ['status', '--json'];
  if (apiBaseUrl) {
    args.push('--api-base-url', apiBaseUrl);
  }
  return args;
}

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
function extractOptionFlags(argv) {
  const flags = [];
  for (const token of argv) {
    if (token.startsWith('--') || token === '-h') {
      flags.push(token);
    }
  }
  return flags;
}

/**
 * @param {string[]} argv
 * @param {Set<string>} [allowed]
 */
function assertHostCliOptionFlags(argv, allowed = HOST_CLI_OPTION_FLAGS) {
  for (const flag of extractOptionFlags(argv)) {
    if (!allowed.has(flag)) {
      throw new Error(`Unexpected Host CLI flag: ${flag}`);
    }
  }
}

module.exports = {
  HOST_CLI_OPTION_FLAGS,
  formatCiTtlDuration,
  buildCiEnrollArgs,
  buildCiSignCheckArgs,
  buildCiUnenrollArgs,
  buildHostStatusArgs,
  extractOptionFlags,
  assertHostCliOptionFlags,
};
