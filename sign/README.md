# Liminal Keys Sign (GitHub Action)

Ephemeral cloud CI signing for **macOS** GitHub Actions runners: install the Liminal Keys Host, enroll a short-lived CI device with **GitHub OIDC** (default) or an optional **`lkci_` CI key**, run `ci sign-check`, export the certificate **SHA-1** for `codesign`, then **revoke** the device in a post step.

Use as a path action in this repo (`./sign`) or after release tagging:

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

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `tenant-id` | yes | — | Liminal Keys tenant ID |
| `identity-sha1` | no | — | Allowed identity SHA-1 (40 hex, colons/spaces stripped, uppercased) |
| `ci-key` | no | — | `lkci_…` key from `secrets.*` only |
| `api-base-url` | no | `https://api.liminalkeys.com` | API base URL |
| `ttl-minutes` | no | `60` | CI device TTL (5–120) |
| `host-dmg-url` | no | latest public agent | Pin Host DMG URL |
| `host-dmg-sha256` | no | from API | Pin Host DMG SHA-256 |

## Outputs

| Output | Description |
| --- | --- |
| `signing-sha1` | Certificate SHA-1 for `codesign -s` |
| `device-id` | Ephemeral device ID |
| `expires-at` | Server-side expiry (ISO) |

The main step also exports job env vars `LIMINAL_KEYS_SIGNING_SHA1` and `LIMINAL_KEYS_DEVICE_ID`.

## Security model

- **OIDC (default):** The Action requests an ID token with audience `https://api.liminalkeys.com/t/{tenant-id}` and passes it to `LiminalKeysHostCLI ci enroll` via environment variables only. No enrollment codes in workflows.
- **CI key (optional):** `ci-key` must come from `secrets.*`. The Action calls `core.setSecret` before any subprocess runs.
- **Redaction:** Tokens, CI keys, and bearer material are never logged. Workflow `run:` steps must not embed `${{ secrets.* }}` or `${{ inputs.* }}` for sensitive values—use `env:` and shell variables.
- **Lifetime:** Server TTL (default 60 minutes, max 120) bounds exposure if a runner crashes. The post step calls `ci unenroll` and teardown; post failures are warnings only.
- **Keys:** Private keys stay non-exportable and software-protected in Azure Key Vault; they never leave Liminal Keys custody.

## Development

```bash
cd sign
npm ci
npm test
npm run build
git diff --exit-code dist/
```

Vendored bootstrap scripts live in `sign/scripts/` (see `VENDOR.json` for SHA-256 pins). They mirror `scripts/ci/*` from the Liminal Keys Host release and launch the Host with `--ci-agent`.
