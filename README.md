# liminal-keys-ci-sample

**Public sample repository** for Liminal Keys **cloud CI** on GitHub-hosted macOS runners (`macos-14`, `macos-15`).

It hosts the [`sign/`](sign/) GitHub Action (`LiminalKeys/liminal-keys-ci-sample/sign@v1` after tagging), the end-to-end [`sign-sample.yml`](.github/workflows/sign-sample.yml) workflow, and recorded [CTK spike results](docs/spike-results.md) (lk-15a).

## Rules for this repo

- **Self-signed test identity only.** Signatures use the **Liminal CI Test** certificate in a dedicated test workspace.
- **Never the real Developer ID.** No real Apple Developer ID, App Store Connect API key, or production workspace data.
- **No secrets in git.** Tenant ID and test identity SHA-1 may be supplied via `workflow_dispatch` inputs or optional repository **variables** the owner configures. CI keys and ASC material belong in **secrets** on customer repos only—not here.

## GitHub Action (`sign/`)

OIDC-first enrollment → `ci sign-check` → outputs `signing-sha1` / `device-id` / `expires-at` → post-step `ci unenroll` + teardown (warnings only on failure).

See [`sign/README.md`](sign/README.md) for inputs, outputs, and `permissions: { id-token: write, contents: read }`.

## Sample workflow

[`.github/workflows/sign-sample.yml`](.github/workflows/sign-sample.yml) (`workflow_dispatch`):

- Chooses `macos-15` or `macos-14`
- Builds a tiny Swift sample `.app`, signs with the Action output SHA-1, verifies `Authority=Liminal CI Test`
- Includes a disabled notarization template (`if: false`) for copy-paste into customer pipelines

Requires owner-configured GitHub OIDC trust for this repository and Console CI rules for the test identity.

## CTK spike (lk-15a, archived)

The legacy `ctk-spike.yml` workflow was **removed** after results were recorded. Evidence lives in [`docs/spike-results.md`](docs/spike-results.md) (runs [39620918739](https://github.com/LiminalKeys/liminal-keys-ci-sample/actions/runs/39620918739), [39621520328](https://github.com/LiminalKeys/liminal-keys-ci-sample/actions/runs/39621520328)). **Verdict:** **Option A (CTK)** — sign by certificate SHA-1; do not rely on `security find-identity -v`.

## Status

- **lk-15a:** Complete (both runners PASS).
- **lk-15d (Part A):** `sign/` Action, CI checks, and `sign-sample.yml` in this repo ([#4](https://github.com/LiminalKeys/liminal-keys-ci-sample/issues/4)).
- **Customer docs (Part B):** [`LiminalKeys/liminal-keys`](https://github.com/LiminalKeys/liminal-keys) (separate PR).

Product: https://www.liminalkeys.com
