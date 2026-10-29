'use strict';

const DEFAULT_HOST_STATUS_TIMEOUT_MS = 20_000;
const DEFAULT_HOST_ENROLL_TIMEOUT_MS = 90_000;
const DEFAULT_HOST_SIGN_CHECK_TIMEOUT_MS = 60_000;
const DEFAULT_SETUP_TIMEOUT_MS = 600_000;

/**
 * @param {string | undefined} raw
 * @param {number} fallback
 */
function parseTimeoutMs(raw, fallback) {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function hostStatusTimeoutMs() {
  return parseTimeoutMs(process.env.LIMINAL_KEYS_HOST_STATUS_TIMEOUT_MS, DEFAULT_HOST_STATUS_TIMEOUT_MS);
}

function hostEnrollTimeoutMs() {
  return parseTimeoutMs(process.env.LIMINAL_KEYS_HOST_ENROLL_TIMEOUT_MS, DEFAULT_HOST_ENROLL_TIMEOUT_MS);
}

function hostSignCheckTimeoutMs() {
  return parseTimeoutMs(
    process.env.LIMINAL_KEYS_HOST_SIGN_CHECK_TIMEOUT_MS,
    DEFAULT_HOST_SIGN_CHECK_TIMEOUT_MS,
  );
}

function hostSetupTimeoutMs() {
  return parseTimeoutMs(process.env.LIMINAL_KEYS_HOST_SETUP_TIMEOUT_MS, DEFAULT_SETUP_TIMEOUT_MS);
}

module.exports = {
  DEFAULT_HOST_STATUS_TIMEOUT_MS,
  DEFAULT_HOST_ENROLL_TIMEOUT_MS,
  hostStatusTimeoutMs,
  hostEnrollTimeoutMs,
  hostSignCheckTimeoutMs,
  hostSetupTimeoutMs,
};
