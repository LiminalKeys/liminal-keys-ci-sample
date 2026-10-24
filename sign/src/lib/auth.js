'use strict';

/**
 * @param {{ ciKey: string; hasIdTokenRequestUrl: boolean }} params
 * @returns {string | undefined} error message when invalid
 */
function validateOidcOrCiKey(params) {
  if (params.ciKey) {
    return undefined;
  }
  if (!params.hasIdTokenRequestUrl) {
    return 'GitHub OIDC is unavailable. Add `permissions: id-token: write` to the job (or pass ci-key from secrets for non-OIDC runners).';
  }
  return undefined;
}

module.exports = {
  validateOidcOrCiKey,
};
