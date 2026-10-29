# Liminal Keys Upload (`upload@v1`)

Composite Action for **App Store Connect upload without a `.p8` on the runner**:

1. Installs and verifies the cross-platform `liminal-keys` CLI (`setup-liminal-keys`).
2. Enrolls an ephemeral CI device (GitHub OIDC or `lkci_` key).
3. Mints a short-lived ASC JWT via your **`mint_asc_token`** policy rule.
4. Runs `liminal-keys upload --ipa …`.

## Prerequisites

- Console: ASC key imported, **`mint_asc_token`** allow rule for your GitHub CI trust, policy applied.
- GitHub: `permissions.id-token: write` (unless using `ci-key`).
- CLI release **`cli-v0.1.0`** or newer (includes `upload` and `asc token`). Pin `cli-version` and `cli-sha256` from [Liminal Keys CLI releases](https://github.com/LiminalKeys/liminal-keys/releases).

## Inputs

| Input | Required | Notes |
| --- | --- | --- |
| `tenant-id` | yes | Workspace tenant UUID |
| `asc-key-id` | yes | Liminal ASC upload key UUID |
| `ipa-path` | yes | Path to `.ipa` |
| `bundle-id` | REST | e.g. `com.devfinition.playsync` |
| `app-id` | REST | Alternative to bundle-id |
| `transporter` | no | `true` for iTMSTransporter (macOS only) |
| `cli-version` | yes | Semver from `cli-v*` tag |
| `cli-sha256` | yes | From `SHA256SUMS.txt` for this runner OS/arch |

## Always unenroll

Composite Actions cannot run post steps. After this Action, add:

```yaml
- name: CI unenroll
  if: always()
  run: liminal-keys ci unenroll --json
```

## Example

See [`.github/workflows/asc-upload-broker.template.yml`](../.github/workflows/asc-upload-broker.template.yml).
