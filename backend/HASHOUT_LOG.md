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

### app/routers/mcp.py · three_d
- refers-to: app/routers/mcp.py :: TOOLS three_d; frontend/src/automation/agent-bridge.ts :: three_d
- kind: rationale
- logged: v0.15.0 · 2026-10-07

3D could be reached through `apply_effect` alone, but an agent then has to know four effect ids, rotate in raw degrees and resend every parameter to change one. `three_d` takes a plain kind, named positions and only the parameters to change, keeps the rest (as the panel does through `Engine.set3d`), and answers with the full parameter set so the next call can adjust from it. The catalogue is at 66 tools.

### app/routers/mcp.py · three_d Map Art and shadows
- refers-to: app/routers/mcp.py :: TOOLS three_d; frontend/src/automation/agent-bridge.ts :: three_d
- kind: explainer
- logged: v0.16.0 · 2026-10-07

`map_symbol` takes a symbol name (or id) and fails with the list of the document's symbols when it matches none, or says to make one first when there are none, because a silent miss would leave a plain face the agent cannot tell from a wrong scale. It is stored as the id so a rename keeps the mapping, and the answer names the symbol rather than the id. The shadow parameters and `shade_art` pass straight through; Inflate takes rx, ry and rz to tilt and ignores Map Art and shadows, which are vector-face features. The tool count is unchanged.

### app/routers/mcp.py · window bridge session
- refers-to: app/routers/mcp.py :: _app_origin, _bridge_refusal, bridge_session, bridge_next, bridge_next_get, bridge_result, bridge_stop, _secret, _superseded, _delivered
- kind: rationale
- logged: v0.17.0 · 2026-10-08

An audit found that `GET /api/mcp/bridge/next?allowed=1` set the consent flag for any caller (a missing `allowed` counted as yes, and a cross-site image could fire it), and that any local client could pose as the window: take queued calls (including the file bytes `open_file` reads here), answer `__consent__` itself, drain the queue, or post results through `/api/mcp/bridge/result`. The window now opens a session with `POST /api/mcp/bridge/session`, which issues a fresh `secrets.token_urlsafe(32)` only when the request's Origin is formpth's own page: the CORS origins (the Vite dev server on 5230), the Vite preview on 5231, and `http://localhost`, `127.0.0.1` or `[::1]` on the port this server is actually listening on (`request.scope["server"]`, so the desktop sidecar's random port works). It is a POST because browsers send Origin on every POST, while a same-origin GET carries none. Every bridge call is a POST from that Origin with the secret in `X-Formpth-Bridge`; anything else gets 403 and changes nothing, and `GET /api/mcp/bridge/next` answers 405 without touching state. `allowed` now comes from the JSON body and only `true` allows; a missing value means not allowed. A new session supersedes the last: only the newest secret receives queued calls, a window still polling with an older one gets 205 (a success status, so the browser logs no error) and waits for focus before taking the bridge back. Each delivered call remembers which secret took it (`_delivered`), and its result is accepted only from that secret, so a window that is superseded mid-call can still finish it while nobody else can answer for it. `POST /mcp` is unchanged (agents' clients send no Origin, and a foreign Origin is still refused there); the stdio bridge in `setup/mcp_stdio.py` only talks to it. Origin is a browser guarantee: a local program can forge it, but a local program already has the person's files, and the point is that no web page can drive or read the bridge.

### app/routers/mcp.py · tauri origins left out of the bridge
- refers-to: app/routers/mcp.py :: _app_origin; src-tauri/src/main.rs :: WebviewUrl::External; src-tauri/tauri.conf.json :: app.security.csp
- kind: rationale
- logged: v0.17.0 · 2026-10-08

The desktop shell loads the main window from the sidecar as an external URL (`http://127.0.0.1:[port]`), so its Origin is the engine's own and is already accepted. `tauri://localhost` and `http://tauri.localhost` serve only the splash, and every Tauri app on the machine shares them, so they are not bridge origins (`_local_origin` for `POST /mcp` keeps accepting them as before). For the same reason the Tauri CSP stays `null`: it applies only to pages Tauri serves itself (the splash, which loads nothing remote) and would never reach the main window, and setting it cannot be checked without a desktop build. The app's own policy is the `frame-src 'none'; object-src 'none'` meta in `frontend/index.html`, which holds in the browser and the desktop alike.

### app/routers/mcp.py · attributes, apply_effect item and graphic_style actions
- refers-to: app/routers/mcp.py :: TOOLS attributes, apply_effect, graphic_style, set_appearance
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`attributes` mirrors the Attributes panel: `fill_rule` sets nonzero or evenodd on paths and compound paths (groups pass it down), `reverse` reverses path direction (one compound subpath when its own id is passed), and `note` sets the object note; it answers with each object's rule and note. `apply_effect` gained `item`, an index into `ap.items` as `get_object` lists it, for effects on one fill or stroke; 3D effects are refused there because they turn the whole object. `graphic_style` gained `redefine`, `break_link`, `libraries` and `load_library`, and `apply` with `library` adds one library style to the document and applies it. `set_appearance` says that groups and layers have their own stack. The catalogue is at 67 tools.

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

### app/services/fonts.py · variable fonts
- refers-to: app/services/fonts.py :: _has_table, _members, _scan, listing, find
- kind: rationale
- logged: v0.18.0 · 2026-10-08

Each listed face now carries `variable`, true when its table directory has an `fvar` table, so the Character panel can mark and filter variable families without downloading them; the field is new and optional, so older clients ignore it. A variable family is listed by its files (Lora Regular and Lora Italic) while the window asks for named instances (Lora SemiBold, Lora Bold Italic), which match no file's style. `find` used to fall back to the family's Regular for any unknown style, which sent italic instances to the upright file; it now keeps to faces of the same slant (italic or oblique against upright), prefers variable files and then the plain Regular or Italic. Static families resolve as before, except that an unknown italic style now finds the family's Italic instead of its Regular.
