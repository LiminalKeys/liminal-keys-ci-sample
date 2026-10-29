# Liminal Keys Sign (GitHub Action)

Ephemeral cloud CI signing for **macOS** GitHub Actions runners: install or reuse the Liminal Keys Host, enroll a short-lived CI device with **GitHub OIDC** (default) or an optional **`lkci_` CI key**, run `ci sign-check`, export the certificate **SHA-1** for `codesign`, then **revoke** the device in a post step.

**Host CLI:** **1.0.0-beta.4+** (see `scripts/VENDOR.json`). The Action maps Action input **`ttl-minutes`** to Host CLI **`--ttl`** (e.g. `60` → `--ttl 60m`). Do not pass `--ttl-minutes` to the CLI.

Customer quickstart (Console trust rule, variables, dry run, troubleshooting): [repository README](../README.md).

```yaml
- uses: LiminalKeys/liminal-keys-ci-sample/sign@v1
  with:
    tenant-id: ${{ vars.LIMINAL_KEYS_TENANT_ID }}
    identity-sha1: ${{ vars.LIMINAL_KEYS_CERT_SHA1 }}
```

## Permissions

```yaml
permissions:
  id-token: write
  contents: read
```

Without `id-token: write`, OIDC enrollment fails unless you pass `ci-key` from `secrets.*` (lower strength; for platforms without OIDC).

OIDC audience is `{api-base-url}/t/{tenant-id}` (default API base `https://api.liminalkeys.com`).

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `tenant-id` | yes | — | Liminal Keys tenant ID (Console → **Account & workspace** or **CI & automation**) |
| `identity-sha1` | no | — | Allowed identity SHA-1 (40 hex, colons/spaces stripped, uppercased). When omitted, enroll JSON **`identities[].sha1`** supplies the thumbprint for sign-check. |
| `ci-key` | no | — | `lkci_…` key from `secrets.*` only |
| `api-base-url` | no | `https://api.liminalkeys.com` | API base URL |
| `ttl-minutes` | no | `60` | CI device lifetime in minutes (5–120); passed to CLI as `--ttl {N}m` |
| `host-dmg-url` | no | latest public agent | Pin Host DMG URL |
| `host-dmg-sha256` | no | from API | Pin Host DMG SHA-256 |
| `install-host` | no | `auto` | Host install policy (see **Self-hosted runners** below) |

## Self-hosted runners

GitHub sets `RUNNER_ENVIRONMENT=self-hosted` on your own macOS machines. The bootstrap script for **GitHub-hosted** runners reinstalls the Host DMG (including `sudo rm -rf` under `/Applications`) and applies system-wide smartcard settings with `sudo`. That is appropriate for ephemeral runners but **must not** run on a developer Mac that already has Liminal Keys enrolled for daily use.

With the default `install-host: auto` on a self-hosted runner **when the Host app is already installed**:

- **No** DMG download, **no** `sudo rm -rf`, **no** `sudo security smartcards`, **no** `/Library/Preferences` changes.
- The Action launches the existing Host with `--ci-agent` (user session, no sudo) and runs `LiminalKeysHostCLI ci enroll` / `ci sign-check` against the installed helper at `/Applications/Liminal Keys Virtual Smartcard.app/Contents/Helpers/LiminalKeysHostCLI` (paths with spaces are supported).
- Before enroll, the Action runs a bounded **`status --json`** bridge check (default **20s**). Enroll and sign-check use bounded Host CLI timeouts (defaults **90s** / **60s**). Failures surface actionable messages such as **Host not in `--ci-agent` mode** or **Host not responding (keychain locked or prompt pending?)** with fix commands. Override via `LIMINAL_KEYS_HOST_STATUS_TIMEOUT_MS`, `LIMINAL_KEYS_HOST_ENROLL_TIMEOUT_MS`, and related env vars on the runner.
- **`ci enroll` / `ci unenroll` use a separate CI device** (`ci-agent-state.json` and Keychain tag `com.liminal.keys.device-auth.ci`), not your interactive enrollment (`agent-state.json` / `com.liminal.keys.device-auth`). Post-step **`ci unenroll` revokes only the ephemeral CI device**; it does not call interactive `unenroll`.
- Teardown **does not** `pkill` the Host on self-hosted runners (your GUI Host keeps running).

| `install-host` | Self-hosted, app present | Self-hosted, app missing | GitHub-hosted |
| --- | --- | --- | --- |
| `auto` (default) | Reuse installed Host | Install DMG (`sudo -n` only; no rm if absent) | Full install + sudo smartcard setup |
| `always` | Reuse (never remove existing app) | Install DMG | Full install + sudo smartcard setup |
| `never` | Reuse; fail if CLI missing | Fail fast | Skip install; fail if CLI missing |

All remaining `sudo` calls in the install path use **`sudo -n`** so a password prompt fails immediately instead of hanging.

If `ci enroll` or `ci sign-check` fails because the token extension or smartcard subsystem was never enabled on that Mac, fix it once interactively (System Settings → Crypto Token, or enable `com.liminal.keys.host.token` locally). The Action will **not** attempt privileged system changes on self-hosted runners when reusing an existing install.

## Outputs

| Output | Description |
| --- | --- |
| `signing-sha1` | Certificate SHA-1 for `codesign -s` |
| `device-id` | Ephemeral device ID |
| `expires-at` | Server-side expiry (ISO) |

The main step also exports job env vars `LIMINAL_KEYS_SIGNING_SHA1` and `LIMINAL_KEYS_DEVICE_ID`.

Enroll stdout is parsed as JSON (`--json`). Expected shape: **`deviceId`** plus **`identities[]`** with **`sha1`** (legacy top-level `signingSha1` is also accepted).

## Security model

- **OIDC (default):** The Action requests an ID token with audience `https://api.liminalkeys.com/t/{tenant-id}` and passes it to `LiminalKeysHostCLI ci enroll` via environment variables only. No enrollment codes in workflows. Console **GitHub trust rules** must allow the repository and **ref/branch** (and environment, if used); otherwise enroll returns **403** (`The identity token was refused.`).
- **CI key (optional):** `ci-key` must come from `secrets.*`. The Action calls `core.setSecret` before any subprocess runs.
- **Redaction:** Tokens, CI keys, and bearer material are never logged. Workflow `run:` steps must not embed `${{ secrets.* }}` or sensitive `${{ inputs.* }}` — use `env:` and shell variables.
- **Lifetime:** Server TTL (default 60 minutes, max 120) bounds exposure if a runner crashes. The post step calls `ci unenroll` and teardown; post failures are warnings only.
- **Keys:** Private keys stay non-exportable in **Key Vault**; they never leave Liminal Keys custody.

## GitHub Environments

To use **environment-scoped** `vars.LIMINAL_KEYS_TENANT_ID`, set `environment: <name>` on the job. Variables resolve from that environment automatically. **`github.environment` is not a valid expression context.**

## Development

```bash
cd sign
npm ci
npm test
npm run build
npm run verify:dist
git diff --exit-code dist/
```

`npm run verify:dist` loads `dist/main/index.js` and `dist/post/index.js` with Node to catch missing bundled dependencies (e.g. stray `sourcemap-register` requires).

Vendored bootstrap scripts live in `sign/scripts/` (see `VENDOR.json` for SHA-256 pins). They mirror `scripts/ci/*` from the Liminal Keys Host release and launch the Host with `--ci-agent`.
