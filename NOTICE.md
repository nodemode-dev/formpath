# Third-party notices

formpth is licensed under the Apache License 2.0 (see `LICENSE`). It includes or depends on the following works.

## Included in this repository

| Work | License | Where |
| --- | --- | --- |
| formvis (nodemode-ai), the shell, styles, harness, scripts, engine service and desktop shell this project starts from | Apache-2.0, same owner | throughout, renamed and adapted |
| NodeMode stylized design system: tokens, theme profiles, theme boot, dom-stable helpers, icon subset | MIT | `frontend/src/styles/tokens.css`, `frontend/src/ui/themes.ts`, `frontend/src/ui/dom.ts`, `frontend/src/ui/icons.ts`, `frontend/index.html` |
| `paintbrush` and `hand` icons from Remix Icon | Apache-2.0 | `frontend/src/ui/icons.ts` |
| Quick Selection, Paint Bucket, Dodge, Burn and Sponge icons from Phosphor Icons, Copyright (c) 2023 Phosphor Icons | MIT | `frontend/src/ui/icons.ts` |
| Tauri sidecar shell template (tauri-compiler-skill) | MIT | `src-tauri/src/main.rs` |

The vector tool and panel icons in `frontend/src/ui/icons-vector.ts`, the app icon (`assets/formpth_icon.svg`) and the brand mark are drawn for this project.

## Distributed with the app

| Package | License | Notes |
| --- | --- | --- |
| Inter, JetBrains Mono (via @fontsource) | SIL OFL 1.1 fonts, MIT packaging | bundled font files, also used for Create Outlines |
| paper.js 0.12.18 | MIT | the curve kernel behind Pathfinder, offset and simplify |
| opentype.js 2.0.0 | MIT | glyph outlines for type rendering, Create Outlines and PDF type |
| @tauri-apps/api | Apache-2.0 or MIT | native menus on macOS |
| tauri, tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-updater, regex, serde_json | Apache-2.0 or MIT | desktop shell |
| fastapi, uvicorn, python-multipart, httpx | MIT, BSD-3-Clause, Apache-2.0, BSD-3-Clause | engine |
| keyring, with jaraco.classes, jaraco.context, jaraco.functools, more-itertools, jeepney and SecretStorage | MIT (SecretStorage: BSD-3-Clause) | API keys in the system's password store |

## Build tools, not distributed

Vite (MIT), TypeScript (Apache-2.0), @tauri-apps/cli (Apache-2.0 or MIT), PyInstaller (GPL-2.0-or-later with the bootloader exception, which permits distributing the frozen engine under this project's license).

## Trademarks

Adobe and Illustrator are trademarks of Adobe Inc. formpth is not affiliated with or endorsed by Adobe. The names are used only to describe compatibility and the parity measurement; no Adobe asset, preset, icon or file format specification is included.
