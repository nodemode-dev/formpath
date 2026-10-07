# Desktop

The desktop app is a Tauri 2 shell (`src-tauri/`) around the same frontend and a frozen engine sidecar.

1. The app opens a small splash window and spawns `formpth-engine` with `FORMPTH_PORT=0`.
2. The engine picks a free loopback port and prints Uvicorn's `http://127.0.0.1:<port>` line; the shell reads it from the sidecar's output.
3. The shell opens the main window on that URL, sized to 90 percent of the screen, and closes the splash.
4. On exit the shell stops the engine.

The capability allows `http://127.0.0.1:*` as a remote URL so the native menus work on macOS. `.fpth` files are associated with the app.

Build locally with `./formpth install-desktop` then `./formpth desktop build` (or `desktop dev`). `setup/freeze_backend` freezes the engine with PyInstaller into `src-tauri/binaries/formpth-engine-<target triple>`.
