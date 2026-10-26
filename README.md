# Liminal Keys — GitHub Actions signing (macOS / iOS)

Companies keep control of their most valuable assets — **certificates and signing keys** — in **Key Vault**, while agencies and contractors build and ship under the company’s policy. Liminal Keys connects CI to that custody without copying private keys onto runners.

Sign macOS and iOS builds in GitHub Actions with **ephemeral CI devices**: GitHub OIDC (or an optional `lkci_` key), the [`sign`](sign/) Action (`LiminalKeys/liminal-keys-ci-sample/sign@v1`), optional [`export`](export/) for App Store IPA export + verification (`export@v1`), and your signing identity stored in **Key Vault**. Private keys never leave Liminal Keys custody.

**Reference:** [WatchTeams](https://www.liminalkeys.com/customers/watchteams/) **2.1.0** shipped to the App Store with signatures from end to end through this CI path (ephemeral CI device, no smart card on the runner).

This repository ships the Actions, **dry-run** and **sign-sample** workflows, and copy-paste **templates** for App Store / TestFlight and Developer ID + notarization. Use it as the only reference to go from zero to a signed build — no access to the private `liminal-keys` repo.

---

## Quickstart (zero → signed build)

### 1. Prerequisites

| Requirement | Notes |
| --- | --- |
| **Liminal Keys workspace** | Signing identity uploaded or created in Console; you know which certificate SHA-1 to allow. |
| **macOS runner** | GitHub-hosted (`macos-14`, `macos-15`) **or** a **self-hosted** Mac (`runs-on: [self-hosted, macOS]`). The Action runs only on `darwin`. |
| **Host app (self-hosted)** | Install **Liminal Keys Virtual Smartcard** under `/Applications` on the Mac runner. Default `install-host: auto` reuses it and **does not** run destructive `sudo rm` or system smartcard changes. |
| **Host CLI version** | **1.0.0-beta.4** or newer (bundled in the public Host DMG). GitHub-hosted runners get the latest DMG automatically unless you pin `host-dmg-url` / `host-dmg-sha256`. |
| **GitHub repo** | Where your app and workflow live (public or private). |

### 2. Console — trust GitHub and allow CI signing

1. Open [Liminal Keys Console](https://console.liminalkeys.com) and select your workspace.
2. **Copy your tenant ID** (UUID). It appears under **Account & workspace** and under **CI & automation** — you need it for GitHub variables and for the OIDC audience.
3. **CI & automation → GitHub trust rules** — create a rule for this repository:
   - **Repository** — `owner/repo` (exact match for private repos).
   - **Ref / branch** — restrict to branches that will run signing (e.g. `refs/heads/main` only). Runs from **other branches are rejected** at enroll time (see Troubleshooting).
   - Optionally scope by **GitHub Environment** name if you use environment-scoped variables and protection rules.
4. **Signing policy** — allow the certificate you will use in CI. For OIDC enrollment, include a subject that matches **CI workload (trusted issuer)** (Console wording for GitHub OIDC–backed CI devices).
5. Note the **SHA-1 thumbprint** of that certificate (40 hex characters; colons optional). You will pass it as `identity-sha1` or `LIMINAL_KEYS_CERT_SHA1`.

### 3. GitHub — variables and permissions

**Repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
| --- | --- |
| `LIMINAL_KEYS_TENANT_ID` | Tenant UUID from Console |
| `LIMINAL_KEYS_CERT_SHA1` | Allowed signing identity SHA-1 (optional for dry run if any enrolled identity is acceptable; recommended for production) |

**Environment-scoped variables:** If `LIMINAL_KEYS_TENANT_ID` (or SHA-1) lives on a **GitHub Environment**, you must set `environment: <name>` on the **job**. Then `${{ vars.LIMINAL_KEYS_TENANT_ID }}` resolves in that job. There is **no** `github.environment` context — use a job-level `environment:` key instead.

Every job that uses OIDC (default) needs:

```yaml
permissions:
  id-token: write
  contents: read
```

Without `id-token: write`, enrollment fails unless you pass `ci-key` from `secrets.*`.

### 4. Dry run first (enroll + sign-check, no codesign)

Copy [`.github/workflows/liminal-keys-dry-run.yml`](.github/workflows/liminal-keys-dry-run.yml) into your repo (or paste the workflow below). Run it via **Actions → Liminal Keys dry run → Run workflow** on a **branch allowed by your trust rule** (often `main`).

```yaml
name: Liminal Keys dry run

on:
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  verify-signing:
    runs-on: macos-15   # or self-hosted macOS labels
    env:
      LIMINAL_KEYS_TENANT_ID: ${{ vars.LIMINAL_KEYS_TENANT_ID }}
      LIMINAL_KEYS_CERT_SHA1: ${{ vars.LIMINAL_KEYS_CERT_SHA1 }}
    steps:
      - name: Liminal Keys enroll and sign-check
        id: lk
        uses: LiminalKeys/liminal-keys-ci-sample/sign@v1
        with:
          tenant-id: ${{ env.LIMINAL_KEYS_TENANT_ID }}
          identity-sha1: ${{ env.LIMINAL_KEYS_CERT_SHA1 }}
```

Success: job summary shows `signing-sha1`, `device-id`, and `expires-at`; Console **audit** shows the CI enroll/sign-check. The Action **revokes** the device in a post step.

**Self-hosted:** add `install-host: auto` (default) when the Host is already installed; use `never` only if the CLI is preinstalled and you must skip all install logic.

### 5. Sign your app

After the dry run passes, add build and `codesign` steps using the Action output:

```yaml
      - uses: actions/checkout@v4

      - name: Liminal Keys enroll
        id: lk
        uses: LiminalKeys/liminal-keys-ci-sample/sign@v1
        with:
          tenant-id: ${{ vars.LIMINAL_KEYS_TENANT_ID }}
          identity-sha1: ${{ vars.LIMINAL_KEYS_CERT_SHA1 }}

      - name: Codesign
        env:
          SIGNING_SHA1: ${{ steps.lk.outputs.signing-sha1 }}
        run: codesign --force --options runtime -s "$SIGNING_SHA1" path/to/Your.app
```

Use `steps.lk.outputs.signing-sha1` or job env `LIMINAL_KEYS_SIGNING_SHA1`. See [`.github/workflows/sign-sample.yml`](.github/workflows/sign-sample.yml) for a full Swift sample.

### 6. App Store / TestFlight (iOS)

After the dry run succeeds on a **self-hosted macOS** runner with **Liminal Keys for Mac** installed:

1. Add **`ExportOptions.plist`** for `method: app-store` or App Store Connect export.
2. Copy [`.github/workflows/app-store-release.template.yml`](.github/workflows/app-store-release.template.yml) — archive → [`export@v1`](export/) (bundled **LiminalKeysExport** from the Host app) → leaf SHA-1 verification → optional **TestFlight** upload with **your** ASC API key secrets.
3. Set `min-signed-bundles` to match your app (Watch companion apps often need `3` or more).

### 7. Developer ID + notarization (macOS)

Use [`sign@v1`](sign/) + `codesign` on the runner, then notarize with **your** App Store Connect API key. Template: [`.github/workflows/developer-id-notarize.template.yml`](.github/workflows/developer-id-notarize.template.yml). Notarization does **not** require an active Liminal Keys CI device.

### 8. Verify in Console Sign audit

Open **Console → Sign audit** (and **CI & automation → Recent CI enrollments** for enroll events). Each `codesign` / export sign operation from the job should appear with:

- The **CI device** id from Action output `device-id` (or `LIMINAL_KEYS_DEVICE_ID` in job env).
- The **identity** SHA-1 you allowed in trust and policy.
- GitHub **run URL** context when the runner provided it at enroll time.

Match those fields to your workflow run before you treat a release as complete.

---

## Troubleshooting

| Symptom / error | Likely cause | Fix |
| --- | --- | --- |
| `Cannot find module '.../sourcemap-register.js'` (Action main/post) | Committed `dist/` out of date or built with a broken ncc layout | In `sign/`: `npm ci && npm run build && npm run verify:dist`, commit `dist/`, or use a released `@v1` tag that includes a verified bundle. |
| `sudo rm` / Host removed on a **self-hosted** Mac | Old Action or `install-host: always` on GitHub-hosted-style path | Upgrade to `@v1` with `install-host: auto` (default): existing `/Applications/Liminal Keys Virtual Smartcard.app` is **reused** without `sudo rm -rf`. |
| `ci enroll` / CLI fails immediately on self-hosted; path looks truncated | Host CLI path contains spaces | Fixed in `@v1` (spawn with argument array, not shell-split `@actions/exec`). Upgrade the Action. |
| Host CLI error: unknown flag `--ttl-minutes` | Manual CLI invocation | Host CLI expects **`--ttl`** with a duration (`60m`, `90m`). The Action input is **`ttl-minutes`**; it maps to `--ttl 60m` internally. |
| `CLI enroll JSON missing deviceId and/or signing SHA-1` / top-level keys listed | Host CLI JSON shape | Enroll result uses **`identities[].sha1`** (and `deviceId`). Upgrade `@v1`; optional `identity-sha1` input must be 40 hex chars. |
| `GitHub OIDC is unavailable. Add permissions: id-token: write` | Job missing OIDC permission | Add `permissions: id-token: write` (and `contents: read`) on the job or workflow. |
| `The identity token was refused.` / HTTP **403** during enroll | GitHub trust rule **ref / branch** mismatch | Run from a branch allowed by the rule (e.g. **`main` only**). Widen the rule or merge to the allowed branch. Check repository name for private repos. |
| Variable empty though set in **Environment** | Job not bound to that environment | Add `environment: your-env-name` on the job. Do **not** use `${{ github.environment }}` — it is not a valid context. |
| `ci sign-check failed` on self-hosted | Token extension / smartcard not enabled on that Mac | Enable once interactively (System Settings → Crypto Token; Host enrolled). The Action does not apply privileged smartcard changes when reusing an existing Host on self-hosted runners. |
| `Passwordless sudo required` on self-hosted | Host missing and install attempted | Install Host under `/Applications` manually, or allow `sudo -n` for DMG install when the app is absent. |
| Dry run OK but `codesign` fails | Wrong SHA-1 or identity not in policy | Match `identity-sha1` to Console policy; use output `signing-sha1` from the same enroll step. |

Action inputs, outputs, and self-hosted behaviour: [`sign/README.md`](sign/README.md).

---

## What's in this repo

| Path | Purpose |
| --- | --- |
| [`sign/`](sign/) | Enroll + sign-check Action (`sign@v1`) |
| [`export/`](export/) | Archive export, IPA verify, optional ASC upload (`export@v1`) |
| [`.github/workflows/liminal-keys-dry-run.yml`](.github/workflows/liminal-keys-dry-run.yml) | Customer dry-run template (`@v1`) |
| [`.github/workflows/sign-sample.yml`](.github/workflows/sign-sample.yml) | End-to-end sample build + codesign (`@v1`) |
| [`.github/workflows/app-store-release.template.yml`](.github/workflows/app-store-release.template.yml) | App Store / TestFlight layout (copy to your repo) |
| [`.github/workflows/developer-id-notarize.template.yml`](.github/workflows/developer-id-notarize.template.yml) | Developer ID + notarization layout |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Action unit tests, dist verify, actionlint |
| [`docs/spike-results.md`](docs/spike-results.md) | Archived CTK spike (lk-15a) |

### Rules for this sample repo

- **Self-signed test identity only** in public demos (**Liminal CI Test** workspace).
- **No secrets in git** — use variables and GitHub Secrets on customer repos.

Product: https://www.liminalkeys.com
