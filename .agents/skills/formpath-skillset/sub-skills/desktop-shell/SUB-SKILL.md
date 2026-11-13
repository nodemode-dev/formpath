---
name: desktop-shell
description: The formpath desktop app. Use for the Tauri 2 shell in src-tauri, the frozen engine sidecar, the port handshake, the splash window, window sizing, file associations for .fpth, icons, macOS entitlements and signing, the updater, and the desktop release workflow for macOS, Windows and Linux.
---

# desktop-shell

## How it starts

`src-tauri/src/main.rs` opens the splash window (`frontend/public/splash.html`), spawns `formpath-engine` with `FORMPATH_PORT=0`, reads `http://127.0.0.1:[port]` from its output, opens the main window on that URL at 90 percent of the screen, closes the splash, and checks for updates when a public key is configured. On exit it stops the engine.

## Building

- `./formpath install-desktop` installs PyInstaller and checks Rust and the Tauri system packages.
- `./formpath freeze` (`setup/freeze_backend`) builds `src-tauri/binaries/formpath-engine-[target triple]` and runs its `--selfcheck`.
- `./formpath desktop build` builds the frontend, freezes the engine and bundles.
- Icons come from `assets/formpath_icon.svg`, rendered into `src-tauri/icons/` and `frontend/public/`.

## Release

formpath's repository builds no release. formcompiler (`nodemode-ai/formcompiler`) builds macOS arm64 and x64, Linux x64 and Windows x64 from a `compile_v*.*.*` branch and drafts the release `formpath-v*.*.*` on its own release page, with `latest.json` when the updater key is set. The signing secrets live in formcompiler. The steps are on the wiki's Releasing page.

## Rules

The capability allows `http://127.0.0.1:*` as a remote URL; without it the native menus fail on macOS. Bump the version in `Cargo.toml` and `tauri.conf.json` with the others.
