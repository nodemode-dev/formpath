<p align="center">
  <img src="assets/app-icon/formpath-256.png" width="128" height="128" alt="FormPath icon">
</p>

<h1 align="center">FormPath</h1>

<p align="center">
  <b>Vector illustration; artboards, pen tools and live effects in one window.</b><br>
  Pen and Curvature tools, Pathfinder, gradients, live effects and 3D type,<br>
  with SVG, PDF, EPS and DXF. Local-first, no account, and agents can draw in it.
</p>

<p align="center">
  <img alt="version 0.52.10" src="https://img.shields.io/badge/version-0.52.10-eef0f4?style=flat-square">
  <img alt="TypeScript and Vite" src="https://img.shields.io/badge/TypeScript%20%2B%20Vite-vanilla-3178c6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Python and FastAPI" src="https://img.shields.io/badge/Python%20%2B%20FastAPI-engine-009688?style=flat-square">
  <img alt="macOS, Windows, Linux" src="https://img.shields.io/badge/macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-native-2f7bf5?style=flat-square">
  <img alt="License: Apache 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3a3a3a?style=flat-square">
  <img alt="Status: pre-release" src="https://img.shields.io/badge/status-pre--release-d69e2e?style=flat-square">
</p>

<p align="center">
  <a href="https://formpath.formai.studio/"><b>Download FormPath on formai.studio</b></a> ·
  <a href="#run-it-from-source">Run it from source</a> ·
  <a href="#the-form-family">All Form apps</a>
</p>

<br>

<p align="center">
  <img src="docs/images/formpath-hero.jpg" alt="FormPath with the word FORMPATH set as gold 3D extruded type over a purple artboard with orbit rings, the Properties panel and the 3D and Materials panel showing Extrude settings" width="100%">
  <br>
  <sub>Live 3D extrude on editable type, with the Properties, Color and 3D and Materials panels open.</sub>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#everything-in-the-box">In the box</a> ·
  <a href="#built-for-agents">Agents</a> ·
  <a href="#under-the-hood">Under the hood</a> ·
  <a href="#download">Download</a> ·
  <a href="#run-it-from-source">Run from source</a> ·
  <a href="#the-form-family">Form family</a>
</p>

<br>

<table>
  <tr>
    <td width="25%" valign="top"><h3>Live everything</h3>Shapes, corners, effects, Trace Image and 3D stay editable after you draw them.</td>
    <td width="25%" valign="top"><h3>Real file formats</h3>Opens and writes SVG, PDF, EPS and DXF, and opens any PDF or PDF-compatible <code>.ai</code> as editable art.</td>
    <td width="25%" valign="top"><h3>Local-first</h3>Projects save as <code>.fpth</code> on your computer, with a library, conflict copies and crash recovery. No account.</td>
    <td width="25%" valign="top"><h3>Agent-ready</h3>The same commands from the window, the terminal and an MCP server for Claude Code, Codex and Cursor.</td>
  </tr>
</table>

<br>

## Features

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/formpath-properties.webp" alt="FormPath with the sun circle selected over a sunset landscape, showing its transform, fill and quick actions in the Properties panel" width="100%">
      <br><sub>A selected shape with its Properties, Color, Appearance and Layers panels.</sub>
      <h3>Panels that follow the selection</h3>
      Transform, fill, stroke and opacity sit next to quick actions such as Offset Path and Outline Stroke. Every object keeps its own appearance stack.
    </td>
    <td width="50%" valign="top">
      <img src="docs/images/formpath-effects.webp" alt="FormPath with the Effect menu open over a sunset landscape, listing Warp, Distort and Transform, Pathfinder, 3D and Materials, Effect Gallery and raster effect groups" width="100%">
      <br><sub>The Effect menu over a full artboard.</sub>
      <h3>Live effects</h3>
      Warps, Pathfinder, 3D and Materials and the Effect Gallery apply as live effects. Change or remove them later without redrawing.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/formpath-outline.webp" alt="FormPath in Outline view with every path of a sunset landscape selected and the Pathfinder quick actions in the Properties panel" width="100%">
      <br><sub>Outline view with all eleven objects selected.</sub>
      <h3>Paths you can reach</h3>
      Outline view shows every anchor and curve. With several objects selected, Unite, Minus Front, Intersect, Exclude and Make Compound Path are one click away.
    </td>
    <td width="50%" valign="top">
      <h3>Type that stays type</h3>
      Point, area, vertical and on-path type with OpenType features, variable fonts, Glyphs and Create Outlines through real glyph outlines.
    </td>
  </tr>
