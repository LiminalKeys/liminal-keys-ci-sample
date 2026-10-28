#!/usr/bin/env bash
# Write App Store Connect API private key from env for altool (--apiKey default lookup).
# Bash 3.2 compatible (GitHub macOS runners).
set -euo pipefail

: "${ASC_KEY_ID:?ASC_KEY_ID is required}"
: "${ASC_KEY_P8:?ASC_KEY_P8 is required}"

key_dir="${HOME}/.appstoreconnect/private_keys"
mkdir -p "$key_dir"
key_file="${key_dir}/AuthKey_${ASC_KEY_ID}.p8"
umask 077
printf '%s\n' "$ASC_KEY_P8" > "$key_file"
chmod 600 "$key_file"
echo "$key_file"
