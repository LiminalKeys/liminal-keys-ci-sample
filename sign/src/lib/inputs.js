'use strict';

const HEX40 = /^[0-9A-F]{40}$/;

/**
 * @param {string | undefined} raw
 * @returns {string | undefined}
 */
function normalizeIdentitySha1(raw) {
  if (!raw || !String(raw).trim()) {
    return undefined;
  }
  const normalized = String(raw).replace(/[\s:]/g, '').toUpperCase();
  if (!HEX40.test(normalized)) {
    throw new Error(
      'identity-sha1 must be a 40-character hex SHA-1 thumbprint (colons and spaces are stripped).',
    );
  }
  return normalized;
}

/**
 * @param {string | undefined} raw
 * @returns {number}
 */
function parseTtlMinutes(raw) {
  const value = raw === undefined || raw === '' ? 60 : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(value) || value < 5 || value > 120) {
    throw new Error('ttl-minutes must be an integer between 5 and 120.');
  }
  return value;
}

/**
 * @param {string | undefined} raw
 * @returns {string}
 */
function normalizeApiBaseUrl(raw) {
  const base = (raw && String(raw).trim()) || 'https://api.liminalkeys.com';
  return base.replace(/\/+$/, '');
}

module.exports = {
  normalizeIdentitySha1,
  parseTtlMinutes,
  normalizeApiBaseUrl,
  HEX40,
};