</table>

## Everything in the box

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>Drawing and layout</h4>
      Artboards · Layers and sublayers · Pen · Curvature · Pencil · Paintbrush · Blob Brush · Live shapes · Knife · Smart guides · Rulers and grids</td>
    <td width="33%" valign="top"><h4>Paint, effects and type</h4>Gradients · Gradient mesh · Patterns · Recolor Art · Pathfinder · Blends · Symbols · Envelopes · Trace Image · 3D Extrude, Revolve, Inflate, Plane · Effect Gallery · Variable fonts</td>
    <td width="33%" valign="top"><h4>Formats</h4>Opens: <code>.fpth</code>, SVG, PDF, <code>.ai</code>, EPS, DXF, PNG, JPEG, WebP · Saves: <code>.fpth</code>, SVG, PDF, EPS, DXF, PNG, JPEG, WebP · Native: <code>.fpth</code></td>
  </tr>
</table>

Interface in 26 languages, chosen in Preferences, Interface. What is covered and what is still partial, row by row: [`docs/PARITY.md`](docs/PARITY.md).

## Built for agents

The window, the terminal and the MCP server run the same command catalogue; the MCP server lists 93 tools.

```sh
./formpath cli list                  # list the command catalogue from a terminal
./formpath cli describe <command>    # show one command and its arguments
./formpath claude                    # Claude Code with FormPath's tools attached
./formpath mcp                       # MCP server on stdio for Claude Code, Codex and Cursor
```

`.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` are already wired in this repo. `./formpath agents install` sets them up for your user account. See [`AGENTS.md`](AGENTS.md).

## Under the hood

- **Engine:** a document engine in TypeScript with no DOM, rendered by the stage and driven by tools registered in one registry.
- **Service:** a FastAPI engine for projects, fonts, file import and export, and the MCP endpoint at `/mcp`.
- **Desktop:** a Tauri 2 shell that starts the engine as a sidecar.
- **UI:** keyed DOM patching and a pre-paint theme boot, so changes do not flash or re-render.
- **Tested:** Vitest suites for `.fpth`, SVG, PDF, Pathfinder and type outlines, plus pytest suites for the engine guard, consent, MCP, versions and project files.

## Download

