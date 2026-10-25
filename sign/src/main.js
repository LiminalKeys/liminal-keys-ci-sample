'use strict';

const fs = require('node:fs');
const path = require('node:path');
const core = require('@actions/core');
const {
  normalizeIdentitySha1,
  parseTtlMinutes,
  normalizeApiBaseUrl,
  parseInstallHost,
} = require('./lib/inputs');
const { isSelfHostedRunner } = require('./lib/runner');
const { safeErrorMessage, containsSecret } = require('./lib/redaction');
const { HOST_CLI, resolveActionRoot, setupScriptPath } = require('./lib/paths');
const {
  execCapture,
  parseLastJsonObject,
  pickEnrollFields,
  tryPickDeviceId,
  parseSignCheckReport,
} = require('./lib/exec-json');
const { buildCiEnrollArgs, buildCiSignCheckArgs } = require('./lib/host-cli-args');
const { validateOidcOrCiKey } = require('./lib/auth');

/**
 * @param {unknown} err
 * @param {string[]} secrets
 */
function failCliJsonParse(err, secrets) {
  if (err && typeof err === 'object' && Array.isArray(err.topLevelKeys) && err.topLevelKeys.length > 0) {
    core.error(`CLI JSON top-level keys: ${err.topLevelKeys.join(', ')}`);
  }
  core.setFailed(safeErrorMessage(err instanceof Error ? err.message : String(err), secrets));
}

