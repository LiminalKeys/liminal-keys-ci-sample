'use strict';

const fs = require('node:fs');
const path = require('node:path');
const core = require('@actions/core');
const { HOST_CLI, teardownScriptPath } = require('./lib/paths');
const { execCapture, parseLastJsonObject } = require('./lib/exec-json');
const { safeErrorMessage } = require('./lib/redaction');

async function runPost() {
  try {
    if (process.platform !== 'darwin') {
      core.warning('Post step skipped: not a macOS runner.');
      return;
    }

    const apiBaseUrl = core.getState('apiBaseUrl') || 'https://api.liminalkeys.com';
    const actionRoot = core.getState('actionRoot') || path.join(__dirname, '..');
    const deviceId = core.getState('deviceId');

    let unenrollMessage = 'not attempted';
    if (fs.existsSync(HOST_CLI)) {
      const unenrollResult = await execCapture(HOST_CLI, ['ci', 'unenroll', '--json'], {
        env: {
          ...process.env,
          LIMINAL_KEYS_API_BASE_URL: apiBaseUrl,
        },
        secrets: [],
      });
      if (unenrollResult.exitCode === 0) {
        try {
          const payload = parseLastJsonObject(unenrollResult.stdout);
          const revoked =
            payload.revoked ??
            payload.selfRevoked ??
            payload.status ??
            payload.message ??
            'ok';
          unenrollMessage = `device revoked (${String(revoked)})`;
        } catch {
          unenrollMessage = 'device revoked (unenroll exit 0)';
        }
      } else {
        unenrollMessage = `unenroll failed (exit ${unenrollResult.exitCode}); server TTL will expire the device`;
        core.warning(unenrollMessage);
        if (unenrollResult.stderr) {
          core.warning(unenrollResult.stderr.slice(0, 2000));
        }
      }
    } else {
      unenrollMessage = 'Host CLI not installed; skipped unenroll';
      core.warning(unenrollMessage);
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
