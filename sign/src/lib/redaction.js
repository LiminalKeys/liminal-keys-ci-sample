'use strict';

/**
 * @param {string} text
 * @param {readonly string[]} secrets
 * @returns {string}
 */
function redactSecrets(text, secrets) {
  let out = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) {
      continue;
    }
    out = out.split(secret).join('***');
  }
  return out;
}

/**
 * @param {string} message
 * @param {readonly string[]} secrets
 * @returns {string}
 */
function safeErrorMessage(message, secrets) {
  return redactSecrets(String(message), secrets);
}

/**
 * Returns true when the message still contains any secret substring.
 * @param {string} message
 * @param {readonly string[]} secrets
 */
function containsSecret(message, secrets) {
  const msg = String(message);
  return secrets.some((s) => s && s.length >= 4 && msg.includes(s));
}

module.exports = {
  redactSecrets,
  safeErrorMessage,
  containsSecret,
};
