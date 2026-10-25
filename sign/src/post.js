'use strict';

const fs = require('node:fs');
const path = require('node:path');
const core = require('@actions/core');
const { HOST_CLI, resolveActionRoot, teardownScriptPath } = require('./lib/paths');
const { execCapture, parseLastJsonObject, summarizeUnenrollPayload } = require('./lib/exec-json');
const { buildCiUnenrollArgs } = require('./lib/host-cli-args');
const { safeErrorMessage } = require('./lib/redaction');

async function runPost() {
  try {
    if (process.platform !== 'darwin') {
      core.warning('Post step skipped: not a macOS runner.');
      return;
    }

    const apiBaseUrl = core.getState('apiBaseUrl') || 'https://api.liminalkeys.com';
    const actionRoot = core.getState('actionRoot') || resolveActionRoot(__dirname);
    const deviceId = core.getState('deviceId');

    const ciEnrollCompleted = core.getState('ciEnrollCompleted') === '1';
    let unenrollMessage = 'not attempted';
    if (fs.existsSync(HOST_CLI) && (ciEnrollCompleted || core.getState('deviceId'))) {
      const unenrollResult = await execCapture(HOST_CLI, buildCiUnenrollArgs({ apiBaseUrl }), {
        env: {
          ...process.env,
          LIMINAL_KEYS_API_BASE_URL: apiBaseUrl,
        },
        secrets: [],
      });
      if (unenrollResult.exitCode === 0) {
        try {
          const payload = parseLastJsonObject(unenrollResult.stdout);
          unenrollMessage = `device revoked (${summarizeUnenrollPayload(payload)})`;
        } catch (err) {
          if (err && typeof err === 'object' && Array.isArray(err.topLevelKeys) && err.topLevelKeys.length > 0) {
            core.warning(`CLI unenroll JSON top-level keys: ${err.topLevelKeys.join(', ')}`);
          }
          unenrollMessage = 'device revoked (unenroll exit 0)';
        }
      } else {
        unenrollMessage = `unenroll failed (exit ${unenrollResult.exitCode}); server TTL will expire the device`;
        core.warning(unenrollMessage);
        if (unenrollResult.stderr) {
          core.warning(unenrollResult.stderr.slice(0, 2000));
        }
      }
    } else if (!fs.existsSync(HOST_CLI)) {
      unenrollMessage = 'Host CLI not installed; skipped unenroll';
      core.warning(unenrollMessage);
    } else {
      unenrollMessage = 'skipped unenroll (no CI enroll recorded on this job)';
    }

    const teardownScript = teardownScriptPath(actionRoot);
    if (fs.existsSync(teardownScript)) {
      const teardownResult = await execCapture('bash', [teardownScript], {
        env: process.env,
        secrets: [],
      });
      if (teardownResult.exitCode !== 0) {
        core.warning('Teardown script exited non-zero; continuing.');
      }
    }

    core.saveState('postUnenrollMessage', unenrollMessage);
    if (deviceId) {
      core.summary
        .addRaw(`\n### Liminal Keys post-step\n- **Device ID:** \`${deviceId}\`\n- **Revoke:** ${unenrollMessage}\n`)
        .write();
    } else {
      core.summary.addRaw(`\n### Liminal Keys post-step\n- **Revoke:** ${unenrollMessage}\n`).write();
    }
  } catch (err) {
    core.warning(safeErrorMessage(err instanceof Error ? err.message : String(err), []));
  }
}

if (!process.env.VITEST) {
  runPost();
}

module.exports = { runPost };