**Get the app:** download FormPath from [formai.studio](https://formpath.formai.studio/). That is the easiest way to install it.

**Releases:** [`nodemode-dev/formcompiler`](https://github.com/nodemode-dev/formcompiler/releases?q=formpath-v&expanded=true) publishes every build. **Updates:** [FormPortal](https://github.com/nodemode-dev/formportal) installs, updates and rolls back every Form app.

Not released yet. Run it from source below. FormCompiler builds FormPath for macOS (Apple silicon and Intel), Windows x64 and Linux x64.

Builds are compiled and released from FormCompiler, not from this repo, which holds the source.

## Run it from source

Prefer it in your browser, or want to contribute? Run the web UI straight from this repo.

**Requires:** Node 20.19 or newer (22 recommended), Python 3.12 or newer, git. The desktop window also needs Rust stable and the Tauri 2 system packages.

```sh
git clone git@github.com:nodemode-dev/formpath.git
cd formpath
./formpath install    # installs the engine service and the frontend
./formpath boot       # engine and web UI, UI at http://localhost:5230
```

`./formpath desktop dev` opens the desktop window instead, and `./build_app` builds and installs it.
On Windows use `formpath.bat install` and `formpath.bat boot`. The engine listens on `127.0.0.1:8230` (API under `/api`, MCP at `/mcp`) and reads `backend/.env`, never committed (`backend/.env.example` is the template). Settings are `FORMPATH_HOST`, `FORMPATH_PORT`, `FORMPATH_DATA_DIR`, `FORMPATH_CORS_ORIGINS`, `FORMPATH_DIST` and `FORMPATH_TARGET`.

> [!IMPORTANT]
> **Status:** pre-release. The macOS and Windows desktop bundles, signing and the updater are not verified yet, and some parity rows are partial, listed in [`docs/PARITY.md`](docs/PARITY.md). PDF import skips encrypted files, `.ai` files saved without PDF compatibility and some scanned images, and reports what it left out.

**Contributing:** branch from `main`, keep changes to source here, and leave packaging and releases to FormCompiler. See [`.docs/BRANCHING.md`](.docs/BRANCHING.md) and [`AGENTS.md`](AGENTS.md).

## Repository

`frontend/` (Vite, vanilla TypeScript) · `backend/` (FastAPI engine) · `src-tauri/` (desktop shell) · `setup/` (one script per task) · `docs/` (manual and parity)

Docs: [`.docs/wiki`](.docs/wiki) · Agents: [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md) · Contributing: [`.docs/BRANCHING.md`](.docs/BRANCHING.md)

## The Form family

FormPath is one of the **Form apps**: native creative tools that install, update and roll back through FormPortal and can all be driven by agents.

| | App | What it's for | Download | Code |
|:-:|---|---|---|---|
| <img src=".github/assets/family/form.md.png" alt="" width="32" height="32"> | **form.md** | Documents, databases and realtime editing together | [formai.studio](https://formmd.formai.studio/) | [GitHub](https://github.com/nodemode-dev/form.md) |
| <img src=".github/assets/family/format.png" alt="" width="32" height="32"> | **FormAT** | Chat and agent workspace on your key | [formai.studio](https://format.formai.studio/) | [GitHub](https://github.com/nodemode-dev/format) |
| <img src=".github/assets/family/formCAD.png" alt="" width="32" height="32"> | **FormCAD** | Drafting, parametric parts and NURBS surfaces | | [GitHub](https://github.com/nodemode-dev/formCAD) |
| <img src=".github/assets/family/formcel.png" alt="" width="32" height="32"> | **FormCel** | Spreadsheets agents can read and edit | [formai.studio](https://formcel.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formcel) |
| <img src=".github/assets/family/formcraft.png" alt="" width="32" height="32"> | **FormCraft** | Generate images, video, audio, 3D and worlds | | [GitHub](https://github.com/nodemode-dev/formcraft) |
| <img src=".github/assets/family/formcut.png" alt="" width="32" height="32"> | **FormCut** | Multi-track video editing with no upload | [formai.studio](https://formcut.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formcut) |
| <img src=".github/assets/family/formDAM.png" alt="" width="32" height="32"> | **FormDAM** | Photo library and asset manager | [formai.studio](https://formdam.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formDAM) |
| <img src=".github/assets/family/formdeck.png" alt="" width="32" height="32"> | **FormDeck** | Presentations and pitch decks | [formai.studio](https://formdeck.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formdeck) |
| <img src=".github/assets/family/formdesign.png" alt="" width="32" height="32"> | **FormDesign** | Page layout for print and the web | [formai.studio](https://formdesign.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formdesign) |
| <img src=".github/assets/family/formencoder.png" alt="" width="32" height="32"> | **FormEncoder** | Media encoding queue with presets | [formai.studio](https://formencoder.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formencoder) |
| <img src=".github/assets/family/formfabric.png" alt="" width="32" height="32"> | **FormFabric** | Sewing patterns draped with cloth simulation | | [GitHub](https://github.com/nodemode-dev/formfabric) |
| <img src=".github/assets/family/formlit.png" alt="" width="32" height="32"> | **FormLit** | Photo library and raw development | [formai.studio](https://formlit.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formlit) |
| <img src=".github/assets/family/formmorpheus.png" alt="" width="32" height="32"> | **FormMorpheus** | Frame-by-frame and performed animation | | [GitHub](https://github.com/nodemode-dev/formmorpheus) |
| <img src=".github/assets/family/formNET.png" alt="" width="32" height="32"> | **FormNET** | See what your computer sends online | | [GitHub](https://github.com/nodemode-dev/formNET) |
| <img src=".github/assets/family/formpath.png" alt="" width="32" height="32"> | **FormPath** | Vector illustration with artboards and type | [formai.studio](https://formpath.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formpath) |
| <img src=".github/assets/family/formpdf.png" alt="" width="32" height="32"> | **FormPDF** | Edit, redact, sign and fill PDFs | [formai.studio](https://formpdf.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formpdf) |
| <img src=".github/assets/family/formpromo.png" alt="" width="32" height="32"> | **FormPromo** | Promo films from your own media | [formai.studio](https://formpromo.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formpromo) |
| <img src=".github/assets/family/formref.png" alt="" width="32" height="32"> | **FormRef** | Reference boards for creative work | [formai.studio](https://formref.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formref) |
| <img src=".github/assets/family/formrig.png" alt="" width="32" height="32"> | **FormRig** | Rig, skin and retarget any mesh | | [GitHub](https://github.com/nodemode-dev/formrig) |
| <img src=".github/assets/family/formsculpt.png" alt="" width="32" height="32"> | **FormSculpt** | 3D sculpting, remeshing and painting | [formai.studio](https://formsculpt.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formsculpt) |
| <img src=".github/assets/family/formsurface.png" alt="" width="32" height="32"> | **FormSurface** | Texture painting with PBR export | [formai.studio](https://formsurface.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formsurface) |
| <img src=".github/assets/family/formtools.png" alt="" width="32" height="32"> | **FormTools** | Viewers, batch tools and file utilities | | [GitHub](https://github.com/nodemode-dev/formtools) |
| <img src=".github/assets/family/formtxt.png" alt="" width="32" height="32"> | **FormTxt** | Word processing with .docx round trips | [formai.studio](https://formtxt.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formtxt) |
| <img src=".github/assets/family/formvfx.png" alt="" width="32" height="32"> | **FormVFX** | Motion graphics and VFX compositing | [formai.studio](https://formvfx.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formvfx) |
| <img src=".github/assets/family/formvis.png" alt="" width="32" height="32"> | **FormVis** | Layered image editing with local AI | [formai.studio](https://formvis.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formvis) |
| <img src=".github/assets/family/formwav.png" alt="" width="32" height="32"> | **FormWav** | Multitrack audio editing and mixing | [formai.studio](https://formwav.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formwav) |
| <img src=".github/assets/family/formweb.png" alt="" width="32" height="32"> | **FormWeb** | Visual website building with a CMS | [formai.studio](https://formweb.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formweb) |
| <img src=".github/assets/family/formportal.png" alt="" width="32" height="32"> | **FormPortal** | Install, update and roll back Form apps | [formai.studio](https://formportal.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formportal) |
| <img src=".github/assets/family/formtray.png" alt="" width="32" height="32"> | **FormTray** | One dock icon for every app | [formai.studio](https://formtray.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formtray) |
| <img src=".github/assets/family/formMCP.png" alt="" width="32" height="32"> | **FormMCP** | One MCP connection to the family | [formai.studio](https://formmcp.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formMCP) |
| <img src=".github/assets/family/formskills.png" alt="" width="32" height="32"> | **FormSkills** | Every app's agent skills in one place | [formai.studio](https://formskill.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formskills) |
| <img src=".github/assets/family/formbench.png" alt="" width="32" height="32"> | **FormBench** | Parity, testing and rankings for the family | [formai.studio](https://formranker.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formbench) |
| <img src=".github/assets/family/formslot.png" alt="" width="32" height="32"> | **FormSlot** | Codebase memory for coding agents | | [GitHub](https://github.com/nodemode-dev/formslot) |
| <img src=".github/assets/family/subform.png" alt="" width="32" height="32"> | **SubForm** | Workbench for parallel Claude Code agents | | [GitHub](https://github.com/nodemode-dev/subform) |
| <img src=".github/assets/family/formcompiler.png" alt="" width="32" height="32"> | **FormCompiler** | Builds, signs and releases every app | [formai.studio](https://formcompiler.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formcompiler) |
| <img src=".github/assets/family/formpipe.png" alt="" width="32" height="32"> | **FormPipe** | Release pipeline and update feeds | | [GitHub](https://github.com/nodemode-dev/formpipe) |

---

## Maintainers

| Maintainer | Role |
|---|---|
| [@nodemode-ai](https://github.com/nodemode-ai) | Owner |
| [@gbarnai](https://github.com/gbarnai) | Co-owner |

Code owners are set in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## License

FormPath is licensed under the Apache License 2.0 ([`LICENSE`](LICENSE), SPDX `Apache-2.0`). Copyright 2026 NodeAgentc, Inc. Third-party notices: [`NOTICE.md`](NOTICE.md).

<sub>Adobe and Illustrator are either registered trademarks or trademarks of Adobe in the United States and/or other countries. FormPath is not affiliated with or endorsed by Adobe. The names are used only to describe file compatibility (`.ai`, `.eps`).</sub>
