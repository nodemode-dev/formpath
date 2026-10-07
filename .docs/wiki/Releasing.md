# Releasing

Desktop releases build in GitHub Actions (`.github/workflows/desktop.yml`) on every `v*.*.*` tag: macOS (Apple silicon and Intel), Linux (AppImage, deb, rpm) and Windows (MSI, NSIS). The release job collects the bundles into a draft GitHub release; publishing the draft makes it the one the updater feed points at.

## One-time setup: repository secrets

Builds work without them (unsigned, no updater artifacts); each group switches on its feature when present.

| Secret | What it is |
| --- | --- |
| `APPLE_CERTIFICATE` | Developer ID Application certificate exported as `.p12`, base64-encoded |
| `APPLE_CERTIFICATE_PASSWORD` | The password chosen when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | For example `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | The Apple ID email used for notarization |
| `APPLE_PASSWORD` | An app-specific password for that Apple ID |
| `APPLE_TEAM_ID` | The ten-character team ID |
| `TAURI_SIGNING_PRIVATE_KEY` | The updater private key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Its password, if set |

## The updater key pair

Generate it on your own machine and keep the private key out of the repository:

```bash
cd frontend && npx tauri signer generate -w ~/.tauri/formpth.key
```

Put the private key in `TAURI_SIGNING_PRIVATE_KEY` and the printed public key in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`. Until the public key is there, the app skips update checks.

## Cutting a release

1. Bump the version in `frontend/package.json` (and its lock file), `frontend/src/version.ts`, `backend/app/__init__.py`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` and the README badge; commit; tag `vX.Y.Z`.
2. Push the tag. The workflow builds the four targets and writes `latest.json` from the updater signatures.
3. Check the draft release's assets, then publish it.
