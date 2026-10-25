'use strict';

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
function isSelfHostedRunner(env = process.env) {
  return String(env.RUNNER_ENVIRONMENT ?? '').toLowerCase() === 'self-hosted';
}

module.exports = {
  isSelfHostedRunner,
};
