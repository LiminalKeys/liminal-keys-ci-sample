# Cloud CI Spike Results: CTK Virtual Smartcard on GitHub-Hosted macOS (lk-15a)

Recorded from workflow runs **39620918739** (macos-15) and **39621520328** (macos-14) on **2026-10-21**, before the 7-day artifact retention window (**expires ~2026-10-28**). Evidence: job logs plus uploaded `spike-results-*` artifacts (step logs, CTK system log excerpt, screenshot).

## Overview

- **Goal:** Prove or disprove whether the Liminal Keys CryptoTokenKit (CTK) virtual smartcard can sign code **non-interactively** on standard GitHub-hosted macOS runners (`macos-14` Sonoma and `macos-15` Sequoia).
- **Workflow:** legacy `ctk-spike.yml` (lk-15a spike, removed after recording; production CI uses [`sign/`](../sign/) and [`sign-sample.yml`](../.github/workflows/sign-sample.yml)).
- **Decision boundary (lk-15c):**
  - **PASS (both runners):** Proceed with CTK design for CI pipelines (headless Host + CTK token extension).
  - **FAIL (either runner):** Pivot to **Option B** (remote signing daemon / API-direct signer without local CTK emulation).
- **Security boundary:**
  - Self-signed **Liminal CI Test** identity only (SHA-1 thumbprint supplied at dispatch; not reproduced here).
  - Public API base URL: `https://api.liminalkeys.com`.
  - No App Store Connect keys or production Developer ID in this repo.

---

## Run metadata

| Field | macos-15 (Sequoia) | macos-14 (Sonoma) |
|---|---|---|
| **Run URL** | https://github.com/LiminalKeys/liminal-keys-ci-sample/actions/runs/39620918739 | https://github.com/LiminalKeys/liminal-keys-ci-sample/actions/runs/39621520328 |
| **Date (UTC)** | 2026-10-21 14:54:02 → 14:54:39 | 2026-10-21 14:58:09 → 14:58:48 |
| **Trigger** | `workflow_dispatch` on `main` | `workflow_dispatch` on `main` |
| **Job wall time** | ~**29 s** (job started 14:54:07, completed 14:54:38) | ~**32 s** (job started 14:58:15, completed 14:58:47) |
| **Runner label** | `macos-15` | `macos-14` |
| **Runner image** | `macos-15-arm64` **20260907.0337.1** | `macos-14-arm64` **20260831.0302.1** |
| **macOS version** | **15.7.9** (24G830) | **14.8.9** (23J631) |
| **Host DMG / CLI** | `LiminalKeysHostCLI` **1.0.0-beta.3** (from public download API) | same |
| **Test identity** | Self-signed **Liminal CI Test** (40-char SHA-1 via dispatch input) | same |
| **Artifact name** | `spike-results-macos-15` | `spike-results-macos-14` |

---

## Results matrix

All spike steps **1–8** reported **success** on both runners (step summary and job conclusion: success).

| Step | Description | macos-14 | macos-15 | What it proved |
|:---:|---|:---:|:---:|---|
| **1** | System info & GUI session | **PASS** | **PASS** | Aqua `gui/501` login session present; runner uid 501. `csrutil`: **SIP disabled** on hosted image (observed only; spike does **not** depend on disabling SIP). |
| **2** | Download & install Host DMG | **PASS** | **PASS** | Resolved marketing URL to `GET /v1/public/agent/mac/download`, installed app + **beta.3** CLI helper. |
| **3** | Register token extension (`pluginkit`) | **PASS** | **PASS** | `com.liminal.keys.host.token` registered and elected **use**; PlugInKit shows token extension **1.0.0-beta.3**. |
| **4** | Configure smartcard subsystem | **PASS** | **PASS** | `security smartcards token -e`: **Token is already enabled.** `UserPairing = 0` (no pairing prompt). |
| **5** | Launch Host app (`open -gj`) | **PASS** | **PASS** | Host process running; no interactive UI required for later steps. |
| **6** | CLI enroll, status, doctor | **PASS** | **PASS** | One-time enrollment consumed; `status --require-enrolled` OK; **doctor** all checks **PASS** (API health, smartcard listing, PlugInKit election, keychain conflict, allow rule, in-doctor codesign probe). |
| **7** | Smartcard & identity verification | **PASS** | **PASS** | `security list-smartcards` lists Liminal token; **`security find-identity -v -p codesigning` → `0 valid identities found`** for the self-signed cert. |
| **8** | Non-interactive codesign probe | **PASS** | **PASS** | `codesign -f -s <test-identity-sha1> --timestamp=none` on `/usr/bin/true` copy **without prompt**; `codesign -dv` shows embedded signature (`TeamIdentifier=not set`, self-signed). |

