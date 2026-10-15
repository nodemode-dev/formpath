<p align="center"><img src="assets/formpth_icon.png" width="112" alt="formpth"></p>
<h1 align="center">formpth</h1>
<p align="center"><b>Vector illustration for the web and the desktop, in the NodeMode design system.</b></p>
<p align="center">
<img src="https://img.shields.io/badge/version-0.27.0-f97316" alt="version 0.27.0">
<img src="https://img.shields.io/badge/node-22-339933" alt="node 22">
<img src="https://img.shields.io/badge/python-3.12-3776AB" alt="python 3.12">
<img src="https://img.shields.io/badge/tauri-2-24C8DB" alt="tauri 2">
<img src="https://img.shields.io/badge/license-Apache--2.0-lightgrey" alt="Apache 2.0 license">
</p>

## What it is

formpth is the vector member of the form family: an Illustrator alternative with artboards, layers, live shapes, the Pen and Curvature tools, Pathfinder, gradients, an appearance stack with live effects, variable fonts and Touch Type, symbols and the symbolism tools, blends, repeats, Live Paint, gradient meshes, pattern editing, live image trace, the Perspective Grid, Puppet Warp, Shaper, graphs and data merge. It saves its own `.fpth` projects, reads and writes SVG, PDF, EPS and DXF (any PDF or PDF-compatible `.ai` opens as editable art), writes PNG, JPEG and WebP, and runs in a browser or as a desktop app on macOS, Windows and Linux. Agents draw in it through an MCP server with 86 tools, and Claude Code runs inside its own terminal dock.

**Stack.** Vanilla TypeScript 7 and Vite 8 · Python 3.12 and FastAPI · Tauri 2 · about 38,900 lines of TypeScript, 1,800 of CSS, 3,800 of Python and 100 of Rust (product code; `./formpth counts` prints this, and `./formpth counts --check` fails when it drifts).

## Highlights

- **Artboards and layers.** Any number of artboards with the Artboard tool and panel; layers and sublayers with colours, lock, template, print and dim; groups with isolation mode; clipping masks; 16 blend modes and opacity masks.
- **Drawing.** Pen, Curvature and the anchor tools; Pencil, Smooth, Path Eraser and Join; Rectangle, Rounded Rectangle, Ellipse, Polygon, Star and Flare as live shapes, editable after drawing with corner widgets; Line, Arc, Spiral and grids; Paintbrush and Blob Brush; Eraser, Scissors and Knife. Smart guides with equal spacing, snap to pixel, rulers, guides and grids; Magic Wand tolerances and Ctrl-click to select behind.
- **Pathfinder on curves.** All ten Pathfinder operations through paper.js, Shape Builder, Live Paint groups with gap detection, per-segment edges and the Live Paint Selection tool, compound paths, Offset Path, Outline Stroke, Simplify, Average, Join, Divide Objects Below, Split into Grid.
- **Paint.** Colour panel in Grayscale, RGB, HSB, CMYK and Web; swatches with global and spot colours; linear and radial gradients on fills and strokes with the Gradient tool; freeform gradients in points and lines modes; gradient mesh with point handles; patterns with pattern editing mode; Recolor Artwork and the Color Guide's harmony rules; the Stroke panel with dashes, arrowheads and width profiles; the Width tool.
- **Appearance and effects.** Multiple fills and strokes per object, Graphic Styles, and live effects: fifteen warps, Distort and Transform, Drop Shadow, glows, Feather, Round Corners, Scribble, Offset Path, Rasterize, and the Effect Gallery's 56 Photoshop effects from Watercolor to Stained Glass, all live. 3D Extrude & Bevel, Revolve, Inflate and Plane with materials, lighting, Map Art and shadows, on shapes, type and groups. Envelopes, blends, repeats, symbols with the seven symbolism tools, four brush kinds made from your own art, and Image Trace as a live object with five views.
- **Type.** Point, area, vertical and on-path type typed on the canvas, area type inside any shape, threaded frames and text wrap, Character and Paragraph panels with OpenType features shaped from the font's own lookups (contextual alternates included), Character and Paragraph Styles, Glyphs with each character's alternates, Change Case, Find and Replace, Find Font, and Create Outlines through real glyph outlines.
- **Files.** `.fpth` projects with a library, conflict copies and crash recovery; SVG in and out with exact round trips; PDF out with real vectors, shadings, transparency and CMYK, and in from any PDF or PDF-compatible `.ai` with one artboard per page; PNG, JPEG and WebP; Export for Screens and the Asset Export panel; placed and linked images.
- **Agents.** `./formpth mcp` gives Claude Code, Codex and Cursor 86 tools, from `get_image` to `pathfinder` to `run_command` and `run_commands` over the whole command catalogue. The window asks the person once. The `formpth-harness` skill pack teaches agents to look, plan, build, check and deliver.
- **Terminal and Claude Code inside the window.** Window > Terminal opens a dock of real shells; its Claude Code button starts your own `claude` already connected to formpth's tools, and the Chat tab answers in plain words while it draws. `./formpth cli` lists, describes and runs any of the 649 catalogue commands from a terminal.
- **26 languages.** English by default, with Spanish (Spain and Mexico), Portuguese (Brazil), French (France and Canada), German, Italian, Dutch, Danish, Finnish, Norwegian, Swedish, Russian, Polish, Czech, Hungarian, Ukrainian, Turkish, Chinese (Simplified and Traditional), Japanese, Korean, Indonesian, Thai and Vietnamese in Preferences > Interface, using Illustrator's own terms in each.
- **Live Corners on any path.** Direct Selection shows a corner widget at every corner point: drag to round, Alt-click for inverted or chamfer, double-click for the Corners dialog.
- **The assistant and plugins.** Window > Assistant edits through the same tools on the language model you choose; sandboxed JavaScript plugins add commands.
- **Zero-flash UI.** Keyed DOM patching, guarded writes, a pre-paint theme boot, reveal after fonts; every interface change is checked in a throttled browser.

