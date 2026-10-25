'use strict';

/**
 * Host CLI JSON shapes (LiminalKeysHostCLI 1.0.0-beta.4):
 * - ci enroll / ci unenroll: CiEnrollCLIResult (CiAgentSupport.swift) — camelCase keys
 * - ci sign-check: HostDoctorReport (HostDoctor.swift) — ok, checks[]
 */

class CliJsonParseError extends Error {
  /**
   * @param {string} message
   * @param {string[]} topLevelKeys
   */
  constructor(message, topLevelKeys = []) {
    super(message);
    this.name = 'CliJsonParseError';
    this.topLevelKeys = topLevelKeys;
  }
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function topLevelKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value);
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeSha1Thumbprint(raw) {
  return String(raw).replace(/[\s:]/g, '').toUpperCase();
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string[]} keys
 * @returns {string | undefined}
 */
function pickStringField(obj, keys) {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return undefined;
}

/**
 * @param {unknown} identities
 * @param {string | undefined} preferredSha1
 * @returns {string | undefined}
 */
function pickSigningSha1FromIdentities(identities, preferredSha1) {
  if (!Array.isArray(identities)) {
    return undefined;
  }
  const thumbs = [];
  for (const entry of identities) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const raw =
      /** @type {Record<string, unknown>} */ (entry).sha1 ??
      /** @type {Record<string, unknown>} */ (entry).sha1Thumbprint ??
      /** @type {Record<string, unknown>} */ (entry).sha1_thumbprint ??
      /** @type {Record<string, unknown>} */ (entry).sha1Fingerprint ??
      /** @type {Record<string, unknown>} */ (entry).sha1_fingerprint;
    if (raw) {
      thumbs.push(normalizeSha1Thumbprint(raw));
    }
  }
  if (thumbs.length === 0) {
    return undefined;
  }
  if (preferredSha1) {
    const normalizedPreferred = normalizeSha1Thumbprint(preferredSha1);
    if (thumbs.includes(normalizedPreferred)) {
      return normalizedPreferred;
    }
  }
  return thumbs[0];
}

/**
 * @param {string} stdout
 * @returns {Record<string, unknown>}
 */
function parseLastJsonObject(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new CliJsonParseError('CLI returned empty stdout; expected JSON with --json.', []);
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
    throw new CliJsonParseError(
      `Failed to parse CLI JSON: ${err instanceof Error ? err.message : String(err)}`,
      [],
    );
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {{ preferredIdentitySha1?: string }} [options]
 */
function pickEnrollFields(payload, options = {}) {
  const keys = topLevelKeys(payload);

  const deviceId = pickStringField(payload, ['deviceId', 'device_id', 'device-id']);
  let signingSha1 = pickStringField(payload, [
    'signingSha1',
    'signing_sha1',
    'signingSHA1',
    'signing-sha1',
  ]);

  if (!signingSha1) {
    signingSha1 = pickSigningSha1FromIdentities(payload.identities, options.preferredIdentitySha1);
  }

  if (!signingSha1 || !deviceId) {
    throw new CliJsonParseError(
      'CLI enroll JSON missing deviceId and/or signing SHA-1 (expected CiEnrollCLIResult: deviceId + identities[].sha1, or legacy signingSha1).',
      keys,
    );
  }

  const expiresAt = pickStringField(payload, [
    'expiresAt',
    'expires_at',
    'expires-at',
    'deviceExpiresAt',
    'device_expires_at',
  ]);

  return {
    signingSha1: normalizeSha1Thumbprint(signingSha1),
    deviceId,
    expiresAt: expiresAt ?? '',
  };
}

/**
 * Best-effort device id when full enroll field extraction fails.
 * @param {Record<string, unknown>} payload
 * @returns {string | undefined}
 */
function tryPickDeviceId(payload) {
  return pickStringField(payload, ['deviceId', 'device_id', 'device-id']);
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
function summarizeUnenrollPayload(payload) {
  if (payload.ok === true) {
    return 'ok';
  }
  const revoked = pickStringField(payload, ['revoked', 'selfRevoked', 'status', 'message']);
  return revoked ?? 'ok';
}

/**
 * @param {Record<string, unknown>} payload
 */
function parseSignCheckReport(payload) {
  const keys = topLevelKeys(payload);
  if (typeof payload.ok !== 'boolean') {
    throw new CliJsonParseError(
      'CLI sign-check JSON missing boolean ok (expected HostDoctorReport).',
      keys,
    );
  }
  return { ok: payload.ok, checks: Array.isArray(payload.checks) ? payload.checks : [] };
}

module.exports = {
  CliJsonParseError,
  topLevelKeys,
  parseLastJsonObject,
  pickEnrollFields,
  tryPickDeviceId,
  summarizeUnenrollPayload,
  parseSignCheckReport,
};
