# HASHOUT_LOG · backend

Living context log for `backend/`. In-code comments are near zero; the explanations, rationale, removed code and todos that would have been comments live here, anchored to the file and symbol. Read this before editing.

## Org-navi-map

```text
backend/
├── formpth_engine.py           PyInstaller entry for the desktop sidecar, --selfcheck
├── boot_backend(.bat)          dev launcher: uvicorn with reload on 127.0.0.1:8230
├── oc_install(.bat)            venv and requirements
├── requirements.txt            engine dependencies (pinned)
├── requirements_macos.txt      the same for macOS
├── requirements_desktop.txt    plus PyInstaller, for freezing
├── requirements_desktop_macos.txt
├── .env.example                configuration template; .env is never committed
└── app/
    ├── __init__.py             __version__
    ├── main.py                 FastAPI app, routers, CORS, the built frontend mount
    ├── core/
    │   └── config.py           ports, limits, data and library folders, .env loading
    ├── routers/
    │   ├── system.py           health, version, capabilities
    │   ├── projects.py         .fpth library: list, save with conflict copies, package, import, folder
    │   ├── fonts.py            installed fonts: list, find, file
    │   ├── io.py               writes exports for the window
    │   ├── mcp.py              MCP endpoint, the TOOLS catalogue, the window bridge
    │   ├── llm.py              the assistant's model, status and step
    │   ├── plugins.py          installed plugin scripts
    │   └── nodemode.py         send artwork to a NodeMode canvas
    └── services/
        ├── project_format.py   .fpth package validation and writing
        ├── sessions.py         temporary opened-project sessions, pruned at start
        ├── fonts.py            system font folders scan and lookup
        ├── llm.py              Ollama and OpenAI-compatible clients
        ├── secrets.py          API keys in the system keyring
        └── outbound.py         outbound URL checks and errors for NodeMode
```

## Table of contents

Scripts with entries, in folder order. Every other script is in the map above with its role and has no entries yet.

- formpth_engine.py
- app/core/config.py
- app/routers/mcp.py
- app/routers/projects.py
- app/routers/fonts.py
- app/services/fonts.py

## formpth_engine.py

### formpth_engine.py · main
- refers-to: formpth_engine.py :: main, selfcheck
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The desktop shell starts this with `FORMPTH_PORT=0`; Uvicorn binds a free loopback port and prints `http://127.0.0.1:[port]`, which the shell reads from stdout. A bundled `frontend_dist` folder is served when present. `--selfcheck` prints the Python and package versions, the formpth version and the MCP tool count as JSON, and is run by `setup/freeze_backend` and CI.

## app/core/config.py

### app/core/config.py · ports and folders
- refers-to: app/core/config.py :: BACKEND_PORT, data_dir, projects_dir
- kind: rationale
- logged: v0.9.0 · 2026-10-07

8230 so formpth runs beside formvis (8190). Data lives in `~/Formpth` unless `FORMPTH_DATA_DIR` is set; the library folder can be moved (`FORMPTH_LIBRARY_DIR`, or `library.json` written by the app), including into a synced folder.

## app/routers/mcp.py

### app/routers/mcp.py · transport
- refers-to: app/routers/mcp.py :: mcp, bridge_next, bridge_result
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Stateless JSON-RPC on `POST /mcp` (protocol versions 2026-07-28 and 2025-11-25). Tool calls queue for the window, which long-polls `/api/mcp/bridge/next` and posts results to `/api/mcp/bridge/result`. Only local origins are accepted.

### app/routers/mcp.py · consent
- refers-to: app/routers/mcp.py :: _call
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The first call queues `__consent__`; the window asks the person once. A refusal holds for ten minutes so an agent loop cannot keep re-asking. When no window has polled recently, the engine opens one in the browser (never in the desktop app) and waits up to 45 seconds.

### app/routers/mcp.py · file tools
- refers-to: app/routers/mcp.py :: _run, _path, _write
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Paths are checked here, not in the window: absolute, an allowed extension, the file present when reading, the folder present when writing. The window only produces or consumes bytes. Every error says what to do next.

### app/routers/mcp.py · add_text description
- refers-to: app/routers/mcp.py :: TOOLS, add_text
- kind: explainer
- logged: v0.9.0 · 2026-10-07

