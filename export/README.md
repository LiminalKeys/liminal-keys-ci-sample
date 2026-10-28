# Liminal Keys Export (GitHub Action)

Export an Xcode `.xcarchive` to an App Store–ready IPA using **`LiminalKeysExport`** from the installed **Liminal Keys for Mac** app — no checkout of the private `liminal-keys` repo and no deploy key.

Typical job order on a **self-hosted macOS** runner:

1. **`LiminalKeys/liminal-keys-ci-sample/sign@v1`** — GitHub OIDC enroll + `ci sign-check` (ephemeral CI device).
2. **`xcodebuild archive`** — build your `.xcarchive` on the same runner while the CI device is active.
3. **`LiminalKeys/liminal-keys-ci-sample/export@v1`** — export, verify leaf SHA-1 on every signed bundle, optional TestFlight / App Store upload.
4. The sign Action **post** step revokes the CI device when the job finishes.

Private keys stay **non-exportable in Key Vault**; signing during export uses the same Virtual Smartcard path as local `codesign`.

## Permissions

Same as the sign Action:

```yaml
permissions:
  id-token: write
  contents: read
```

## Example

```yaml
      - name: Liminal Keys enroll
        id: lk
        uses: LiminalKeys/liminal-keys-ci-sample/sign@v1
        with:
          tenant-id: ${{ vars.LIMINAL_KEYS_TENANT_ID }}
          identity-sha1: ${{ vars.LIMINAL_KEYS_CERT_SHA1 }}

      - name: Archive (Release)
        run: |
          xcodebuild -workspace MyApp.xcworkspace -scheme MyApp \
            -configuration Release -destination 'generic/platform=iOS' \
            -archivePath "$RUNNER_TEMP/MyApp.xcarchive" archive

      - name: Export IPA, verify, upload TestFlight
        uses: LiminalKeys/liminal-keys-ci-sample/export@v1
        with:
          archive-path: ${{ runner.temp }}/MyApp.xcarchive
          export-options: ExportOptions.plist
          export-path: ${{ runner.temp }}/export
          leaf-sha1: ${{ vars.LIMINAL_KEYS_CERT_SHA1 }}
          min-signed-bundles: "3"
          upload-app-store: "true"
        env:
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_KEY_P8: ${{ secrets.ASC_KEY_P8 }}
```

Set `upload-app-store: "false"` (default) when you only need a verified IPA artifact.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `archive-path` | yes | `.xcarchive` directory |
| `export-options` | yes | `ExportOptions.plist` path |
| `export-path` | yes | Output directory for the IPA |
| `leaf-sha1` | yes | Expected leaf cert SHA-1 (40 hex) for verification |
| `host-app` | no | Default `/Applications/Liminal Keys Virtual Smartcard.app` |
| `min-signed-bundles` | no | Minimum `.app`/`.appex` count inside the IPA (default `1`) |
| `upload-app-store` | no | `true` to run `xcrun altool --upload-app` |
| `app-store-type` | no | `altool --type` (default `ios`) |

## Outputs

| Output | Description |
| --- | --- |
| `ipa-path` | Path to the exported `.ipa` |

Also sets job env `LIMINAL_KEYS_IPA_PATH`.

## App Store Connect secrets

Store **your** API key in GitHub secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`). **Liminal Keys never sees or stores your App Store Connect private key.**

Apple lets you **download the `.p8` private key only once** when the API key is created. Paste the full PEM contents into a GitHub Actions secret (for example `ASC_KEY_P8`); do not commit it to the repo.

Pass secrets only via `env:` on the export step (not inside `run:` script text).

When `upload-app-store: true`, the Action writes the key to `~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8` (mode `600`) because `xcrun altool --apiKey` looks there by default, then deletes the file when the step finishes. The same path works for manual `altool` uploads; [`write-asc-api-key.sh`](scripts/write-asc-api-key.sh) is bash 3.2–safe for copy-paste into your own workflow steps.

## Console Sign audit

Each digest sign during export appears in **Console → Sign audit** with the ephemeral **CI device** from the enroll step. Match `device-id` from the sign Action output to the audit row’s device context and the GitHub run URL when present.

## Developer ID (macOS) + notarization

For **Developer ID** Mac apps, archive and export with `method: developer-id`, then notarize with **your** ASC API key in a separate step (`xcrun notarytool`, `xcrun stapler staple`). See the sample repo [`.github/workflows/developer-id-notarize.template.yml`](../.github/workflows/developer-id-notarize.template.yml).

Customer quickstart: [repository README](../README.md).
