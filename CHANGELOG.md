# Changelog

Versions follow `v*.*.*` with dots. Dates are UTC.

## 0.1.0 · 2026-10-07

Scaffold.

### Added

- The `formpth` and `formpth.bat` dispatchers, one-command installs, and one setup script per task with a `.bat` twin, including `./formpth mcp` and `./formpth agents install|sync`.
- The engine service on 127.0.0.1:8230: the `.fpth` project library with conflict copies, the installed-fonts service, file writes for agents, the MCP endpoint with its tool catalogue and the bridge to the window, the assistant's language model, plugins and sending to NodeMode.
- The frontend toolchain (TypeScript 7, Vite 8 on port 5230 bound to localhost) and the formvis shell base renamed: tokens and component styles, themes, dialogs, menus with native menus on macOS, the dock and panel groups, icons, toasts and the error log.
- The Tauri 2 desktop shell: splash, the engine sidecar on a free loopback port, `.fpth` association, the updater, and the app icon.
