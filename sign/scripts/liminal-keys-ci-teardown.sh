#!/usr/bin/env bash
# Vendored from Liminal Keys Host release scripts/ci (lk-15c contract).
set -euo pipefail

RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
WORK_DIR="${RUNNER_TEMP}/liminal-keys-ci"
MOUNT_DIR="${WORK_DIR}/dmg-mount"

if [[ "${RUNNER_ENVIRONMENT:-}" != "self-hosted" ]]; then
  echo "Stopping Liminal Keys Host..."
  pkill -x "Liminal Keys Virtual Smartcard" 2>/dev/null || true
  sleep 1
fi

if [[ -d "$MOUNT_DIR" ]]; then
  hdiutil detach "$MOUNT_DIR" -force 2>/dev/null || true
fi

rm -rf "$WORK_DIR" 2>/dev/null || true
echo "Teardown complete."
