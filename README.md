# liminal-keys-ci-sample

**Sample / test repository** for Liminal Keys cloud CI signing (work item **lk-15a**: a one-day test on GitHub-hosted macOS runners).

It is public so hosted macOS runner minutes are free. It exists only to check whether the Liminal Keys virtual smartcard can sign non-interactively on a fresh hosted runner (`macos-14`, `macos-15`).

## Rules for this repo

- **Self-signed test identity only.** Every signature made from this repo uses a self-signed test certificate ("Liminal CI Test") held in a dedicated test workspace.
- **Never the real Developer ID.** This repo must never hold, reference, or be allowed by policy to use a real Apple Developer ID identity, an App Store Connect API key, or any production workspace data.
- **No secrets.** Do not add repository or environment secrets. Any short-lived value a test run needs is passed as a `workflow_dispatch` input right before the run.
- **No workflows run yet.** Test workflows will be added later and will be manual (`workflow_dispatch`) only.

## Status

Empty scaffold. Nothing here signs, deploys, or publishes anything.

Product: https://www.liminalkeys.com
