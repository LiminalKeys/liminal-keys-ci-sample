'use strict';

/** @typedef {'status' | 'enroll' | 'sign-check' | 'setup'} HostCiPhase */

const CI_AGENT_MARKERS = [
  'Host not in --ci-agent mode',
  'without CI agent support',
  'CI agent service unavailable',
];

const HOST_TIMEOUT_MARKERS = [
  'Host not responding (keychain locked or prompt pending?)',
  'timed out waiting for Host response',
  'CLI bridge timed out',
  'ETIMEDOUT',
  'timed out',
];

const FIX_CI_AGENT =
  'Fix: quit Liminal Keys Host, then run: open -gj -a "Liminal Keys Virtual Smartcard" --args --ci-agent ' +
  '(or re-run this job so the setup step launches the Host in CI agent mode).';

const FIX_HOST_RESPONDING =
  'Fix: unlock the macOS login keychain on the runner, approve any Liminal Keys Host prompts, ensure the Host ' +
  'app is running, then re-run. Self-hosted: open -gj -a "Liminal Keys Virtual Smartcard" --args --ci-agent';

/**
 * @param {object} params
 * @param {number} params.exitCode
 * @param {string} params.stdout
 * @param {string} params.stderr
 * @param {boolean} [params.timedOut]
 * @param {HostCiPhase} [params.phase]
 * @returns {{ headline: string; detail: string }}
 */
function classifyHostCliFailure({ exitCode, stdout, stderr, timedOut = false, phase = 'enroll' }) {
  const blob = `${stdout}\n${stderr}`.trim();
  const lower = blob.toLowerCase();

  if (timedOut || HOST_TIMEOUT_MARKERS.some((m) => lower.includes(m.toLowerCase()))) {
    return {
      headline: 'Host not responding (keychain locked or prompt pending?)',
      detail: [blob, FIX_HOST_RESPONDING].filter(Boolean).join('\n\n'),
    };
  }

  if (CI_AGENT_MARKERS.some((m) => blob.includes(m) || lower.includes(m.toLowerCase()))) {
    return {
      headline: 'Host not in --ci-agent mode',
      detail: [blob, FIX_CI_AGENT].filter(Boolean).join('\n\n'),
    };
  }

  const phaseLabel = phase === 'status' ? 'Host status check' : `ci ${phase}`;
  return {
    headline: `${phaseLabel} failed (exit ${exitCode}).`,
    detail: blob || '(no Host CLI output)',
  };
}

module.exports = {
  FIX_CI_AGENT,
  FIX_HOST_RESPONDING,
  classifyHostCliFailure,
};
