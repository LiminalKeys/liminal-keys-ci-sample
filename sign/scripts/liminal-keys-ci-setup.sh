#!/usr/bin/env bash
# Vendored from Liminal Keys Host release scripts/ci (lk-15c contract).
# Pin: see sign/scripts/VENDOR.json
set -euo pipefail

API_BASE="${LIMINAL_KEYS_API_BASE_URL:-https://api.liminalkeys.com}"
HOST_DMG_URL="${LIMINAL_KEYS_HOST_DMG_URL:-}"
HOST_DMG_SHA256="${LIMINAL_KEYS_HOST_DMG_SHA256:-}"
RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
WORK_DIR="${RUNNER_TEMP}/liminal-keys-ci"
DMG_PATH="${WORK_DIR}/LiminalKeys.dmg"
MOUNT_DIR="${WORK_DIR}/dmg-mount"
APP_NAME="Liminal Keys Virtual Smartcard.app"
TARGET_APP="/Applications/${APP_NAME}"
CLI_PATH="${TARGET_APP}/Contents/Helpers/LiminalKeysHostCLI"
TOKEN_ID="com.liminal.keys.host.token"

mkdir -p "$WORK_DIR"

if [[ -z "$HOST_DMG_URL" ]]; then
  META_JSON="$(curl -fsSL "${API_BASE%/}/v1/public/agent/mac")"
  HOST_DMG_URL="${API_BASE%/}/v1/public/agent/mac/download"
  if [[ -z "$HOST_DMG_SHA256" ]]; then
    HOST_DMG_SHA256="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["sha256"])' <<<"$META_JSON")"
  fi
fi

echo "Downloading Liminal Keys Host DMG..."
curl -fL -sS "$HOST_DMG_URL" -o "$DMG_PATH"

if file "$DMG_PATH" | grep -qiE 'HTML|ASCII|Unicode text'; then
  echo "Download was HTML/text; retrying public download endpoint." >&2
  curl -fL -sS "${API_BASE%/}/v1/public/agent/mac/download" -o "$DMG_PATH"
fi

if [[ -n "$HOST_DMG_SHA256" ]]; then
  ACTUAL_SHA256="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
  EXPECTED_LC="$(printf '%s' "$HOST_DMG_SHA256" | tr '[:upper:]' '[:lower:]')"
  ACTUAL_LC="$(printf '%s' "$ACTUAL_SHA256" | tr '[:upper:]' '[:lower:]')"
  if [[ "$ACTUAL_LC" != "$EXPECTED_LC" ]]; then
    echo "Host DMG SHA-256 mismatch (expected pinned digest)." >&2
    exit 1
  fi
fi

echo "Attaching DMG..."
mkdir -p "$MOUNT_DIR"
hdiutil attach "$DMG_PATH" -nobrowse -mountpoint "$MOUNT_DIR"

echo "Installing Host app to /Applications..."
sudo rm -rf "$TARGET_APP"
sudo ditto "$MOUNT_DIR/$APP_NAME" "$TARGET_APP"
sudo chown -R "$(id -u):$(id -g)" "$TARGET_APP"

echo "Detaching DMG..."
hdiutil detach "$MOUNT_DIR" -force || true

if [[ ! -x "$CLI_PATH" ]]; then
  echo "LiminalKeysHostCLI helper missing at $CLI_PATH (Host release must include Contents/Helpers/LiminalKeysHostCLI)." >&2
  exit 1
fi

LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"
APPEX_PATH="$TARGET_APP/Contents/PlugIns/LiminalKeysTokenExtension.appex"

echo "Registering token extension..."
"$LSREGISTER" -f "$TARGET_APP"
pluginkit -a "$APPEX_PATH"
pluginkit -e use -i "$TOKEN_ID"

echo "Configuring smartcard subsystem..."
if security smartcards token -l 2>&1 | grep -qE "disabled.*$TOKEN_ID|$TOKEN_ID.*disabled"; then
  sudo security smartcards token -e "$TOKEN_ID"
else
  sudo security smartcards token -e "$TOKEN_ID" || true
fi
sudo defaults write /Library/Preferences/com.apple.security.smartcard UserPairing -bool false

echo "Launching Host (CI agent mode)..."
open -gj -a "Liminal Keys Virtual Smartcard" --args --ci-agent
sleep 5

if ! pgrep -fl "Liminal Keys Virtual Smartcard" >/dev/null 2>&1; then
  echo "Warning: Host process not found in pgrep; continuing." >&2
fi

echo "Host setup complete ($( "$CLI_PATH" --version 2>/dev/null || echo 'version unknown' ))."
