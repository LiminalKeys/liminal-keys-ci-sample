#!/usr/bin/env bash
# Vendored from Liminal Keys scripts/ci (lk-15c contract + install-host modes).
# Pin: see sign/scripts/VENDOR.json
set -euo pipefail

API_BASE="${LIMINAL_KEYS_API_BASE_URL:-https://api.liminalkeys.com}"
HOST_DMG_URL="${LIMINAL_KEYS_HOST_DMG_URL:-}"
HOST_DMG_SHA256="${LIMINAL_KEYS_HOST_DMG_SHA256:-}"
INSTALL_HOST="${LIMINAL_KEYS_INSTALL_HOST:-auto}"
MIN_HOST_VERSION="${LIMINAL_KEYS_MIN_HOST_VERSION:-1.0.0-beta.5}"
TEAM_ID="${LIMINAL_KEYS_HOST_TEAM_ID:-7TBZ9VLLQ5}"
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

SETUP_FAILED=0

mkdir -p "$WORK_DIR"

dump_signer_extension_log() {
  local last="${1:-10m}"
  echo "==> Token extension log (subsystem com.liminal.keys, category signer, last ${last})"
  if command -v log >/dev/null 2>&1; then
    log show --style syslog --predicate 'subsystem == "com.liminal.keys" AND category == "signer"' --last "$last" 2>&1 | tail -n 400 || true
  else
    echo "(log utility unavailable)" >&2
  fi
}

on_exit() {
  local rc=$?
  if [[ "$rc" -ne 0 || "$SETUP_FAILED" -eq 1 ]]; then
    dump_signer_extension_log "10m" >&2
  fi
}
trap on_exit EXIT

version_ge() {
  local installed="$1"
  local minimum="$2"
  [[ "$(printf '%s\n%s' "$minimum" "$installed" | sort -V | tail -1)" == "$installed" ]]
}

require_host_version() {
  local published="${1:-}"
  local cli_ver="${2:-}"
  local effective=""
  if [[ -n "$cli_ver" && "$cli_ver" != "version unknown" ]]; then
    effective="$cli_ver"
  elif [[ -n "$published" && "$published" != "unknown" ]]; then
    effective="$published"
  fi
  if [[ -z "$effective" ]]; then
    echo "Host version unknown; need at least ${MIN_HOST_VERSION} (API=${published}, CLI=${cli_ver})." >&2
    SETUP_FAILED=1
    exit 1
  fi
  if ! version_ge "$effective" "$MIN_HOST_VERSION"; then
    echo "Host version ${effective} is below minimum ${MIN_HOST_VERSION} (includes ci-agent-state fix from beta.5)." >&2
    SETUP_FAILED=1
    exit 1
  fi
  echo "Host version OK: ${effective} (minimum ${MIN_HOST_VERSION})"
}

verify_host_signature() {
  if [[ ! -d "$TARGET_APP" ]]; then
    echo "Host app missing at ${TARGET_APP}" >&2
    SETUP_FAILED=1
    exit 1
  fi
  codesign --verify --deep --strict "$TARGET_APP"
  if ! codesign -dv --verbose=4 "$TARGET_APP" 2>&1 | grep -q "TeamIdentifier=${TEAM_ID}"; then
    echo "Host codesign TeamIdentifier != ${TEAM_ID}" >&2
    SETUP_FAILED=1
    exit 1
  fi
  spctl -a -vv "$TARGET_APP"
}

sudo_or_fail() {
  if ! sudo -n "$@"; then
    echo "::error::Passwordless sudo required for this Host install step but sudo -n failed. On self-hosted macOS runners, install Liminal Keys Host under /Applications manually and use install-host: auto (default) to reuse it without sudo." >&2
    SETUP_FAILED=1
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

finish_setup() {
  local published_version="${1:-unknown}"
  verify_host_signature
  local cli_ver
  cli_ver="$("$CLI_PATH" --version 2>/dev/null || echo unknown)"
  echo "macOS: $(sw_vers -productVersion)"
  echo "Published Host metadata version: ${published_version}"
  echo "Installed Host CLI version: ${cli_ver}"
  require_host_version "$published_version" "$cli_ver"
  launch_ci_agent
  echo "Host setup complete (CLI ${cli_ver})."
}

skip_host_install() {
  if ! host_cli_ready; then
    if [[ "$SELF_HOSTED" -eq 1 ]]; then
      emit_self_hosted_missing_host
    else
      echo "::error::install-host is '${INSTALL_HOST}' but LiminalKeysHostCLI is missing at ${CLI_PATH}. Set install-host to auto/always or install the Host app." >&2
    fi
    SETUP_FAILED=1
    exit 1
  fi

  echo "Using existing Liminal Keys Host (install-host=${INSTALL_HOST}, runner=${RUNNER_ENVIRONMENT:-unknown})."
  echo "Skipping DMG install and all sudo / system-wide smartcard configuration."

  local meta_ver="unknown"
  if meta_json="$(curl -fsSL "${API_BASE%/}/v1/public/agent/mac" 2>/dev/null || true)"; then
    meta_ver="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("version","unknown"))' <<<"$meta_json" 2>/dev/null || echo unknown)"
  fi
  finish_setup "$meta_ver"
  exit 0
}

if ! should_install_host; then
  skip_host_install
fi

if [[ "$SELF_HOSTED" -eq 1 && -d "$TARGET_APP" ]]; then
  echo "::error::Refusing to replace or remove an existing Liminal Keys Host install on a self-hosted runner. Use install-host: auto (default) or never to use the installed app." >&2
  SETUP_FAILED=1
  exit 1
fi

META_JSON=""
if [[ -z "$HOST_DMG_URL" ]]; then
  META_JSON="$(curl -fsSL "${API_BASE%/}/v1/public/agent/mac")"
  HOST_DMG_URL="${API_BASE%/}/v1/public/agent/mac/download"
  if [[ -z "$HOST_DMG_SHA256" ]]; then
    HOST_DMG_SHA256="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["sha256"])' <<<"$META_JSON")"
  fi
else
  META_JSON="$(curl -fsSL "${API_BASE%/}/v1/public/agent/mac" 2>/dev/null || true)"
fi

PUBLISHED_VERSION="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("version","unknown"))' <<<"${META_JSON:-{\"version\":\"unknown\"}}")"
AVAILABLE="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("available", False))' <<<"${META_JSON:-{\"available\": true}}")"
if [[ -n "$META_JSON" && "$AVAILABLE" != "True" && "$AVAILABLE" != "true" ]]; then
  echo "Mac agent is not published (available=false)." >&2
  SETUP_FAILED=1
  exit 1
fi

echo "Downloading Liminal Keys Host DMG (published version ${PUBLISHED_VERSION})..."
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
    SETUP_FAILED=1
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
  SETUP_FAILED=1
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

finish_setup "$PUBLISHED_VERSION"