### Per-step timings (approx., from Actions step timestamps)

| Step | macos-15 | macos-14 |
|:---:|---:|---:|
| 1 | &lt;1 s | &lt;1 s |
| 2 | ~7 s | ~9 s |
| 3 | &lt;1 s | ~1 s |
| 4 | ~1 s | &lt;1 s |
| 5 | ~5 s | ~5 s |
| 6 | ~5 s | ~6 s |
| 7 | &lt;1 s | &lt;1 s |
| 8 | ~1 s | ~1 s |

---

## Diagnostic observations

### 1. GUI session & daemon architecture

Hosted runners expose a normal **Aqua** GUI domain for uid **501** (`launchctl print gui/501`: `session = Aqua`, `type = login`). This matches the spike assumption that CTK/Host can run without a physical display; `open -gj` is sufficient.

### 2. PlugInKit & smartcard driver election

After `lsregister`, `pluginkit -a`, and `pluginkit -e use -i com.liminal.keys.host.token`, PlugInKit reports the **Liminal Keys Token** appex as the elected CTK token driver (SDK `com.apple.ctk-tokens`, Host **1.0.0-beta.3**). Step 4 confirms the driver is enabled before enrollment.

### 3. Screen capture diagnostics

`screencapture -x` produced `screenshot.png` in the artifact bundle (runner desktop session). No signing prompts were required during the job; the capture is archival only.

### 4. CTK daemon (`ctkd`) and token extension logs

`system_ctk.log` (15-minute `log show` filter) shows **LiminalKeysTokenExtension** and **LiminalKeysVirtualSmartcard** initializing, creating CTK sessions, and **`signDigest succeeded`** during doctor and step 8. Certificate label in logs: **Liminal Keys Self Signed Test** (self-signed test material).

---

## Key findings for lk-15d Action design

| Topic | Observation |
|---|---|
| **Identity discovery** | Do **not** rely on `security find-identity -v -p codesigning` for the Liminal self-signed identity; it reports **zero valid identities** while **`codesign -s <SHA-1>` still works**. Pass the Console SHA-1 into the Action and sign by thumbprint. |
| **Non-interactive signing** | Step 8 and doctor scratch probe completed with **no UI**; suitable for headless CI. |
| **Doctor policy note** | Doctor reported allow-rule coverage but also: *"Require user confirmation denies all signs"* — signing still passed on these runners; production CI rules must not require interactive confirmation. |
| **Timestamps / hardened runtime** | Spike used `--timestamp=none` only; **not** a proof of Apple timestamp servers or `--options runtime` (tracked separately in lk-15c live checks). |
| **SIP** | **Disabled** on both runner images; treat as **environment fact**, not a customer prerequisite. |
| **Enrollment code in logs (legacy workflow)** | The lk-15a workflow masked the dispatch input **after** GitHub echoed the `run:` script, so **spent one-time codes appeared in public logs**. Devices were revoked; codes were single-use. **Do not ship this pattern** — use `env:` + `secrets.*` / `core.setSecret` in the Action (see issue #4). |

---

## Verdict & recommendation (lk-15c)

- **macos-14 verdict:** **PASS** (steps 1–8)
- **macos-15 verdict:** **PASS** (steps 1–8)
- **Strategic path:**
  - [x] **Option A (CTK):** Proceed with GitHub Action wrapping Host + CTK token extension on hosted macOS.
  - [ ] **Option B (Remote signer):** Not required based on this spike.

**Summary:** GitHub-hosted **macos-14-arm64** and **macos-15-arm64** runners can install Host **1.0.0-beta.3**, enroll via CLI, and **codesign non-interactively by test-identity SHA-1** in ~**30 s** per job, with no fallback to Option B.
