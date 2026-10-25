#!/usr/bin/env bash
# Vendored from Liminal Keys Host release scripts/ci (lk-15c contract).
# Pin: see sign/scripts/VENDOR.json
set -euo pipefail

API_BASE="${LIMINAL_KEYS_API_BASE_URL:-https://api.liminalkeys.com}"
HOST_DMG_URL="${LIMINAL_KEYS_HOST_DMG_URL:-}"
HOST_DMG_SHA256="${LIMINAL_KEYS_HOST_DMG_SHA256:-}"
INSTALL_HOST="${LIMINAL_KEYS_INSTALL_HOST:-auto}"
RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
WORK_DIR="${RUNNER_TEMP}/liminal-keys-ci"
DMG_PATH="${WORK_DIR}/LiminalKeys.dmg"
MOUNT_DIR="${WORK_DIR}/dmg-mount"
APP_NAME="Liminal Keys Virtual Smartcard.app"
TARGET_APP="/Applications/${APP_NAME}"
CLI_PATH="${TARGET_APP}/Contents/Helpers/LiminalKeysHostCLI"
TOKEN_ID="com.liminal.keys.host.token"
APPEX_PATH="$TARGET_APP/Contents/PlugIns/LiminalKeysTokenExtension.appex"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"

SELF_HOSTED=0
if [[ "${RUNNER_ENVIRONMENT:-}" == "self-hosted" ]]; then
  SELF_HOSTED=1
fi

mkdir -p "$WORK_DIR"

sudo_or_fail() {
  if ! sudo -n "$@"; then
    echo "::error::Passwordless sudo required for this Host install step but sudo -n failed. On self-hosted macOS runners, install Liminal Keys Host under /Applications manually and use install-host: auto (default) to reuse it without sudo." >&2
    exit 1
  fi
}

host_cli_ready() {
  [[ -x "$CLI_PATH" ]]
}

emit_self_hosted_missing_host() {
  echo "::error::Self-hosted runner: Liminal Keys Host must already be installed at ${TARGET_APP} with LiminalKeysHostCLI. This Action refuses destructive install (no sudo rm, no system smartcard changes) on self-hosted machines when the app is present. Install the Host locally or set install-host to always only when /Applications does not yet contain the app." >&2
}

should_install_host() {
  case "$INSTALL_HOST" in
    never)
      return 1
      ;;
    always)
      if [[ "$SELF_HOSTED" -eq 1 ]] && host_cli_ready; then
        return 1
      fi
      return 0
      ;;
    auto|*)
      if [[ "$SELF_HOSTED" -eq 1 ]]; then
        if host_cli_ready; then
          return 1
        fi
        return 0
      fi
      return 0
      ;;
  esac
}

launch_ci_agent() {
  echo "Launching Host (CI agent mode)..."
  open -gj -a "Liminal Keys Virtual Smartcard" --args --ci-agent
  sleep 5
  if ! pgrep -fl "Liminal Keys Virtual Smartcard" >/dev/null 2>&1; then
    echo "Warning: Host process not found in pgrep; continuing." >&2
  fi
}

skip_host_install() {
  if ! host_cli_ready; then
    if [[ "$SELF_HOSTED" -eq 1 ]]; then
      emit_self_hosted_missing_host
    else
      echo "::error::install-host is '${INSTALL_HOST}' but LiminalKeysHostCLI is missing at ${CLI_PATH}. Set install-host to auto/always or install the Host app." >&2
    fi
    exit 1
  fi

  echo "Using existing Liminal Keys Host (install-host=${INSTALL_HOST}, runner=${RUNNER_ENVIRONMENT:-unknown})."
  echo "Skipping DMG install and all sudo / system-wide smartcard configuration."

  if [[ "$SELF_HOSTED" -eq 1 ]]; then
    launch_ci_agent
    echo "Host ready for ci enroll via existing CLI ($( "$CLI_PATH" --version 2>/dev/null || echo 'version unknown' ))."
    exit 0
  fi

  echo "Host CLI present; skipping reinstall."
  launch_ci_agent
  echo "Host setup complete ($( "$CLI_PATH" --version 2>/dev/null || echo 'version unknown' ))."
  exit 0
}

if ! should_install_host; then
  skip_host_install
fi

if [[ "$SELF_HOSTED" -eq 1 && -d "$TARGET_APP" ]]; then
  echo "::error::Refusing to replace or remove an existing Liminal Keys Host install on a self-hosted runner. Use install-host: auto (default) or never to use the installed app." >&2
  exit 1
fi

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
if [[ "$SELF_HOSTED" -eq 0 && -d "$TARGET_APP" ]]; then
  sudo_or_fail rm -rf "$TARGET_APP"
fi
sudo_or_fail ditto "$MOUNT_DIR/$APP_NAME" "$TARGET_APP"
sudo_or_fail chown -R "$(id -u):$(id -g)" "$TARGET_APP"

echo "Detaching DMG..."
hdiutil detach "$MOUNT_DIR" -force || true

if ! host_cli_ready; then
  echo "LiminalKeysHostCLI helper missing at $CLI_PATH (Host release must include Contents/Helpers/LiminalKeysHostCLI)." >&2
  exit 1
fi

echo "Registering token extension..."
"$LSREGISTER" -f "$TARGET_APP"
pluginkit -a "$APPEX_PATH"
pluginkit -e use -i "$TOKEN_ID"

echo "Configuring smartcard subsystem..."
if security smartcards token -l 2>&1 | grep -qE "disabled.*$TOKEN_ID|$TOKEN_ID.*disabled"; then
  sudo_or_fail security smartcards token -e "$TOKEN_ID"
else
  sudo_or_fail security smartcards token -e "$TOKEN_ID" || true
fi
sudo_or_fail defaults write /Library/Preferences/com.apple.security.smartcard UserPairing -bool false

launch_ci_agent

echo "Host setup complete ($( "$CLI_PATH" --version 2>/dev/null || echo 'version unknown' ))."
