#!/usr/bin/env bash
# Vendored from LiminalKeys/liminal-keys actions/setup-liminal-keys/install-cli.sh
# Uses `gh release download` so private cli-v* assets work with GH_TOKEN (repo secret).
set -euo pipefail

VERSION="${INPUT_VERSION:?INPUT_VERSION is required}"
EXPECTED_SHA256="${INPUT_SHA256:?INPUT_SHA256 is required}"
REPO="${LIMINAL_KEYS_CLI_RELEASE_REPO:-LiminalKeys/liminal-keys}"
TAG="cli-v${VERSION}"

if [ -z "${GH_TOKEN:-}" ]; then
  echo "::error::GH_TOKEN is required to download CLI from private release ${TAG} on ${REPO}"
  exit 1
fi

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=osx ;;
  MINGW*|MSYS*|CYGWIN*) os=win ;;
  *)
    echo "::error::Unsupported runner OS for liminal-keys CLI"
    exit 1
    ;;
esac

arch="$(uname -m)"
case "${arch}" in
  x86_64|amd64) rid_arch=x64 ;;
  arm64|aarch64) rid_arch=arm64 ;;
  *)
    echo "::error::Unsupported runner architecture: ${arch}"
    exit 1
    ;;
esac

if [ "${os}" = win ]; then
  asset="liminal-keys-${os}-${rid_arch}.exe"
else
  asset="liminal-keys-${os}-${rid_arch}"
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

gh release download "${TAG}" -R "${REPO}" -p "${asset}" -p SHA256SUMS.txt -D "${tmpdir}" --clobber

sums_expected="$(grep -E "[[:space:]]${asset}\$" "${tmpdir}/SHA256SUMS.txt" | awk '{print $1}')"
if [ -z "${sums_expected}" ]; then
  echo "::error::${asset} not listed in SHA256SUMS.txt for ${TAG}"
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "${tmpdir}/${asset}" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "${tmpdir}/${asset}" | awk '{print $1}')"
fi

EXPECTED_SHA256="$(printf '%s' "${EXPECTED_SHA256}" | tr '[:upper:]' '[:lower:]')"
actual="$(printf '%s' "${actual}" | tr '[:upper:]' '[:lower:]')"
sums_expected="$(printf '%s' "${sums_expected}" | tr '[:upper:]' '[:lower:]')"

if [ "${actual}" != "${EXPECTED_SHA256}" ]; then
  echo "::error::SHA-256 mismatch for ${asset}: input sha256 does not match downloaded binary"
  exit 1
fi

if [ "${actual}" != "${sums_expected}" ]; then
  echo "::error::SHA-256 mismatch for ${asset}: release SHA256SUMS.txt does not match binary"
  exit 1
fi

install_dir="${RUNNER_TEMP}/liminal-keys/bin"
mkdir -p "${install_dir}"
if [ "${os}" = win ]; then
  install -m 0755 "${tmpdir}/${asset}" "${install_dir}/liminal-keys.exe"
else
  install -m 0755 "${tmpdir}/${asset}" "${install_dir}/liminal-keys"
fi
echo "${install_dir}" >> "${GITHUB_PATH}"
