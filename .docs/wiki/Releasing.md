# Releasing

formpath's own repository builds no release; its GitHub Actions only run the checks. Desktop releases are built by formcompiler (`nodemode-ai/formcompiler`), the release pipeline for every form* app: macOS (Apple silicon and Intel), Linux (AppImage, deb, rpm) and Windows (MSI, NSIS). formcompiler collects the bundles into a draft release named `formpath-vX.Y.Z` on its own release page. Publishing the draft there makes it the one the updater feed (`formpath-updates/latest.json` on formcompiler) points at.

## One-time setup: signing secrets in formcompiler

These secrets are set in formcompiler's repository, never in formpath's. Builds work without them (unsigned, no updater artifacts); each group switches on its feature when present.

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
cd frontend && npx tauri signer generate -w ~/.tauri/formpath.key
```

Put the private key in formcompiler's `TAURI_SIGNING_PRIVATE_KEY` secret and the printed public key in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`. Until the public key is there, the app skips update checks.

## Cutting a release

1. Bump the version in `frontend/package.json` (and its lock file), `frontend/src/version.ts`, `backend/app/__init__.py`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` and the README badge; commit on main.
2. Push a branch named `compile_vX.Y.Z` from that commit, for example `git push origin HEAD:compile_v0.51.1`. CI runs on it. The name must match the version in `src-tauri/tauri.conf.json`, or formcompiler refuses it and says why.
3. formcompiler finds the branch on its next watch run (every 8 hours), or at once when its watch is run by hand. Once CI has passed on that commit, it builds the four targets and writes `latest.json` from the updater signatures.
4. Check the draft release's assets on formcompiler's release page, then publish it there.
