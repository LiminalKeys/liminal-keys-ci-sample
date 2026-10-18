# Cloud CI Spike Results: CTK Virtual Smartcard on GitHub-Hosted macOS (lk-15a)

## Overview

- **Goal:** Prove or disprove whether the Liminal Keys CryptoTokenKit (CTK) virtual smartcard can sign code non-interactively on standard GitHub-hosted macOS runners (`macos-14` Sonoma and `macos-15` Sequoia).
- **Decision boundary (15c):**
  - **PASS (both runners):** Proceed with CTK design for CI pipelines (headless Host + CTK token extension).
  - **FAIL (either runner):** Pivot to **Option B** (remote signing daemon / API-direct signer without local CTK emulation).
- **Security boundary:**
  - Self-signed test identities only.
  - No secrets stored in repository or workflow. One-time enrollment codes minted immediately prior to dispatch and masked.
  - No production tenant keys, real Developer ID certificates, or App Store Connect API keys.

---

## Run Metadata

| Field | Value |
|---|---|
| **Date** | *(Pending run)* |
| **Workflow Run URL** | *(Pending run)* |
| **Triggered By** | *(Pending run)* |
| **Host DMG Version** | `1.0.0-beta.3` |
| **Test Identity SHA-1** | *(Pending run)* |
| **API Base URL** | `https://api.liminalkeys.com` |

---

## Results Matrix

| Step | Description | macos-14 (Sonoma) | macos-15 (Sequoia) | Notes |
|:---:|---|:---:|:---:|---|
| **1** | System info & GUI session (`sw_vers`, `csrutil`, `launchctl gui`) | `[PENDING]` | `[PENDING]` | Inspect launchd GUI session availability |
| **2** | Download & install Host DMG (`Contents/Helpers/LiminalKeysHostCLI`) | `[PENDING]` | `[PENDING]` | Verify CLI helper existence |
| **3** | Register Token Extension (`lsregister`, `pluginkit -a`, `pluginkit -e use`) | `[PENDING]` | `[PENDING]` | Verify PlugInKit election |
| **4** | Configure Smartcard Subsystem (`security smartcards token -e`, `UserPairing false`) | `[PENDING]` | `[PENDING]` | Ensure token driver enabled & pairing disabled |
| **5** | Launch Liminal Keys Host App (`open -gj`) | `[PENDING]` | `[PENDING]` | Background process launch |
| **6** | CLI Enroll, Status & Doctor (`LiminalKeysHostCLI enroll/status/doctor`) | `[PENDING]` | `[PENDING]` | Verify token state & keychain bridge |
| **7** | Smartcard & Identity Verification (`security list-smartcards`, `find-identity`) | `[PENDING]` | `[PENDING]` | Check if Security framework detects token |
| **8** | Non-interactive Codesign Probe (`codesign -f -s ...`) | `[PENDING]` | `[PENDING]` | Non-interactive signature of `/usr/bin/true` |

---

## Diagnostic Observations

### 1. GUI Session & Daemon Architecture
- *Observations from `launchctl print gui/$(id -u)` and `id` on hosted runners:*
- *(To be recorded after execution)*

### 2. PlugInKit & Smartcard Driver Election
- *Observations from `pluginkit -mAvvv -i com.liminal.keys.host.token` and `security smartcards token -l`:*
- *(To be recorded after execution)*

### 3. Screen Capture Diagnostics
- *Inspection of `screenshot.png` from `$RUNNER_TEMP/spike`:*
- *(To be recorded after execution)*

### 4. CTK Daemon (`ctkd`) System Logs
- *Inspection of `system_ctk.log`:*
- *(To be recorded after execution)*

---

## Verdict & Recommendation (lk-15c)

- **macos-14 Verdict:** `[PASS / FAIL]`
- **macos-15 Verdict:** `[PASS / FAIL]`
- **Strategic Path:**
  - `[ ]` **Option A (CTK):** Deploy GitHub Action for native CTK signing on hosted runners.
  - `[ ]` **Option B (Remote Signer):** Implement headless API-based codesign tool bypassing CTK.
