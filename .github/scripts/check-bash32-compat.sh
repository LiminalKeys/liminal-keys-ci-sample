#!/usr/bin/env bash
# Guard sample shell scripts for macOS runner bash 3.2 (/bin/bash).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Bash 4+ constructs that fail on GitHub macOS runners (bash 3.2).
FORBIDDEN_RE='(^|[[:space:];|&])(mapfile|readarray)[[:space:]]|declare[[:space:]]+-A|\$\{[a-zA-Z_][a-zA-Z0-9_]*,,|\$\{[a-zA-Z_][a-zA-Z0-9_]*,\^|\$\{[a-zA-Z_][a-zA-Z0-9_]*\^\^'

sh_files=(
  sign/scripts/liminal-keys-ci-setup.sh
  sign/scripts/liminal-keys-ci-teardown.sh
  export/scripts/verify-ipa-signatures.sh
  export/scripts/write-asc-api-key.sh
  .github/scripts/check-bash32-compat.sh
)

fail=0
for f in "${sh_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "missing expected script: $f" >&2
    fail=1
    continue
  fi
  bash -n "$f"
  if grep -qE "$FORBIDDEN_RE" "$f"; then
    echo "bash 4+ construct in $f (macOS runners use bash 3.2)" >&2
    grep -nE "$FORBIDDEN_RE" "$f" >&2 || true
    fail=1
  fi
done

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -x "${sh_files[@]}"
else
  echo "shellcheck not installed; skipped (bash -n + forbidden-pattern scan ran)"
fi

if (( fail )); then
  exit 1
fi
echo "OK: sample shell scripts pass bash 3.2 compatibility checks"