States that type is black unless `color` is given, matching the bridge's default. After changing any entry in `TOOLS`, run `./formpth agents sync`; CI checks it.

### app/routers/mcp.py · type tools
- refers-to: app/routers/mcp.py :: TOOLS, set_text, text_flow, text_style, find_font
- kind: explainer
- logged: v0.10.0 · 2026-10-07

`text_flow` folds threading and text wrap into one tool with an `action`, since both decide where a story's lines go and an agent reaches for them at the same moment (copy that does not fit). `text_style` covers both style kinds with `kind`. `find_font` is not marked read-only because `replace` edits. `set_text` gained `caps` and `features`; `features` replaces the whole list, so an agent adds a tag by sending the old tags with it. Object descriptions now carry `overflow`, `next`, `wrapped` and `wrap`, which is how an agent sees that a frame needs threading. The catalogue is at 58 tools.

### app/routers/mcp.py · paint and shape tools
- refers-to: app/routers/mcp.py :: TOOLS, _FILL, select_similar, edit_shape, color_harmony, set_paint
- kind: explainer
- logged: v0.11.0 · 2026-10-07

`set_paint` takes its fill as `_FILL`, which adds freeform gradients to `_COLOR`; strokes keep `_COLOR` because Illustrator has no freeform strokes. Freeform points are fractions of each object's bounds unless `absolute` is true, so one call can paint several objects of different sizes. `select_similar` is the Magic Wand with tolerances; `select_same` stays for exact matches on the twelve Select Same attributes. `edit_shape` reaches the live shape parameters; `get_object` reports them under `shape` in the same units. `color_harmony` is the Color Guide. The window now squashes every history step one call makes into one (`Engine.beginStep` and `endStep`), so an agent's undo always takes back exactly one call. The catalogue is at 61 tools.

### app/routers/mcp.py · live object tools
- refers-to: app/routers/mcp.py :: TOOLS, image_trace, live_paint, symbolism, gradient_mesh, edit_pattern
- kind: explainer
- logged: v0.12.0 · 2026-10-07

`image_trace` now leaves a live tracing object, as the app does; `expand: true` keeps the old one-call behaviour for agents that only want paths, and passing a tracing object's id traces it again. Its preset list names the presets that exist (the old list advertised outline, line art and technical drawing that the tracer did not have, and `corners` and `noise`, which it ignored; the last two are gone and the three presets now exist). Preset names match by their words, so `6_colors`, `colors 6` and `6 Colors` are the same preset, and a subset such as `black_and_white` finds Black and White Logo. `live_paint` answers with the face count and a point inside each of the first twelve faces, because an agent cannot see where faces are and needs a point to fill. `symbolism` applies to every instance unless x, y and radius give a brush, and `repeat` stands in for holding the mouse down; all repeats are one undo step. `gradient_mesh` addresses points by row and column, which `list` reports with their colours. `edit_pattern` changes a swatch in place without pattern editing mode, which is modal and meant for people. `group` now returns the new group's `id` beside `selection`. The catalogue is at 65 tools.

## app/routers/projects.py

### app/routers/projects.py · save conflicts
- refers-to: app/routers/projects.py :: save
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Saving compares the version the window opened with the file's current version; if another device or window changed it, the incoming save is written beside it as a conflict copy and both are kept.

## app/routers/fonts.py

### app/routers/fonts.py · find and file
- refers-to: app/routers/fonts.py :: find, font_file
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The browser and the desktop web views cannot read installed fonts, so the engine finds a face by family and style and serves its file by an opaque id; the frontend parses it with opentype.js for type outlines and PDF.

## app/services/fonts.py

### app/services/fonts.py · scan
- refers-to: app/services/fonts.py :: module
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Scans the system font folders for macOS, Windows and Linux once and caches the list; ids are hashes of paths so no path leaves the engine.

### app/services/fonts.py · fontconfig folders
- refers-to: app/services/fonts.py :: _dirs
- kind: explainer
- logged: v0.13.0 · 2026-10-07

On Linux the `dir` entries of fontconfig's configuration are added to the standard folders, so fonts a distribution installs outside `/usr/share/fonts` (TeX Live's OpenType fonts, for instance) are listed as the desktop lists them. Relative entries are skipped, since the home folders are already scanned, and folders inside a scanned folder are not added twice.
