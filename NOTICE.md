# Third-party notices

formpath is licensed under the Apache License 2.0 (see `LICENSE`). It includes or depends on the following works.

## Included in this repository

| Work | License | Where |
| --- | --- | --- |
| formvis (nodemode-ai), the shell, styles, harness, scripts, engine service and desktop shell this project starts from | Apache-2.0, same owner | throughout, renamed and adapted |
| NodeMode stylized design system: tokens, theme profiles, theme boot, dom-stable helpers, icon subset | MIT | `frontend/src/styles/tokens.css`, `frontend/src/ui/themes.ts`, `frontend/src/ui/dom.ts`, `frontend/src/ui/icons.ts`, `frontend/index.html` |
| `paintbrush` and `hand` icons from Remix Icon | Apache-2.0 | `frontend/src/ui/icons.ts` |
| Quick Selection, Paint Bucket, Dodge, Burn and Sponge icons from Phosphor Icons, Copyright (c) 2023 Phosphor Icons | MIT | `frontend/src/ui/icons.ts` |
| `link`, `unlink`, `pilcrow`, `moveSel`, `maximize` and `smartObject` icons from Lucide (its `link`, `pilcrow`, `move`, `maximize-2` and `square-square`; `unlink` is `link` with a slash added), Copyright (c) Lucide Contributors 2022, portions Copyright (c) Cole Bemis 2013-2022 as part of Feather (MIT) | ISC, text below | `frontend/src/ui/icons.ts` |
| Tauri sidecar shell template (tauri-compiler-skill) | MIT | `src-tauri/src/main.rs` |

The vector tool and panel icons in `frontend/src/ui/icons-vector.ts`, the app icon (`assets/formpath_icon.svg`) and the brand mark are drawn for this project.

## Distributed with the app

| Package | License | Notes |
| --- | --- | --- |
| Inter, JetBrains Mono (via @fontsource) | SIL OFL 1.1 fonts, MIT packaging | bundled font files, also used for Create Outlines |
| paper.js 0.12.18 | MIT | the curve kernel behind Pathfinder, offset and simplify |
| opentype.js 2.0.0 | MIT | glyph outlines for type rendering, Create Outlines and PDF type |
| @tauri-apps/api | Apache-2.0 or MIT | native menus on macOS |
| tauri, tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-updater, regex, serde_json | Apache-2.0 or MIT | desktop shell |
| fastapi, uvicorn, python-multipart, httpx | MIT, BSD-3-Clause, Apache-2.0, BSD-3-Clause | engine |
| Pillow 12.3.0, with LittleCMS 2 | MIT-CMU (HPND); LittleCMS is MIT | ICC profile reading and the colour lookup tables for Color Settings and Proof Colors |
| keyring, with jaraco.classes, jaraco.context, jaraco.functools, more-itertools, jeepney and SecretStorage | MIT (SecretStorage: BSD-3-Clause) | API keys in the system's password store |
| fonttools 4.67.0 | MIT | font subsets for live text in PDF export |
| pyspellchecker 0.9.1 (Tyler Barrus) | MIT (code) | spelling in the engine (`backend/app/services/spell.py`) |
| pyspellchecker's word frequency lists (`spellchecker/resources/*.json.gz`, 12 languages), generated from the OpenSubtitles2018 corpus of OPUS (P. Lison and J. Tiedemann, 2016) | licence to confirm: the package is MIT, but neither it nor OPUS states a licence for the corpus-derived lists | frozen with `--collect-data spellchecker` |
| xterm.js 6.0.0 and @xterm/addon-fit 0.11.0 | MIT | the Terminal pane |
| ptyprocess 0.7.0 (macOS and Linux), pywinpty 3.0.5 (Windows) | ISC, MIT | engine terminal sessions |
| Libraries inside the Pillow wheel | libjpeg, libpng, libtiff, libwebp, libavif, OpenJPEG, Little CMS, HarfBuzz, Brotli, zstd, xz, libxcb: permissive (see the wheel's LICENSE); FreeType 2.14.3 used under the FreeType License | Portions of this software are copyright (c) 2026 The FreeType Project (www.freetype.org). All rights reserved. |
| certifi | MPL-2.0 | engine: its `cacert.pem`, frozen unedited (through httpx) |
| Other Python packages frozen into the engine | MIT: annotated-doc, annotated-types, anyio, h11, httptools, pydantic, pydantic-core, pyyaml, typing-inspection, watchfiles; MIT-0: cffi; BSD-3-Clause: click, httpcore, idna, pycparser, python-dotenv, starlette, websockets; MIT OR Apache-2.0: uvloop; Apache-2.0 OR BSD-3-Clause: cryptography (its wheel bundles OpenSSL 3, Apache-2.0); PSF-2.0: typing-extensions and the CPython runtime | read from the installed metadata of `backend/requirements.txt`, 2026-10-23 |

## Desktop shell: crates under other licences

Tauri links these crates unedited (no `[patch]` and no vendored copy):

| Crate | Licence | Why it is there |
| --- | --- | --- |
| cssparser, selectors, dtoa-short, option-ext | MPL-2.0 | Tauri's HTML handling (tauri-utils); used unmodified, source at crates.io |
| ring | Apache-2.0 AND ISC | TLS for the updater (rustls) |
| webpki-root-certs | CDLA-Permissive-2.0 | root certificates for the updater's TLS |
| r-efi | MIT OR Apache-2.0 OR LGPL-2.1-or-later | used under MIT |

The Linux AppImage also carries the build machine's WebKitGTK, GTK and GLib (LGPL-2.1-or-later) as separate shared libraries. The installers carry this file and `LICENSE`.

## Build tools, not distributed

Test tools, development only (run by CI, never installed in or shipped with the app): pytest 9.1.1 with iniconfig, packaging, pluggy and pygments (MIT for pytest, iniconfig and pluggy; Apache-2.0 OR BSD-2-Clause for packaging; BSD-2-Clause for pygments), which run `backend/tests` (`backend/requirements-test.txt`); Playwright for Python 1.63.0 (Apache-2.0), which runs `frontend/tests/window` and is installed only in CI; vitest 5.0.5 (MIT) and linkedom 0.18.14 (ISC), which run `frontend/tests`, with their npm dependencies (MIT, ISC, BSD-2-Clause and Apache-2.0 for expect-type), all in `frontend/package.json` devDependencies.

Vite (MIT), TypeScript (Apache-2.0), @tauri-apps/cli (Apache-2.0 or MIT), PyInstaller (GPL-2.0-or-later with the bootloader exception, which permits distributing the frozen engine under this project's license).

## Lucide license

The Lucide icons listed above are used under this license.

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## Trademarks

Adobe and Illustrator are either registered trademarks or trademarks of Adobe in the United States and/or other countries. formpath is not affiliated with or endorsed by Adobe. The names are used only to describe file compatibility (`.ai`, `.eps`) and, in `docs/PARITY.md`, the capability measurement; formpath's own commands, tools and panels carry their own names; no Adobe asset, preset, icon or file format specification is included.
