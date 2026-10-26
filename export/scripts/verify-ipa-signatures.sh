#!/usr/bin/env bash
# Verify every signed bundle in an App Store IPA was signed through Liminal Keys custody
# (expected leaf SHA-1) and not with a private key from the login keychain.
set -euo pipefail

IPA="${1:?usage: verify-ipa-signatures.sh <ipa> <expected-leaf-sha1>}"
EXPECTED_RAW="${2:?expected leaf certificate SHA-1 (40 hex chars)}"
MIN_BUNDLES="${MIN_SIGNED_BUNDLES:-1}"
EXPECTED="$(echo "$EXPECTED_RAW" | tr '[:upper:]' '[:lower:]' | tr -d ':')"

if [[ ! "$EXPECTED" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: expected leaf SHA-1 must be 40 hex characters (got '${EXPECTED_RAW}')" >&2
  exit 1
fi

if ! [[ "$MIN_BUNDLES" =~ ^[0-9]+$ ]] || (( MIN_BUNDLES < 1 )); then
  echo "ERROR: MIN_SIGNED_BUNDLES must be a positive integer (got '${MIN_BUNDLES}')" >&2
  exit 1
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/lk-ipa-verify.XXXXXX")"
CERT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lk-ipa-certs.XXXXXX")"
trap 'rm -rf "$WORKDIR" "$CERT_DIR"' EXIT

unzip -q "$IPA" -d "$WORKDIR"

LOCAL_SHA1S="$(mktemp)"
security find-identity -v -p codesigning 2>/dev/null \
  | grep -oE '[0-9A-Fa-f]{40}' \
  | tr '[:upper:]' '[:lower:]' \
  | sort -u > "$LOCAL_SHA1S" || true

leaf_sha1_for() {
  local bundle="$1"
  rm -f "$CERT_DIR"/codesign*
  (cd "$CERT_DIR" && codesign --display --extract-certificates "$bundle" 2>/dev/null) || true
  local leaf="$CERT_DIR/codesign0"
  if [[ ! -f "$leaf" ]]; then
    echo ""
    return 1
  fi
  openssl x509 -inform DER -in "$leaf" -fingerprint -sha1 -noout \
    | sed -E 's/^sha1 fingerprint=//i' \
    | tr -d ':' \
    | tr '[:upper:]' '[:lower:]'
}

BUNDLE_COUNT=0
while IFS= read -r -d '' bundle; do
  BUNDLE_COUNT=$((BUNDLE_COUNT + 1))
  echo "==> Verifying $(basename "$bundle")"
  codesign --verify --strict --verbose=2 "$bundle"

  DV_OUT="$(mktemp)"
  codesign -dv --verbose=4 "$bundle" 2>"$DV_OUT" || true
  cat "$DV_OUT"

  LEAF="$(leaf_sha1_for "$bundle" || true)"
  if [[ -z "$LEAF" ]]; then
    echo "ERROR: could not extract leaf certificate from $(basename "$bundle")" >&2
    exit 1
  fi

  if [[ "$LEAF" != "$EXPECTED" ]]; then
    echo "ERROR: leaf SHA-1 mismatch for $(basename "$bundle"): got ${LEAF}, expected ${EXPECTED}" >&2
    exit 1
  fi

  if grep -qx "$LEAF" "$LOCAL_SHA1S"; then
    echo "ERROR: $(basename "$bundle") appears signed with a login-keychain codesigning identity (SHA-1 ${LEAF})" >&2
    echo "Use Liminal Keys Virtual Smartcard with your production workspace; do not import distribution .p12 on this Mac." >&2
    exit 1
  fi

  rm -f "$DV_OUT"
done < <(find "$WORKDIR" \( -name '*.app' -o -name '*.appex' \) -print0)

if (( BUNDLE_COUNT < MIN_BUNDLES )); then
  echo "ERROR: expected at least ${MIN_BUNDLES} signed bundle(s); found ${BUNDLE_COUNT}" >&2
  exit 1
fi

echo "OK: ${BUNDLE_COUNT} bundle(s); leaf SHA-1 ${EXPECTED} (Liminal custody); no login-keychain signer"