How close it is to Illustrator, row by row: [docs/PARITY.md](docs/PARITY.md).

## Quick Start

Requirements: Node 20.19 or newer (22 recommended), Python 3.12 or newer, git. The desktop build also needs Rust stable and the Tauri 2 system packages for your OS.

### macOS and Linux

```bash
git clone git@github.com:nodemode-ai/formpth.git
cd formpth
./formpth install
./formpth boot
```

To build and install the desktop app in one run: `./build_app` (macOS and Linux, logged to `build_app.log`) or `build_app.bat` (Windows). `./formpth claude` starts Claude Code in your terminal with formpth's tools attached.

### Windows

```bat
git clone git@github.com:nodemode-ai/formpth.git
cd formpth
formpth.bat install
formpth.bat boot
```

| Service | URL | Notes |
| --- | --- | --- |
| Frontend (dev) | http://localhost:5230 | Vite, bound to localhost only, strict port |
| Engine | http://127.0.0.1:8230 | FastAPI; API under `/api`, MCP at `/mcp`; serves the built app in `./formpth serve` |
| Preview | http://localhost:5231 | `vite preview` of the production build |
| Desktop engine | random loopback port | picked by the OS, read by the Tauri shell from the startup line |

### Drawing with an agent

```bash
./formpth agents install     # Claude Code, Codex and Cursor, for your user account
```

In this repository `.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` already point at `./formpth mcp`.

## Configuration

The engine reads `backend/.env`, which is never committed; `backend/.env.example` is the template.

| Variable | Purpose |
| --- | --- |
| `FORMPTH_HOST` | Engine bind address |
| `FORMPTH_PORT` | Engine port; `0` picks a free port (desktop) |
| `FORMPTH_DATA_DIR` | Project library and exports root (default `~/Formpth`) |
| `FORMPTH_CORS_ORIGINS` | Allowed browser origins for the dev frontend |
| `FORMPTH_DIST` | Built frontend folder the engine serves |
| `FORMPTH_TARGET` | Target triple override for the frozen sidecar |

## Architecture

```text
formpth/
├── formpth, formpth.bat           root dispatcher: install, boot, build, serve, desktop, doctor, mcp, agents
├── formpth_oc_install(.bat)        one-command install
├── setup/                          one script per task, each with a .bat twin; lib.sh holds shared helpers
├── assets/                         repo art (README logo, desktop icon source), not app runtime files
├── backend/                        FastAPI engine service
│   ├── app/routers/                system, projects, fonts, io, mcp, llm, plugins, nodemode
│   ├── app/services/               project_format, sessions, fonts, llm, secrets, outbound
│   └── formpth_engine.py           PyInstaller entry for the desktop sidecar
├── frontend/                       Vite app, vanilla TypeScript
│   ├── src/engine/                 document engine, no DOM: nodes, history, render, geometry, kernel, effects
│   ├── src/tools/                  tool modules registered through src/extensions/registry.ts
│   ├── src/io/                     .fpth, SVG, PDF, raster, trace, fonts, the engine client
│   ├── src/automation/             the agent bridge that runs every MCP tool
│   ├── src/ui/                     shell, stage, panels, menus, dialogs, icons, themes
│   └── src/styles/                 NodeMode tokens and component sheets
├── src-tauri/                      Tauri 2 shell: sidecar spawn, port handshake, window sizing, updater
├── docs/                           MANUAL.md (also the in-app Help), PARITY.md
├── .docs/                          BRANCHING.md and the wiki source
├── .github/workflows/              ci, wiki publish, desktop release matrix
└── .claude/skills/                 formpth-skillset (code) and formpth-harness (drawing over MCP)
```

## Development

Branch model: `main` plus short-lived work branches, see `.docs/BRANCHING.md`. Docs live in `.docs/wiki/` and publish to the GitHub wiki on merge. Contributions follow the dev-rules laws: single-region hand edits, zero DOM flash or re-render, no emoji, no em dashes, near-zero comments with decisions in `frontend/HASHOUT_LOG.md` and `backend/HASHOUT_LOG.md`. `./formpth check` typechecks and builds the frontend and self-checks the engine.

## Status

Release history: `CHANGELOG.md`. What is not verified yet:

- **Desktop bundles.** The Tauri shell compiles against the Linux webview packages; the macOS and Windows bundles, signing and the updater have not been built yet. The first `v0.9.0` tag runs the release workflow.
- **Parity.** 72 of 76 rows against Illustrator 30 (68 Full, 8 Partial, 0 None), 94.7 percent, from an independent audit of the code. Partial: Smart Guides (fixed construction angles), 3D (one light, no ray tracing), `.ai` (read through PDF, no writer), PDF (outlined type), EPS and DXF (no DWG), colour management and print, and two generative rows that run through the Assistant. See `docs/PARITY.md`.
- **PDF import.** Encrypted PDFs, `.ai` files saved without PDF compatibility, CCITT and JBIG2 scanned images, mesh shadings and tiling patterns do not come in; the open reports what it left out.

## Contributors

- **nodemode-ai** · owner and build

## Licensing

Apache License 2.0. Copyright 2026 nodemode-ai. See `LICENSE` and `NOTICE.md`.
