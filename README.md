# liminal-keys-ci-sample

**Sample / test repository** for Liminal Keys cloud CI signing (work item **lk-15a**: a one-day test on GitHub-hosted macOS runners).

It is public so hosted macOS runner minutes are free. It exists only to check whether the Liminal Keys virtual smartcard can sign non-interactively on a fresh hosted runner (`macos-14`, `macos-15`).

## Rules for this repo

- **Self-signed test identity only.** Every signature made from this repo uses a self-signed test certificate ("Liminal CI Test") held in a dedicated test workspace.
- **Never the real Developer ID.** This repo must never hold, reference, or be allowed by policy to use a real Apple Developer ID identity, an App Store Connect API key, or any production workspace data.
- **No secrets.** Do not add repository or environment secrets. Any short-lived value a test run needs is passed as a `workflow_dispatch` input right before the run.

## CTK spike (internal)

The spike workflow [`.github/workflows/ctk-spike.yml`](.github/workflows/ctk-spike.yml) executes work item **lk-15a**: proving or disproving whether the Liminal Keys CryptoTokenKit virtual smartcard signs non-interactively on standard GitHub-hosted macOS runners (`macos-14` Sonoma and `macos-15` Sequoia).

Run once per OS, with a fresh one-time enrollment code for each dispatch.

### Dispatch inputs

The workflow is triggered manually via `workflow_dispatch` (`gh workflow run ctk-spike.yml`):

| Input | Description | Default |
|---|---|---|
| `dmg_url` | URL to Liminal Keys Host DMG (must bundle `Contents/Helpers/LiminalKeysHostCLI`) | `https://www.liminalkeys.com/download/mac/` |
| `enrollment_code` | Short-lived one-time enrollment code minted right before dispatch (masked immediately) | *(Required)* |
| `api_base_url` | Liminal Keys API base URL | `https://api.liminalkeys.com` |
| `identity_sha1` | SHA-1 thumbprint of the test signing identity | *(Optional; autodetected if omitted)* |
| `os` | macOS runner for this dispatch (`macos-15` or `macos-14`). One OS per run; each run needs a fresh one-time code | `macos-15` |

### Execution steps

Each step runs with `continue-on-error: true` and tees logs to `$RUNNER_TEMP/spike/<step>.log`:

1. **System info & GUI session:** `sw_vers`, `csrutil status`, `id`, `launchctl print gui/$(id -u)`
2. **Download & install Host DMG:** fetch DMG, attach, ditto to `/Applications`, test `-x` for `Contents/Helpers/LiminalKeysHostCLI` (hard fails if missing, e.g. beta.2)
3. **Register Token Extension:** `lsregister -f`, `pluginkit -a`, `pluginkit -e use -i com.liminal.keys.host.token`, inspect with `pluginkit -mAvvv`
4. **Configure Smartcard Subsystem:** `security smartcards token -l`, enable driver with `sudo security smartcards token -e com.liminal.keys.host.token`, disable user pairing prompts with `sudo defaults write /Library/Preferences/com.apple.security.smartcard UserPairing -bool false`
5. **Launch Liminal Keys Host:** `open -gj -a "Liminal Keys Virtual Smartcard"`, sleep 5s to allow token service readiness
6. **CLI enroll, status & doctor:** `LiminalKeysHostCLI enroll`, `LiminalKeysHostCLI status --json --require-enrolled`, `LiminalKeysHostCLI doctor --identity $identity_sha1`
7. **Smartcard & identity check:** `security list-smartcards`, `security find-identity -v -p codesigning`
8. **Non-interactive codesign probe:** sign scratch binary `cp /usr/bin/true $RUNNER_TEMP/t` with `codesign -f -s $identity_sha1 --timestamp=none $RUNNER_TEMP/t` and verify with `codesign -dv`

### Diagnostics & Results

- **Diagnostics:** Always captures `screencapture -x $RUNNER_TEMP/spike/screenshot.png` and CTK logs via `log show --last 15m --predicate 'process == "ctkd" OR subsystem BEGINSWITH "com.liminal.keys"' --info`.
- **Sanitization:** Sanitizes and checks all logs for tokens, JWTs, or bearers before uploading.
- **Summary:** Emits a PASS/FAIL markdown table per step to `$GITHUB_STEP_SUMMARY`.
- **Artifact:** Uploads `$RUNNER_TEMP/spike` with 7-day retention (`spike-results-<os>`).
- **Template:** Record findings and final verdict in [`docs/spike-results.md`](docs/spike-results.md).

### Decision rule (lk-15c)

- **PASS on both `macos-14` and `macos-15`:** Proceed with CTK design (Action wraps Host + token extension).
- **FAIL on either runner:** Pivot to **Option B** (remote signer daemon / API-direct signer bypassing local CTK).

## Status

**lk-15a (CTK spike):** Completed 2026-10-21 on GitHub-hosted `macos-15` and `macos-14` — all steps 1–8 **PASS** (~30 s per job). Recorded in [`docs/spike-results.md`](docs/spike-results.md) (runs [39620918739](https://github.com/LiminalKeys/liminal-keys-ci-sample/actions/runs/39620918739), [39621520328](https://github.com/LiminalKeys/liminal-keys-ci-sample/actions/runs/39621520328)). **Verdict:** proceed with **Option A (CTK)** for lk-15d Action work.

**lk-15d:** Spike results captured; Action (`sign/`), sample workflow, and legacy spike workflow cleanup remain in progress (issue [#4](https://github.com/LiminalKeys/liminal-keys-ci-sample/issues/4)).

Product: https://www.liminalkeys.com