async function run() {
  if (process.platform !== 'darwin') {
    core.setFailed('The Liminal Keys sign Action requires a macOS runner (darwin).');
    return;
  }

  const tenantId = core.getInput('tenant-id', { required: true }).trim();
  if (!tenantId) {
    core.setFailed('tenant-id is required.');
    return;
  }

  let identitySha1;
  try {
    identitySha1 = normalizeIdentitySha1(core.getInput('identity-sha1'));
  } catch (err) {
    core.setFailed(safeErrorMessage(err instanceof Error ? err.message : String(err), []));
    return;
  }

  const ciKeyRaw = core.getInput('ci-key');
  const ciKey = ciKeyRaw ? ciKeyRaw.trim() : '';
  if (ciKey) {
    core.setSecret(ciKey);
  }

  let ttlMinutes;
  try {
    ttlMinutes = parseTtlMinutes(core.getInput('ttl-minutes'));
  } catch (err) {
    core.setFailed(safeErrorMessage(err instanceof Error ? err.message : String(err), []));
    return;
  }

  const apiBaseUrl = normalizeApiBaseUrl(core.getInput('api-base-url'));
  const hostDmgUrl = core.getInput('host-dmg-url').trim();
  const hostDmgSha256 = core.getInput('host-dmg-sha256').trim();

  let installHost;
  try {
    installHost = parseInstallHost(core.getInput('install-host'));
  } catch (err) {
    core.setFailed(safeErrorMessage(err instanceof Error ? err.message : String(err), []));
    return;
  }

  const selfHosted = isSelfHostedRunner();
  const hostCliReady = fs.existsSync(HOST_CLI);
  if (installHost === 'never' && !hostCliReady) {
    core.setFailed(
      `install-host is \`never\` but Liminal Keys Host CLI is not installed at ${HOST_CLI}. Install the Host app on this runner or use install-host: auto.`,
    );
    return;
  }

  const secrets = [];
  if (ciKey) {
    secrets.push(ciKey);
  }

  let githubOidcToken = '';
  const oidcError = validateOidcOrCiKey({
    ciKey,
    hasIdTokenRequestUrl: Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL),
  });
  if (oidcError) {
    core.setFailed(oidcError);
    return;
  }

  if (!ciKey) {
    const audience = `${apiBaseUrl}/t/${tenantId}`;
    githubOidcToken = await core.getIDToken(audience);
    core.setSecret(githubOidcToken);
    secrets.push(githubOidcToken);
  }

  const actionRoot = resolveActionRoot(__dirname);
  const setupScript = setupScriptPath(actionRoot);
  if (!fs.existsSync(setupScript)) {
    core.setFailed(`Setup script missing at ${setupScript}`);
    return;
  }

  core.saveState('actionRoot', actionRoot);
  core.saveState('apiBaseUrl', apiBaseUrl);
  core.saveState('tenantId', tenantId);
  core.saveState('selfHostedRunner', selfHosted ? '1' : '0');

  const setupEnv = {
    ...process.env,
    LIMINAL_KEYS_API_BASE_URL: apiBaseUrl,
    LIMINAL_KEYS_INSTALL_HOST: installHost,
    ...(hostDmgUrl ? { LIMINAL_KEYS_HOST_DMG_URL: hostDmgUrl } : {}),
    ...(hostDmgSha256 ? { LIMINAL_KEYS_HOST_DMG_SHA256: hostDmgSha256 } : {}),
  };

  if (selfHosted && hostCliReady) {
    core.info(
      'Self-hosted runner with existing Host: skipping destructive install; CI enroll uses a separate ephemeral device identity.',
    );
  } else {
    core.info('Running Host setup (DMG install, token extension, CI agent)...');
  }
  const setupResult = await execCapture('bash', [setupScript], {
    env: setupEnv,
    secrets,
  });
  if (setupResult.exitCode !== 0) {
    core.error(setupResult.stderr || setupResult.stdout);
    core.setFailed('Host setup failed.');
    return;
  }

  const enrollEnv = {
    ...process.env,
    LIMINAL_KEYS_API_BASE_URL: apiBaseUrl,
    LIMINAL_KEYS_TENANT_ID: tenantId,
    ...(ciKey ? { LIMINAL_KEYS_CI_KEY: ciKey } : { LIMINAL_KEYS_GITHUB_OIDC_TOKEN: githubOidcToken }),
  };

  const enrollArgs = buildCiEnrollArgs({
    tenantId,
    ttlMinutes,
    apiBaseUrl,
    identitySha1,
    useCiKey: Boolean(ciKey),
  });

  core.info('Enrolling ephemeral CI signing device...');
  const enrollResult = await execCapture(HOST_CLI, enrollArgs, {
    env: enrollEnv,
    secrets,
  });
  if (enrollResult.exitCode !== 0) {
    core.error(enrollResult.stderr || enrollResult.stdout);
    core.setFailed('ci enroll failed.');
    return;
  }

  core.saveState('ciEnrollCompleted', '1');

  let enrollPayload;
  try {
    enrollPayload = parseLastJsonObject(enrollResult.stdout);
  } catch (err) {
    failCliJsonParse(err, secrets);
    return;
  }

  let fields;
  try {
    fields = pickEnrollFields(enrollPayload, { preferredIdentitySha1: identitySha1 });
  } catch (err) {
    const partialDeviceId = tryPickDeviceId(enrollPayload);
    if (partialDeviceId) {
      core.saveState('deviceId', partialDeviceId);
    }
    failCliJsonParse(err, secrets);
    return;
  }

  if (identitySha1 && fields.signingSha1 !== identitySha1) {
    core.warning(
      `Enrolled signing SHA-1 (${fields.signingSha1}) differs from identity-sha1 input (${identitySha1}).`,
    );
  }

  const signCheckIdentity = identitySha1 ?? fields.signingSha1;
  const signCheckArgs = buildCiSignCheckArgs({
    identitySha1: signCheckIdentity,
    apiBaseUrl,
  });

  core.info('Running ci sign-check...');
  const signCheckResult = await execCapture(HOST_CLI, signCheckArgs, {
    env: {
      ...process.env,
      LIMINAL_KEYS_API_BASE_URL: apiBaseUrl,
    },
    secrets,
  });
  if (signCheckResult.exitCode !== 0) {
    core.error(signCheckResult.stderr || signCheckResult.stdout);
    core.setFailed('ci sign-check failed.');
    return;
  }

  try {
    const signCheckPayload = parseLastJsonObject(signCheckResult.stdout);
    const report = parseSignCheckReport(signCheckPayload);
    if (!report.ok) {
      core.setFailed('ci sign-check JSON reported ok=false.');
      return;
    }
  } catch (err) {
    failCliJsonParse(err, secrets);
    return;
  }

  core.setOutput('signing-sha1', fields.signingSha1);
  core.setOutput('device-id', fields.deviceId);
  core.setOutput('expires-at', fields.expiresAt);
  core.exportVariable('LIMINAL_KEYS_SIGNING_SHA1', fields.signingSha1);
  core.exportVariable('LIMINAL_KEYS_DEVICE_ID', fields.deviceId);

  core.saveState('deviceId', fields.deviceId);
  core.saveState('expiresAt', fields.expiresAt);

  const summary = [
    '### Liminal Keys CI enroll',
    `- **Device ID:** \`${fields.deviceId}\``,
    `- **Signing SHA-1:** \`${fields.signingSha1}\``,
    fields.expiresAt ? `- **Expires at:** \`${fields.expiresAt}\`` : '',
  ]
    .filter(Boolean)
    .join('\n');
  core.summary.addRaw(summary).write();

  if (containsSecret(summary, secrets)) {
    core.setFailed('Internal error: summary would have exposed a secret.');
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
