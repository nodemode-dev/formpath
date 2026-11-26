# HASHOUT_LOG · backend

Living context log for `backend/`. In-code comments are near zero; the explanations, rationale, removed code and todos that would have been comments live here, anchored to the file and symbol. Read this before editing.

## Org-navi-map

```text
backend/
├── formpath_engine.py           PyInstaller entry for the desktop sidecar, --selfcheck
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
    │   ├── config.py           ports, limits, data and library folders, .env loading
    │   └── local_guard.py      middleware: loopback Host and window Origin only
    ├── routers/
    │   ├── system.py           health, version, capabilities
    │   ├── projects.py         .fpth library: list, save with conflict copies, package, import, folder
    │   ├── fonts.py            installed fonts: list, find, file
    │   ├── io.py               writes exports for the window
    │   ├── mcp.py              MCP endpoint, the TOOLS catalogue, the window bridge
    │   ├── batch.py            action library, folder listing, file read and write for batch and data merge
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

- formpath_engine.py
- oc_install
- app/core/config.py
- app/core/local_guard.py
- app/routers/mcp.py
- app/services/llm.py
- app/routers/batch.py
- app/routers/projects.py
- app/routers/fonts.py
- app/services/fonts.py
- app/main.py
- formpath and setup (the launchers)

## formpath_engine.py

### formpath_engine.py · main
- refers-to: formpath_engine.py :: main, selfcheck
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The desktop shell starts this with `FORMPATH_PORT=0`; Uvicorn binds a free loopback port and prints `http://127.0.0.1:[port]`, which the shell reads from stdout. A bundled `frontend_dist` folder is served when present. `--selfcheck` prints the Python and package versions, the formpath version and the MCP tool count as JSON, and is run by `setup/freeze_backend` and CI.

### formpath_engine.py · frozen on Windows with Windows paths
- refers-to: setup/freeze_backend :: root, --add-data, the entry script
- kind: decision
- logged: v0.52.7 · 2026-10-30

formcompiler runs `./formpath desktop build` in Git Bash on Windows. `--add-data` took `$FORMPATH_ROOT/frontend/dist;frontend_dist`, an MSYS path such as `/d/a/formpath/formpath/frontend/dist` joined to its destination by `;` inside one argument, which Git Bash may not convert to a Windows path before it reaches PyInstaller, so the build could fail to find the frontend or freeze an engine without it. On Windows the script now takes `root` from `cygpath -w "$FORMPATH_ROOT"` and uses it for the `--add-data` source and the entry script; macOS and Linux keep `$FORMPATH_ROOT`. The paths stay absolute because `--specpath build/pyinstaller` makes relative ones resolve against the spec folder. There is no `--add-binary`. Found by the family builds audit of 2026-10-30.

### formpath_engine.py · the engine knows the port it listens on
- refers-to: formpath_engine.py :: main; app/core/config.py :: port; app/services/terminal.py :: engine_url, base_env; app/services/claude_code.py :: mcp_config
- kind: fix
- logged: v0.53.1 · 2026-11-10

The desktop shell starts the sidecar with `FORMPATH_PORT=0`, and `config.port()` read that "0" as a real value (a non-empty string, so the `or BACKEND_PORT` fallback never ran), while nothing recorded the port Uvicorn then picked. So in the desktop app Claude Code's `--mcp-config` (the Claude Code tab and every Chat message) named `http://127.0.0.1:0/mcp` and the dock's shells got `FORMPATH_ENGINE_URL`, `FORMPATH_MCP_URL` and `FORMPATH_URL` on port 0: no formpath tools in Claude Code, and `./formpath cli` and the stdio bridge failed inside the dock. When the port is 0, `main` now binds a socket to 127.0.0.1 port 0, reads the free port the system gave it, closes it, writes that port to `FORMPATH_PORT` and passes it to Uvicorn, which still prints the `http://127.0.0.1:<port>` line the shell reads. A set port is used as before. The port is free between the close and Uvicorn's bind for a few milliseconds only; another program taking that exact port in between would make the engine fail to start, as any taken port does. Checked: the engine run with `FORMPATH_PORT=0` printed port 48863, and a dock shell opened through `POST /api/terminal` echoed `FORMPATH_MCP_URL=http://127.0.0.1:48863/mcp`; the backend tests pass. The frozen sidecar and the desktop app were not built here.

### formpath_engine.py · the Windows desktop build freezes the fresh frontend
- refers-to: setup/desktop.bat; setup/freeze_backend.bat :: the frontend\dist check; setup/desktop_build
- kind: fix
- logged: v0.53.1 · 2026-11-10

`setup/desktop.bat` (run by `build_app.bat` and `formpath.bat desktop build`) froze the engine first and rebuilt the frontend after. `freeze_backend.bat` builds the frontend only when `frontend\dist\index.html` is missing, so after any earlier build the sidecar bundled the previous `dist` as its `frontend_dist`; the rebuilt `dist` then reached only Tauri's splash, while the main window is served by the engine from its bundled copy, so the Windows installer showed the old UI. The bash path (`setup/desktop_build`) already builds first. `desktop.bat build` now runs `build_frontend.bat` and then `freeze_backend.bat`; `desktop.bat dev` freezes as before. The icon line now runs before the freeze; `src-tauri\icons\icon.ico` is tracked, so it does nothing in a checkout. CRLF endings kept. Not run on Windows: reasoned from the order of the calls.

## oc_install

### oc_install · Python on Windows and the venv layout
- refers-to: oc_install :: PY, act
- kind: decision
- logged: v0.52.7 · 2026-10-30

formcompiler runs `./formpath install` in Git Bash on its Windows runner, where setup-python provides `python` (and `py`) and `python3` may not exist, so the candidate list tried only python3.14 to python3 and stopped with "Python 3.12 or newer is required". `python` is now the last candidate, the same list as `setup/lib.sh :: fp_python` and formpdf and formtxt; the version check still refuses an older one. The activate script is `venv/bin/activate` on macOS and Linux and `venv/Scripts/activate` on Windows; the script now picks whichever exists and stops with a message when neither does (a half-made venv), instead of a bare `source` error. Found by the family builds audit of 2026-10-30.

### oc_install.bat · stops when the venv cannot be made
- refers-to: oc_install.bat :: venv, activate; setup/install_all.bat
- kind: fix
- logged: v0.53.1 · 2026-11-10

When `%PY% -m venv venv` failed (a Python without venv, a locked folder), the script went on: `call venv\Scripts\activate.bat` failed, `python -m pip` and `pip install` ran against the system Python, `install_all.bat` reported success, and boot later said the venv was missing. The venv step now exits 1 when it fails, and the script stops with a message when `venv\Scripts\activate.bat` is missing (also a half-made venv left by an earlier run), before any pip runs. `install_all.bat` already stops on that exit code. CRLF endings kept. Not run on Windows: reasoned from cmd's `||` and `if not exist` rules.

## app/core/config.py

### app/core/config.py · ports and folders
- refers-to: app/core/config.py :: BACKEND_PORT, data_dir, projects_dir
- kind: rationale
- logged: v0.9.0 · 2026-10-07

8230 so formpath runs beside formvis (8190). Data lives in `~/Formpath` unless `FORMPATH_DATA_DIR` is set; the library folder can be moved (`FORMPATH_LIBRARY_DIR`, or `library.json` written by the app), including into a synced folder.

### app/core/config.py · opened-project sessions live in the data folder
- refers-to: app/core/config.py :: sessions_dir; app/services/sessions.py :: create, prune, asset path
- kind: fix
- logged: v0.53.1 · 2026-11-10

Sessions (the images of an opened project, served to the window) were kept in `<temp>/formpath-sessions`. On Linux that is the shared `/tmp`: a second account on the machine could not open projects (the folder belonged to the first, PermissionError and a 500), the images were readable by every account, and a local user who made `/tmp/formpath-sessions` or a symlink by that name first received every opened project's images. macOS and Windows give each account its own temp folder, so they were not exposed. `sessions_dir` is now `sessions` inside the data folder (`~/Formpath` or `FORMPATH_DATA_DIR`), which belongs to the person like `Chat`, `profiles` and `plugins` beside it; `prune` still removes sessions older than a day, and an old `/tmp/formpath-sessions` is no longer read or cleaned. Checked: `sessions.create` writes under `<data>/sessions/<id>/images`; the backend tests pass; `ruff check` on config.py passes.

## app/core/local_guard.py

### app/core/local_guard.py · only this computer's own window and agents reach the engine
- refers-to: app/core/local_guard.py :: LocalGuard; app/core/config.py :: window_origins; app/main.py :: add_middleware
- kind: decision
- logged: v0.52.2 · 2026-10-25

Family stabilization plan Phase 3a (`FAMILY_DEV_PLAN.md` v0.4.2, formai_dev sidecar; ledger FB-032). The engine checked Host and Origin only inside a few routes (`require_local` and `origin_ok` for the terminals, spell checking and colour profiles, and the two websockets), and nothing for the rest. `curl -H 'Host: evil.example:8230' http://127.0.0.1:8230/api/health` answered 200, so a DNS-rebinding page (a hostile name that resolves to 127.0.0.1) reached every route as if it were the window: the project library and its saves, file import and export, `/mcp` and the MCP bridge (run any drawing tool), the Claude Code chat and the terminals' open route, plugins and the NodeMode routes. CORS decides whether a page may read a response, not whether the request runs. The route-level `origin_ok` also accepts any loopback Origin on any port, which another local web server could use.

LocalGuard is a pure ASGI middleware added in `main.py` after the CORS middleware, so it runs first on every http and websocket request; the route checks stay as a second line. It refuses a Host that is not 127.0.0.1, localhost or ::1. When an Origin header is present it must be one of `config.window_origins()` (the dev window on 5230, the preview on 5231, `tauri://localhost`, `http://tauri.localhost`, plus whatever `FORMPATH_CORS_ORIGINS` lists) or exactly the engine's own origin, compared on parsed scheme, host and port, never by prefix, so `http://localhost.evil.com` and `null` fail. `window_origins()` is new because `cors_origins()` lists only the dev port and the preview window posts from 5231. The desktop window loads from the engine's own `http://127.0.0.1:<port>` with a port picked at launch, so "own origin" is the request's Host and needs no list entry. Requests with no Origin (the CLI, `setup/mcp_stdio.py`, the `.mcp.json` client) pass once the Host is local. HTTP refusals answer 403 with a JSON detail naming formpath; websocket refusals close with 4403 before accept.

Left for the family standard: a per-launch token on routes that write files, run processes or answer consent, and a review of GET routes with side effects, which a cross-site page can still trigger without an Origin.

Checked against the running engine (built window served through `FORMPATH_DIST`): 403 for `Host: evil.example:8230`, `Origin: http://evil.example`, `Origin: http://localhost.evil.com`, `Origin: null` on `/api/health`, and for a rebound-Host `POST /mcp`; 200 for no Origin, `Origin: http://127.0.0.1:8230`, `http://localhost:5230`, `http://localhost:5231` and `tauri://localhost`. `/api/claude/chat/stream`: foreign Origin and rebound Host refused with 403, own origin, dev origin and no Origin open. `setup/mcp_stdio.py` initialize with no Origin answers with serverInfo formpath. Built window in Chromium under 4x CPU and network throttling: no errors, no 403 from the window (the 7 lines of 403 in the log are the probes). Layout shift is 0.0054 with one shift (`SECTION.cv-home-section` at 2.1 s), and the same 0.0054 on the engine as it was before the guard, so the guard did not cause it; it is a Home screen shift that predates this change and is left alone.

### app/core/local_guard.py · refuses cross-site requests that carry no Origin
- refers-to: app/core/local_guard.py :: LocalGuard._permitted
- kind: decision
- logged: v0.52.3 · 2026-10-25

The family agent-stack standard, rule G4 (`AGENT_STACK_STANDARD.md` v0.2.0, owner decision D4, ledger FB-035, formai_dev sidecar). The entry above let a request with no Origin through once its Host was local, so a web page could still make the engine answer a GET by pointing an `<img>` or a link at `http://127.0.0.1:<port>/...`: browsers send no Origin on those, and any GET route with a side effect would run. Proven on formsculpt 1.18.6, where such a GET answered 200 and its side effect ran.

Browsers label every request with `Sec-Fetch-Site`, and only a page on another site gets `cross-site`. So a request with no Origin is now refused when that header says `cross-site` (trimmed, case-insensitive). A request that carries an Origin is still decided by the Origin rule alone, and `same-site` is kept on purpose: a dev window on `localhost:5230` loading straight from `localhost:8230` is same-site, and no outside page can be same-site with localhost. The CLI, `setup/mcp_stdio.py` and Claude Code's MCP client send neither header and pass as before.

Checked against the running engine (built window served through `FORMPATH_DIST`): no Origin with `cross-site` 403 (also ` Cross-Site ` padded); `same-site`, `same-origin`, `none`, no header at all, and `cross-site` with the allowed Origin `http://localhost:5230` 200; `Host: evil.example` and `Origin: http://evil.example` still 403. In Chromium, a page served from `http://127.0.0.2:9902` with an `<img>` and a clicked link pointing at `/api/health` got 403 for both, shown in the engine log. The built window served by the engine in Chromium under 4x CPU and network throttling, two shift runs and one throttle run: layout shift 0.0054 (the Home screen shift recorded above, unchanged), no errors, no 403 line produced by the window. `setup/mcp_stdio.py` initializes (formpath 0.52.2) and lists 93 tools.

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

Paths are checked here, not in the window: absolute, an allowed extension, the file present when reading, the folder present when writing. The window only produces or consumes bytes. Every error says what to do next. A .dwg is now one of those files: it is passed through like a .dxf, and the window decides whether its native reader or the converter route reads it.

### app/routers/mcp.py · add_text description
- refers-to: app/routers/mcp.py :: TOOLS, add_text
- kind: explainer
- logged: v0.9.0 · 2026-10-07

States that type is black unless `color` is given, matching the bridge's default. After changing any entry in `TOOLS`, run `./formpath agents sync`; CI checks it.

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

An audit found that `GET /api/mcp/bridge/next?allowed=1` set the consent flag for any caller (a missing `allowed` counted as yes, and a cross-site image could fire it), and that any local client could pose as the window: take queued calls (including the file bytes `open_file` reads here), answer `__consent__` itself, drain the queue, or post results through `/api/mcp/bridge/result`. The window now opens a session with `POST /api/mcp/bridge/session`, which issues a fresh `secrets.token_urlsafe(32)` only when the request's Origin is formpath's own page: the CORS origins (the Vite dev server on 5230), the Vite preview on 5231, and `http://localhost`, `127.0.0.1` or `[::1]` on the port this server is actually listening on (`request.scope["server"]`, so the desktop sidecar's random port works). It is a POST because browsers send Origin on every POST, while a same-origin GET carries none. Every bridge call is a POST from that Origin with the secret in `X-Formpath-Bridge`; anything else gets 403 and changes nothing, and `GET /api/mcp/bridge/next` answers 405 without touching state. `allowed` now comes from the JSON body and only `true` allows; a missing value means not allowed. A new session supersedes the last: only the newest secret receives queued calls, a window still polling with an older one gets 205 (a success status, so the browser logs no error) and waits for focus before taking the bridge back. Each delivered call remembers which secret took it (`_delivered`), and its result is accepted only from that secret, so a window that is superseded mid-call can still finish it while nobody else can answer for it. `POST /mcp` is unchanged (agents' clients send no Origin, and a foreign Origin is still refused there); the stdio bridge in `setup/mcp_stdio.py` only talks to it. Origin is a browser guarantee: a local program can forge it, but a local program already has the person's files, and the point is that no web page can drive or read the bridge.

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

### app/routers/mcp.py · graph, variables and actions tools
- refers-to: app/routers/mcp.py :: TOOLS graph, variables, actions; setup/agents.py :: GROUPS
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Three tools run in the window like every other: graph (create, update, get, make_design), variables (list, make, bind, unbind, rename, delete, capture, update, import, show, export) and actions (list, play, batch). Their folder arguments are not handled by _run here: the window writes and reads through batch.py, which it may call because it has the app origin. setup/agents.py lists graph and variables under Graphs and data and actions under Commands.

### app/routers/mcp.py · perspective tool
- refers-to: app/routers/mcp.py :: TOOLS perspective; setup/agents.py :: GROUPS
- kind: explainer
- logged: v0.21.0 · 2026-10-10

One tool covers the perspective grid with an action: get, grid (preset or type plus the Define Grid values, show, lock, snap, active_plane), draw (a shape in plane coordinates), place, attach, move, scale, release and match_plane. Agents say horizontal for the ground plane, as Illustrator's menus do; the engine calls it floor. Plane coordinates are explained in the description because an agent cannot see the grid's local frames; get reports each plane's extent in them. It runs in the window and needs nothing from _run. setup/agents.py lists it under Drawing.

### app/routers/mcp.py · EPS, DXF, DWG and the generative tools
- refers-to: app/routers/mcp.py :: _OPENABLE, _PLACEABLE, _EXPORTS, _run, open_file, export_file, place_image, generative_shape_fill, generate_patterns, retype; setup/agents.py :: GROUPS
- kind: explainer
- logged: v0.23.0 · 2026-10-10

.eps, .epsf, .ps and .dxf open; .eps and .dxf place; .eps and .dxf export (the window builds the bytes, _write writes them). A .dwg path is answered in _run before the extension check with the sentence that DWG is not read and to save a DXF, rather than the generic list of extensions. The new parameters on open_file, place_image and export_file are optional with defaults, so older calls are unchanged. generative_shape_fill, generate_patterns and retype run in the window, which calls /api/llm/generate on the person's configured model; they are marked openWorld because that model may be a remote service the person chose. setup/agents.py lists retype under Type and the other two under a new Generative group.

## app/services/llm.py

### app/services/llm.py · generate and the vision flag
- refers-to: app/services/llm.py :: generate, save, status; app/routers/llm.py :: generate, settings
- kind: rationale
- logged: v0.23.0 · 2026-10-10

`generate` is one chat completion with an optional system message and, when the person marked the model as reading images (`vision` in llm.json, the Preferences checkbox The model reads images), an image as an OpenAI-style image_url content part with a data URL. It goes to the same base URL, model and key as the Assistant through `_call`, so no other service is ever contacted, and an unset model gives the same 428 sentence. Without the vision flag an image request is refused before anything is sent, because many local models reject image parts with an unhelpful error. Temperature and max_tokens are clamped; the answer text is capped at 400 KB. The route takes JSON and returns {text, model}.

## app/routers/batch.py

### app/routers/batch.py · library and folder access for the window
- refers-to: app/routers/batch.py :: actions_list, actions_save, actions_delete, files_list, files_read, files_write, _folder, READABLE, WRITABLE
- kind: rationale
- logged: v0.20.0 · 2026-10-10

Action sets are .fpaction JSON files in the data folder's Actions directory, one per set named after it (no slashes or control characters, 16 MiB cap). Batch and data merge need to list a folder, read the files in it and write results to another; those endpoints read and write any absolute path, so every one is a POST that refuses requests without formpath's own Origin (mcp._app_origin, the same check that guards the agent bridge): a web page cannot call them, and a page that sends no Origin is refused too. Reads are limited to the formats formpath opens plus CSV, TSV, text, JSON, XML and .fpaction; writes to the formats it exports plus text, CSV, JSON, .fpaction and zip, with the file name reduced to a plain name and the destination folder created when missing. 512 MiB caps both directions.

### app/routers/batch.py · stat, read headers and folders for linked images
- refers-to: app/routers/batch.py :: files_stat, files_read, files_list; app/services/project_format.py :: _walk; app/routers/mcp.py :: place_image, links, _run
- kind: rationale
- logged: v0.22.0 · 2026-10-10

Linked images need the size and modified time of their files: files_stat answers up to 2000 paths in one POST (missing or non-file paths answer exists false, never an error) so the window can poll every few seconds cheaply, and files_read now sends X-Formpath-Size, X-Formpath-Mtime and X-Formpath-Path with the bytes so the values match the pixels read. The name and path headers are percent-encoded because response headers are Latin-1 and a file name may not be. files_list takes dirs true to also return the subfolder names and the parent folder, for the window's file chooser; without it the answer is as before. The same Origin rule guards all three. The project validator accepts an image node whose asset is absent when it carries linked (the person chose not to keep previews of linked images). place_image with link true hands the window the path instead of the bytes, and the links tool runs in the window, which reads files through these endpoints.

## app/routers/projects.py

### app/routers/projects.py · save conflicts
- refers-to: app/routers/projects.py :: save
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Saving compares the version the window opened with the file's current version; if another device or window changed it, the incoming save is written beside it as a conflict copy and both are kept.

### app/routers/projects.py · moving the library is all or nothing
- refers-to: app/routers/projects.py :: set_folder
- kind: fix
- logged: v0.53.1 · 2026-11-10

`PUT /api/projects/folder` with `move` copied and deleted one project at a time and wrote `library.json` only after the loop. When a copy failed half-way (disk full, permission, a short copy), the projects already moved were gone from the old folder while the library still pointed there, so they disappeared from the app; an `OSError` from `copy2` was an unhandled 500. A name taken twice (`X.fpth` and `X (moved).fpth` both in the new folder) made `copy2` overwrite the earlier `X (moved).fpth`. Now every project is copied first; on any failure the copies made so far are removed, nothing is deleted, `library.json` is left as it was, and the answer is a 400 naming the file and the reason. Only after every copy succeeded are the originals deleted (one that cannot be deleted stays in both folders). A taken name tries `X (moved)`, then `X (moved 2)`, `X (moved 3)` and so on. Checked in a scratch run with `copy2` failing on the second of three projects: 400 "B.fpth could not be moved (No space left on device); nothing was moved.", all three still in the old folder, the new folder as before and the library still on the old folder; then a clean move moved 3, with `A.fpth` landing as `A (moved 2).fpth` and the existing `A (moved).fpth` untouched. The backend tests pass. `library.json` is still written in place, not through a temp file.

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

## app/services/terminal.py

### app/services/terminal.py · engine PTYs
- refers-to: app/services/terminal.py :: Session, open_session, restart, write, resize, close, base_env, bind, call_in_loop
- kind: explainer
- logged: v0.24.0 · 2026-10-15

The terminal dock's shells are engine-owned PTYs, as formlit and formvis keep them: `ptyprocess` on macOS and Linux, `pywinpty` on Windows. A session holds its argv, environment and kind (`shell` or `claude`), a 256 KB scrollback ring and a set of subscriber queues; a reader thread per process pushes output to the queues through the event loop bound at startup (`main.lifespan` calls `bind`), so a WebSocket that attaches later gets the scrollback and then the live text. `restart` bumps a generation number so the old reader thread stops delivering, clears the scrollback and sends `ESC c` so xterm resets. The shell starts in the repository when the engine runs from a checkout (so `./formpath cli` and `formpath claude` work inside it) and in the home folder in the frozen desktop build. `base_env` sets `FORMPATH_TERMINAL`, `FORMPATH_ENGINE_URL`, `FORMPATH_MCP_URL` and `FORMPATH_URL`, and puts the repository on `PATH` outside the frozen build.

## app/routers/terminal.py

### app/routers/terminal.py · local only
- refers-to: app/routers/terminal.py :: origin_ok, require_local, attach
- kind: warning-context
- logged: v0.24.0 · 2026-10-15

A terminal is a shell on this computer, so every route and the WebSocket refuse a request whose Host is not a loopback name (a page that rebinds its domain to 127.0.0.1 still sends its own Host) and whose Origin is neither a configured CORS origin nor a loopback or `tauri://` origin. WebSockets are not covered by CORS, which is why the check is explicit. Output frames are text; the only control message (`exit`) is a binary frame, so shell output can never be read as one. `terminal_text` strips ANSI codes for `read`, which the CLI and agents use.

## app/services/claude_code.py

### app/services/claude_code.py · Claude Code in the window
- refers-to: app/services/claude_code.py :: cli, info, argv, open_tab, mcp_config, INAPP_TOKEN, chat_send, _run, chat_sessions, chat_adopt
- kind: explainer
- logged: v0.24.0 · 2026-10-15

Follows formlit's design. The Claude Code button runs the person's own `claude` (Preferences path, `FORMPATH_CLAUDE_BIN`, `PATH`, the usual install folders, then a login shell's `command -v`) in a PTY tab of kind `claude`, started through the login shell so the person's `PATH` and Node are found, with `--mcp-config` naming formpath's `/mcp` over HTTP plus the `x-formpath-inapp` header, `--allowedTools mcp__formpath` and a note appended to the system prompt. The token is minted per engine start and never written to disk, so only programs the engine starts carry it. The Chat tab runs `claude -p ... --output-format stream-json --include-partial-messages` per message, resuming the same session id, and publishes start, delta, tool, toolDone, usage, done, reset and adopted events to the chat WebSocket; tool result pictures are saved under the data folder's `Chat` and served by name only. Sign-in stays Claude Code's own: nothing here reads or stores a credential. `chat_sessions` reads Claude Code's own transcripts for the agent folder so a conversation started in a tab can be continued in Chat, and Open in Claude Code resumes a Chat conversation in a tab.

### app/services/claude_code.py · the person's text comes after `--`
- refers-to: app/services/claude_code.py :: argv, _chat_argv
- kind: fix
- logged: v0.53.1 · 2026-11-10

The Chat message and the tab's first message were positional arguments among the options (`-p <text> --output-format ...`, and the prompt appended after `--resume`), so a message starting with "-", such as a Markdown bullet `- make the circle red` or `--help me align these`, was read by Claude Code as an option: "unknown option" and the Chat answered "Claude Code stopped before answering". Both builders now put every option first and pass the text after `--`, the end-of-options marker. Checked against the installed Claude Code 2.1.322 with no sign-in: `-p --output-format text --help-me` fails with "unknown option '--help-me'", while `-p --output-format text -- --help-me` and the full Chat argument list ending in `-- '- red circle'` both get past parsing to "Not logged in"; `_chat_argv` ends in `--resume S1 -- '- red circle'`; the backend tests pass.

### app/services/claude_code.py · the transcripts folder for non-ASCII paths
- refers-to: app/services/claude_code.py :: _project_dir, chat_sessions, chat_adopt
- kind: fix
- logged: v0.53.1 · 2026-11-10

Claude Code names a project's transcript folder by turning every character outside ASCII letters and digits into "-", but `_project_dir` used `str.isalnum()`, which keeps é, ü and other letters. For an agent folder under a home such as `/Users/josé`, Chat looked in a folder that does not exist: no conversations to continue, and adopting one failed with "No Claude Code conversation was found". The test is now ASCII letters and digits only. Checked: the installed Claude Code 2.1.322 run in a folder named `josé_ü` reports its project folder as `...-jos---`, and `_project_dir` now gives the same name; the backend tests pass. Not checked: Claude Code's handling of very long paths.

### app/routers/mcp.py · in-app token
- refers-to: app/routers/mcp.py :: _inapp, _call, _ask, bridge_next (eligible)
- kind: rationale
- logged: v0.24.0 · 2026-10-15

A `tools/call` carrying the engine's in-app token sets the `_inapp` context variable, which skips the outside-agent consent question in `_call` and marks the queued item `inapp` so the window's long poll delivers it even while outside agents are not allowed. Every other client still meets the question and the window session secret. The window must still be open: the token removes the question, not the window.

### app/routers/mcp.py · a call that timed out leaves the queue
- refers-to: app/routers/mcp.py :: _ask, _put, _pending, bridge_next
- kind: fix
- logged: v0.53.1 · 2026-11-10

`_ask` queued the call for the window and, when the wait ran out (600 s for a tool, 180 s for `__consent__`), told the agent it failed but left the item in `_pending`; its `finally` cleared only `_waiting` and `_delivered`. Trigger: an agent calls a tool while the window was live in the last 30 s, then the window closes or stops polling before it takes the call. The next window to open, minutes or hours later, received and ran it: a stale draw, delete or `__open` changed the person's current document, or a stale consent question appeared. `_ask` now keeps the queued dict and removes it from `_pending` in the `finally` (a `ValueError` means the window already took it). Checked: `_ask("x", {}, 0.05)` with no window returns None and leaves `_pending` and `_waiting` empty; the backend tests pass. Left as it was: `bridge_next` puts a taken item back at the front when the window disconnects between taking and answering; if the call's wait ends in that same moment, the item could still stay queued.

### app/routers/mcp.py · a window that never polled is not live on a machine that has just started
- refers-to: app/routers/mcp.py :: _live, _open_window, _seen, _opened_at
- kind: fix
- logged: v0.53.2 · 2026-11-11

`_seen` and `_opened_at` start at 0.0 and were compared with `time.monotonic()` as if 0.0 were long ago. On Linux, macOS and Windows that clock counts from when the machine started, so for the first 30 s after a start `_live()` answered true with no window ever seen, and for the first 60 s `_open_window()` answered false as if a window had just been opened. An agent call in that half minute did not get "formpath is not open": it was queued for consent and waited 180 s for a window that was not there, and nothing opened the window for it. This is what failed CI on the merge of pull request 5: the runner had been up for under 30 s when `tests/test_f2_consent.py::test_with_no_window_every_tool_is_refused_and_nothing_is_queued` ran, the call waited for consent and the test's 40 s limit ended it with TimeoutError. The same tree had passed minutes earlier on a runner that had been up longer; the code is as old as 0.1.0. Both checks now treat 0.0 as never: `_live()` needs `_seen > 0` and `_open_window()` only holds back when `_opened_at > 0`. Reproduced with a scratch pytest plugin outside the repo that makes `time.monotonic()` read 3 s at the start of the run: before, that one test failed with TimeoutError after 40 s, as in CI; after, 108 passed, also with the clock starting at 29 s so that it crosses 30 s during the run.

## app/routers/commands.py

### app/routers/commands.py · the catalogue over HTTP
- refers-to: app/routers/commands.py :: mirror, listing, describe, run, _catalogue
- kind: explainer
- logged: v0.25.0 · 2026-10-15

The window mirrors its command catalogue here (`POST /api/commands/catalogue`) and the engine keeps it in memory and in the data folder's `commands-catalogue.json`, so `GET /api/commands?group=&text=` and `GET /api/commands/{id}` (with close-match suggestions on a miss) answer even when the window was opened in an earlier run. `POST /api/commands/{id}` takes the parameters as the JSON body and runs the command through the MCP router's `_call("run_command")`, which means the window must be open and the outside-agent question applies, exactly as for MCP clients; a request carrying the in-app token (the terminal dock's shells have it in `FORMPATH_INAPP_TOKEN`, which `setup/cli.py` sends) skips the question. All routes are local only.

### app/services/terminal.py · the dock's shells carry the in-app token
- refers-to: app/services/terminal.py :: base_env
- kind: rationale
- logged: v0.25.0 · 2026-10-15

A shell in the dock is the person's own terminal inside the window they are using, so `./formpath cli run ...` typed there should not ask them whether an outside agent may act. The token is per engine start and lives only in the environment of programs the engine starts.

## app/services/spell.py

### app/services/spell.py · spell check and personal dictionary

- refers-to: app/services/spell.py :: check, dictionary, edit_dictionary; app/routers/spell.py
- kind: explainer
- logged: v0.29.0 · 2026-10-15

`POST /api/spell/check` takes words and a language and returns only the unknown ones, each with up to 6 suggestions ranked by word frequency, on pyspellchecker (MIT) word lists; languages without a list fall back to English. The personal dictionary is `spell-dictionary.json` in the data folder, edited with `POST /api/spell/dictionary` (add and remove lists) and read with the matching GET. Every route requires a loopback origin and host like the terminal routes.

### app/services/fonts.py · similar

- refers-to: app/services/fonts.py :: similar, _measure; app/routers/fonts.py :: similar
- kind: explainer
- logged: v0.29.0 · 2026-10-15

`GET /api/fonts/similar?id=` scores every other installed family against a font from tables read directly with struct: weight and width class, OS/2 family class and PANOSE serif style, italic flag and post italic angle, x-height and cap-height over the em, and average advance. The best style of each family is kept and the ten nearest return with a 0 to 100 score. Glyph outlines are not parsed, so the serif test rests on PANOSE and the family class.

## app/services/package.py

### app/services/package.py · Package
- refers-to: app/services/package.py :: build; app/routers/projects.py :: package_full
- kind: explainer
- logged: v0.30.0 · 2026-10-15

`POST /api/projects/package-full` writes `<name> Folder` holding the .fpth, a `Links` folder of every linked image copied from its path, a `Fonts` folder of the installed font files the fonts service finds for the families used, and `<name> report.txt` (Document Info as text, built by the frontend). With `relink_copies` the manifest's `linked.path` values are rewritten to the copies. With `as_zip` it returns a zip instead of touching the disk. The route reads arbitrary paths, so it requires a loopback client and Host. Only image-like extensions under 1 GiB are copied; anything missing is listed in the reply, never fatal. An existing destination folder is refused rather than merged.

## app/services/package.py

### app/services/package.py · bundled fonts uploaded by the frontend
- refers-to: app/services/package.py :: resolve_fonts, build; app/routers/projects.py :: package_full
- kind: rationale
- logged: v0.31.0 · 2026-10-15

A bundled family such as JetBrains Mono has no installed file, so `resolve_fonts` found nothing and the Fonts folder was never written. `package-full` now accepts `font_files` (at most 32 uploads, 64 MiB each) and a `font_map` JSON of file name to "Family|Style"; the fonts service still wins, and an uploaded face is copied into Fonts only for a family it cannot find. The name must pass `safe_name`.

## app/routers/mcp.py

### app/routers/mcp.py · text_to_vector and generative_recolor
- refers-to: app/routers/mcp.py :: TOOLS
- kind: explainer
- logged: v0.31.0 · 2026-10-15

Two tools join the Generative group beside generative_shape_fill. Both run in the window through the bridge, call the language model set for the Assistant through the existing llm generate route, and refuse with a clear message when no model is set or Show generative features is off.

### app/routers/mcp.py · export_file live_text
- refers-to: app/routers/mcp.py :: TOOLS export_file
- kind: explainer
- logged: v0.32.0 · 2026-10-15

export_file takes live_text (default true) for PDF. The parameter rides in the existing rest of the arguments to the bridge, which passes it to exportPdf as liveText. It is an addition beside outline_text, so no existing name changed.

## app/services/subset.py

### app/services/subset.py · font subsets for PDF live text
- refers-to: app/services/subset.py :: build; app/routers/fonts.py :: subset_font; setup/freeze_backend :: --collect-submodules fontTools
- kind: rationale
- logged: v0.32.0 · 2026-10-15

POST /api/fonts/subset takes gids (JSON list), optional axes (JSON tag to number) and either font_id of an installed font or the font file itself (bundled Inter and JetBrains Mono live in the frontend, and a WOFF is read as is). It keeps glyph ids (retain_gids) so the PDF can use Identity for CIDToGIDMap and CID equals gid, drops layout tables, and writes plain sfnt. A variable font is fixed at the requested axis values with fontTools.varLib.instancer, every axis pinned (unlisted ones at their default), because a PDF cannot carry variations; any failure, and CFF2 outlines, answer 422 with what to do and the frontend then outlines that text. The reply header X-Font-Outlines says truetype or cff so the frontend picks FontFile2 or FontFile3. Like package-full the route requires a loopback client and Host, since font_id reads a file from this computer. fontTools is imported lazily for the instancer, which PyInstaller cannot see, so the freeze scripts use --collect-submodules fontTools; fonttools 4.67.0 (MIT) is pinned in requirements.txt and requirements_macos.txt and listed in NOTICE.md.

## app/services/color.py

### app/services/color.py · profile listing, ids and the generated CMYK profile
- refers-to: app/services/color.py :: listing, generic_cmyk_bytes, build_generic_cmyk, srgb_bytes; app/routers/color.py
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Pillow 12.3.0 (LittleCMS 2) is a new dependency, pinned in requirements.txt and requirements_macos.txt and listed in NOTICE.md; it is imported lazily so the engine still starts without it and the routes answer with what to run. Profile ids are the sha1 of the bytes. lcms writes the creation time into its built-in sRGB, so its bytes (and id) changed every second; both built-ins are therefore cached under `profiles/.builtin/` on first use and the folder scan skips dot folders. formpath Generic CMYK is written in Python with struct: an ICC v2 output profile (prtr, CMYK, Lab PCS) with A2B0 to A2B2 sharing one 11 point lut16 and B2A0 to B2A2 sharing one 17 point lut16. The forward model is a Neugebauer model with Yule-Nielsen n 2.0 over 16 primaries given as Lab values of a generic coated press, dot gain of 15 percent (17 for black) at 50 percent, relative to its own paper, with the paper as the media white point. The separation table solves Lab to CMYK per node by Gauss-Newton on CMY with black fixed from lightness and chroma (a medium GCR), then limits total ink to 300 percent. It takes about 2 seconds to build once. It is a generic model, not a characterisation of FOGRA, SWOP or any press, and its copyright tag says so.

### app/routers/color.py · loopback only, table layouts
- refers-to: app/routers/color.py :: lut_rgb_to_cmyk, lut_cmyk_to_rgb, lut_proof; app/services/color.py :: rgb_to_cmyk, cmyk_to_rgb, proof
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Every route uses origin_ok from terminal.py because uploads write to the data folder and the listing reads system folders. The table routes are POST with JSON and return raw bytes: RGB to CMYK is grid^3 by 4 (red slowest, blue fastest, 17 points), CMYK to RGB is grid^4 by 3 (cyan slowest, black fastest, 9 or 11 points), proof is grid^3 by 3 (17 or 33). Proof uses buildProofTransform with the document intent into the device and relative colorimetric (absolute with Simulate Paper Color) into sRGB; Simulate Black Ink drops black point compensation. The monitor is the built-in sRGB until the display profile is read. Transforms are cached by profile ids, intent and flags; the transform cache and the lock are reentrant because building a transform reads profile bytes through the same listing.

### app/services/dwg.py · DWG through an installed converter
- refers-to: app/services/dwg.py :: converters, to_dxf; app/routers/io.py :: dwg_to_dxf
- kind: rationale
- logged: v0.32.0 · 2026-10-15

DWG is read by converting it to DXF with a program already on the computer, then through the existing DXF reader, bc no DWG library is under a licence formpath can ship (LibreDWG is GPL 3, the ODA SDK is commercial), and running either as a separate program keeps formpath Apache 2.0. The ODA File Converter is tried first (free, reads every DWG release, found on PATH, at FORMPATH_ODA_CONVERTER or at its default install folder per OS), then LibreDWG's dwg2dxf. Qt's offscreen platform is set on Linux without a display bc the ODA converter is a Qt program. Without a converter the call answers 422 with where to get one. Since v0.35.0 the window reads DWG itself (frontend src/io/dwg.ts) and only calls this route for a version the native reader does not cover (R2007 and older); the MCP open_file and place_image tools no longer convert in the engine, they hand the window the .dwg bytes like any other file and the window falls back to this route.


## app/services/display.py

### app/services/display.py · finding the display profile
- refers-to: app/services/display.py :: detect, _colord, _xatom, _mac, _windows; app/services/color.py :: display_profile, _monitor, preserve; app/routers/color.py :: display_profile
- kind: rationale
- logged: v0.34.0 · 2026-10-15

Order: FORMPATH_DISPLAY_PROFILE (a path, for people whose desktop does not report one), then the platform. Windows asks GetICMProfileW for the primary display through ctypes. macOS asks CoreGraphics for the main display's colour space and its ICC data (ColorSync). Linux asks colord first (`colormgr get-devices-by-kind display`, then the first device's profile file) and falls back to the `_ICC_PROFILE` X11 root atom through xprop. All of them are wrapped, return None on any failure, and the answer is cached for 30 s because the route is hit when proofing starts. GET /api/color/display-profile returns `{"profile": null}` when nothing was found and the proof then uses the built-in sRGB monitor. Verified here: the env path, and the colord and X11 parsers against stand-in colormgr and xprop scripts; no real colord, ColorSync or Windows display was available, so the macOS and Windows paths and the real colormgr output format are untested.

### app/services/color.py · the preserve table
- refers-to: app/services/color.py :: preserve; app/routers/color.py :: lut_preserve
- kind: rationale
- logged: v0.34.0 · 2026-10-15

POST /api/color/lut/preserve returns a CMYK grid (grid^4 by 3, cyan slowest) of working-RGB pre-images: one transform takes the device CMYK to the monitor with the proof intent, a second takes the monitor back to the working RGB with the same intent and black point compensation. The browser draws CMYK colours through it so that the proof pass, which goes the other way, lands near the raw CMYK-to-monitor colour. It is limited to the working RGB gamut (values clip at 0 and 255).

### app/services/color.py · no real CMYK press profile is bundled
- refers-to: app/services/color.py :: generic_cmyk_bytes, listing; app/routers/color.py :: upload_profile
- kind: rationale
- logged: v0.37.0 · 2026-10-16

Decision: formpath still ships only the built-in sRGB and the synthetic formpath Generic CMYK; no press profile (FOGRA, SWOP, GRACoL, Japan Color, PSO) is added to the tree. What was checked: pip has no package carrying ICC press profiles under any name tried (icc-profiles, iccprofiles, icc_profiles, colour-icc-profiles and similar all return no distribution); on npm the transicc package (MIT code, 1.2.1) bundles 27 CMYK profiles and the imprint-pdf print package (Apache 2.0) carries none. The licence of the code does not cover the profiles inside transicc. The Adobe ones (SWOP v2 and 2006, FOGRA27, 28, 29 and 39, GRACoL 2006, the Japan Color set) carry only the line Copyright Adobe Systems and one of them points to Adobe's EULA, which restricts redistribution, so they are out. The ECI ones from 2008 on (PSO Coated v3 style NPscreen, PSO Uncoated, LWC, MFC, SNP) carry the text: made available by ECI with permission of Heidelberger Druckmaschinen AG, may be used, embedded, exchanged and shared without restriction, may not be altered or sold without written permission of ECI. That is a real grant of redistribution, but the no-sale and no-alteration conditions are field of use limits that Apache 2.0 does not let formpath pass on (anyone may sell an Apache licensed build), and the older ISO Coated v2 and Uncoated Yellowish files carry only a Heidelberger copyright line with no grant at all, so no profile is clearly under terms compatible with Apache 2.0 and none is bundled. Ghostscript's default_cmyk.icc is AGPL and stays out. People who need a press condition load the file with Edit > Color Settings > Load Profile (the engine stores it under the data folder, ECI offers the ISO Coated and PSO profiles at eci.org for free download). The verification here used FOGRA39L Coated, already loaded in this machine's data folder, and nothing from it was copied into the repo. If ECI publishes the profiles under a licence without the sale and alteration clauses, or the project accepts third party assets under their own terms listed in NOTICE.md, bundling PSO Coated NPscreen (1.8 MB) is the first candidate; the listing, upload and LUT code need no change for it.

### app/routers/mcp.py · export_file writes .dwg
- refers-to: app/routers/mcp.py :: TOOLS, export_file; frontend/src/automation/agent-bridge.ts :: export_file
- kind: decision
- logged: v0.38.0 · 2026-10-16

export_file accepts a .dwg path next to .dxf: the extension list, the description and the dxf_version text now say that .dwg is written as AutoCAD 2000 and that R12 is refused for it. The writing itself happens in the window (frontend/src/io/dwg-write.ts), so the engine only passes the format through; `./formpath agents sync` regenerated the tool reference and the .agents mirror. The DWG writer was built clean room: spec as remembered, byte-level study of samples, LibreDWG only as a black box (dwgread and dwg2dxf output), no GPL code read or copied.

### app/routers/mcp.py · gradient method in set_paint

- refers-to: app/routers/mcp.py :: _COLOR; frontend/src/engine/paint.ts :: paintFromInput
- kind: decision
- logged: v0.43.0 · 2026-10-16

The shared colour description for set_paint and the other paint parameters now documents `method: classic|perceptual` on a linear or radial gradient. It is a description change only (no new parameter on the schema level, the paint is a free object), and ./formpath agents sync regenerated the tool reference.

### app/services/rgb_profiles.py · built-in Adobe RGB (1998) compatible and Display P3
- refers-to: app/services/rgb_profiles.py :: build, SPACES; app/services/color.py :: _entries, profile_bytes
- kind: decision
- logged: v0.47.0 · 2026-10-16

formpath writes both RGB working spaces itself as ICC v2.4 matrix/TRC profiles from the published primaries (Adobe RGB: 0.64/0.33, 0.21/0.71, 0.15/0.06, D65, gamma 563/256; Display P3: 0.680/0.320, 0.265/0.690, 0.150/0.060, D65, sRGB curve as a 1024 point table). The colorants are the D65 matrix Bradford-adapted to the D50 PCS and a chad tag records the adaptation; no vendor file is copied. They are named "Adobe RGB (1998) compatible" and "Display P3", listed as builtin, and found by name in profile_bytes. Checked with PIL.ImageCms as a black box: both parse, colorants match the known D50 values (Adobe R 0.6097 0.3111 0.0195, P3 R 0.5151 0.2412 -0.0011) and white, mid grey and primaries convert to sRGB as expected.

### app/services/color.py · lists and serves the new RGB profiles
- refers-to: app/services/color.py :: _entries, profile_bytes
- kind: decision
- logged: v0.47.0 · 2026-10-16

_entries adds the two profiles after the generic CMYK so the first builtin RGB stays sRGB, which the frontend default lookup relies on; profile_bytes serves them by name.

### app/routers/mcp.py · psd_edit on export_file
- refers-to: app/routers/mcp.py :: export_file
- kind: decision
- logged: v0.44.0 · 2026-10-16

The bridge already read `psd_edit` (default true) after the editable PSD writer landed, but the catalogue did not declare it, so agents could not discover it. export_file now declares `psd_edit` beside `psd_layers`, and its description says what a .psd holds with and without it: Photoshop groups, editable type layers and shape layers, or one pixel layer per top-level layer. ./formpath agents sync regenerated the tool reference.

## app/main.py

### app/main.py · .js, .mjs and .css keep their types on Windows
- refers-to: app/main.py :: the three mimetypes.add_type calls after the last import
- kind: rationale
- logged: v0.52.8 · 2026-10-31

Python's `mimetypes` takes file types from the Windows registry (`HKEY_CLASSES_ROOT\.js`, value `Content Type`) over its own table, and some installers and editors set `.js` to `text/plain`. On those PCs the engine served the built window's scripts as `text/plain`, WebView2 refused every module script under strict MIME checking, and the desktop window stayed blank; macOS, Linux, dev mode (Vite serves the page) and Windows PCs with the default value never showed it. The three calls pin `.js` and `.mjs` to `text/javascript` and `.css` to `text/css`, which covers `StaticFiles`, `FileResponse` and any direct `guess_type`. They sit after the last import, not above the imports: a module that re-reads the registry while importing cannot undo them, and no import follows a statement (E402). They look redundant off Windows; keep them. Repro on a Windows PC: `reg add "HKCU\Software\Classes\.js" /v "Content Type" /d "text/plain" /f`, then launch the rebuilt app; restore with `/d "text/javascript"`. Checked here: with the table poisoned to `text/plain` for js, mjs and css through `mimetypes.init(files=...)`, the three calls return `text/javascript`, `text/javascript` and `text/css`; `py_compile` passes. Not yet run on a Windows PC.

## formpath and setup (the launchers)

### formpath · mcp, cli and i18n run a Python that is new enough
- refers-to: formpath :: the mcp, cli and i18n case; setup/lib.sh :: fp_python; setup/mcp_stdio.py, setup/cli.py, setup/i18n.py
- kind: fix
- logged: v0.53.1 · 2026-11-10

`./formpath mcp`, `cli` and `i18n` ran a bare `python3`, skipping the version check the other launchers make through `fp_python`. The three scripts use `X | None` annotations, which Python 3.9 evaluates at definition time and rejects with `TypeError: unsupported operand type(s) for |`, so an MCP client started from the macOS GUI (minimal `PATH`, where `/usr/bin/python3` is 3.9) saw the formpath server die at once; in Git Bash on Windows, where only `python` may exist, the command was not found. The three arms are now one: source `setup/lib.sh`, take `fp_python` (3.12 or newer, `python` last) and stop with "Python 3.12 or newer is required" on stderr when there is none, then exec the script with it. Where only an old Python is on `PATH` the command still cannot run, but it now says why instead of a traceback. Checked: `bash -n formpath`; `./formpath i18n check` exits 0, `./formpath cli` prints its usage, and `./formpath mcp` starts the bridge, which found no engine and started one, on this machine (Python 3.13). Not run on macOS or in Git Bash.

### setup/python.bat · returns Python's exit code
- refers-to: setup/python.bat; formpath.bat :: mcp, i18n, cli, claude, agents
- kind: fix
- logged: v0.53.1 · 2026-11-10

`( "%PY%" %* & exit /b %ERRORLEVEL% )` has `%ERRORLEVEL%` expanded when cmd parses the line, before Python runs, so the script returned the errorlevel from before (normally 0) and `formpath.bat agents sync --check`, `i18n check` and a failed `cli run` reported success. The same held for the `py -3` line. Both now end in a bare `exit /b`, which keeps the errorlevel current when it runs; the last two lines were already correct. CRLF endings kept. Not run on Windows: reasoned from cmd's parsing rules (percent expansion happens once per parsed line or block; `exit /b` without a number keeps the current errorlevel).

### setup/mcp_stdio.py · a slow answer is not a dead engine
- refers-to: setup/mcp_stdio.py :: forward, start_engine; app/routers/mcp.py :: _call, _ask
- kind: fix
- logged: v0.53.1 · 2026-11-10

`forward` waited 660 s for the engine, but one `tools/call` can take up to 845 s there (20 s for a live window, 45 s for a new one, 180 s for consent, 600 s for the tool). The read timeout is a `TimeoutError`, an `OSError`, so it fell into the "the engine is not answering" branch: the bridge started `./formpath serve` beside the running engine, `/api/version` answered 200 from the old one, and the same JSON-RPC request was posted again, so a draw or delete ran twice. A timeout (raised directly, or as the reason of a `URLError`) now answers the call once with "formpath did not answer in time" and never restarts or reposts; the wait is 900 s, above the engine's own longest. Checked: against a stub that takes 3 s, with the wait cut to 1 s for the check, the bridge answered the JSON-RPC error with the request's id and the stub saw one POST.

### setup/clean.bat · --all removes the venv on its own
- refers-to: setup/clean.bat :: --all
- kind: fix
- logged: v0.53.1 · 2026-11-10

The `--all` line was `( if exist frontend\node_modules rmdir ... & if exist backend\venv rmdir ... )`. In cmd, everything after an `if` condition on the same line, `&` included, is the `if`'s command, so the venv was removed only when `frontend\node_modules` existed, and `formpath.bat clean --all` left `backend\venv` in place once node_modules was gone. The two removals are now separate lines inside the block. CRLF endings kept. Not run on Windows: reasoned from cmd's parsing of `if` with `&`.

### setup/check, counts, doctor and formpath agents · the Windows venv layout
- refers-to: setup/check :: py; setup/counts :: py; setup/doctor :: vpy; formpath :: agents; setup/lib.sh :: fp_venv
- kind: fix
- logged: v0.53.1 · 2026-11-10

These four looked only at `backend/venv/bin/python`. In Git Bash on Windows the venv's interpreter is `backend/venv/Scripts/python.exe`, so `./formpath check` (engine self-check, harness sync check), `counts` and `agents` fell back to the system Python and failed to import fastapi although the venv was installed, and `doctor` skipped its keyring check. Each now tries `Scripts/python.exe` when `bin/python` is not there, the same two layouts `fp_venv` already accepts; the fallbacks after it are unchanged. Checked: `bash -n` on the four files; `./formpath doctor` runs as before on Linux. Not run in Git Bash on Windows.

### setup/agents.py and setup/command_counts.py · read FORMPATH_DATA_DIR
- refers-to: setup/agents.py :: commands_reference; setup/command_counts.py :: load; app/core/config.py :: data_dir
- kind: fix
- logged: v0.53.1 · 2026-11-10

Both read the stored command catalogue from `FORMPATH_DATA`, a name nothing else sets, while the engine writes it to `FORMPATH_DATA_DIR` (or `~/Formpath`). With `FORMPATH_DATA_DIR` set, `./formpath agents sync` built the harness skill's `references/commands.md` from a stale or missing `~/Formpath/commands-catalogue.json`, and `counts --commands` fell back to the wrong file when the engine was not answering. Both now read `FORMPATH_DATA_DIR`, an empty value counting as unset and `~` expanded, as `config.data_dir` does. Checked: with `FORMPATH_DATA_DIR` pointing at a scratch catalogue, `commands_reference` rendered it and `command_counts.load` (engine port unreachable) returned its one command.

### build_app · the macOS bundle is named from productName
- refers-to: build_app :: product, app, the disk image stage, the install to Applications; src-tauri/tauri.conf.json :: productName
- kind: fix
- logged: v0.53.1 · 2026-11-10

Tauri names the macOS bundle after `productName`, which is "FormPath" since 0.52.9, but `build_app` still looked for `bundle/macos/formpath.app`. On a case-sensitive volume a full build ended in "the build finished but .../formpath.app is missing" and exit 1; on the usual case-insensitive volume it worked but put the app in the disk image and in Applications as `formpath.app`. The script now reads `productName` from `tauri.conf.json`, as it reads `version`, and uses `$product.app` for the bundle, the disk image stage and the installed copy. Left as they were: `pgrep -x formpath` and `tell application "formpath" to quit`, because the running process's name depends on the bundle's executable name, which was not checked here; the quit is a courtesy and the copy goes ahead either way. Checked: `bash -n build_app`, and the read gives "FormPath". Not run on macOS.

### setup/icon_rules.py · a check that keeps the sparkle icon out
- refers-to: setup/icon_rules.py; setup/line_counts.py :: check; setup/check, setup/check.bat; .github/workflows/ci.yml :: No sparkle icon
- kind: rationale
- logged: v0.54.0 · 2026-11-13

The guard has three layers. Signatures: the formvis banned paths, the removed formpath paths and helper-built `sparkle:` keys, read in every source, `.json` and `.js` file and in `demo/` and `demos/`. Names: in interface code only, any key or string named sparkle. Geometry: any SVG line with two or more closed four-point stars, or three or more stars and plus-shaped glints together. It runs from `./formpath check`, `check.bat`, `counts --check` and CI. It flagged all eight old lines before they were removed and finds nothing in the current formvis or formdeck icons.

### setup/mcpb.py, setup/mcp_stdio.py, setup/agents.py · the desktop extension, attach mode, the plugin manifest and attribution settings
- refers-to: setup/mcpb.py; setup/mcpb/manifest.json; setup/mcp_stdio.py :: --attach, FORMPATH_MCP_ATTACH; setup/agents.py (mirror loop); .claude-plugin/plugin.json; .claude/settings.json
- kind: rationale
- logged: v0.54.0 · 2026-11-13

`./formpath mcpb check` validates the manifest and `mcpb build DIR` writes `formpath-<version>.mcpb` with the version filled in from `frontend/src/version.ts`, so the manifest is not a version site. The extension runs `mcp --attach`, which never starts the engine: while it is down the bridge answers `initialize`, `tools/list` and `tools/call` itself with only a ping tool, and once the engine answers it sends `notifications/tools/list_changed`. Unknown flags to `./formpath mcp` exit 2. `agents sync` mirrors `formpath-skillset` to `.agents/skills` beside `formpath-harness`, and `sync --check` fails while either mirror drifts. `.claude/settings.json` turns Claude Code's attribution off (empty commit and pr text, no session link). Known gap: `./formpath counts --check` fails with "README.md has no line-count sentence"; the README had no such sentence before this release and CI does not run that check.

### app/core/window_key.py · only the app window can write, open a terminal or change the agent program
- refers-to: app/core/window_key.py :: WindowKeyGuard, OPEN, ticket, spend; app/main.py :: app.add_middleware; app/routers/system.py :: claim_window_key, window_ticket; app/routers/terminal.py; app/routers/claude_code.py; formpath_engine.py :: main
- kind: rationale
- logged: v0.55.0 · 2026-11-19

The engine makes one random key per start and keeps it in memory. The desktop shell starts the engine with `FORMPATH_WINDOW_KEY_STDOUT=1`; the engine then prints one `formpath-window-key: ` line, flushed, before it logs its address, and the shell hands the key to its own window only. From source there is no shell, so `POST /api/window/key` gives the key once per start and answers 409 afterwards (recorded as `secondWindowClaim` in `/api/capabilities`); with the variable set that route is 404. `WindowKeyGuard` is added once in `main.py`: every request whose method is not GET, HEAD or OPTIONS needs the key unless its path is on the open list, which holds `/mcp` (outside agents come in there and go through the consent question) and the bootstrap. A list of sensitive routes was not enough, because the window's own routes (file write, terminal, bridge) would be a way round `/mcp`. Reads that return something private (the terminal list and text, the Claude status, chat and sessions) also need the key. The two sockets (a terminal's stream and the chat stream) close with 4403 unless they carry a ticket made with the key; a ticket works once and lives 30 seconds, because a browser cannot set headers on a socket. The existing Host and Origin check stays. `tests/test_window_key_default.py` walks `app.openapi()` and fails when a write route answers without the key and is not on the list. The plug-in frames (sandboxed, no network) never call a route: they ask the page, which runs the tool in-process, so they need and receive no key.

### app/services/claude_code.py · one agent token per tab, in a private file
- refers-to: app/services/claude_code.py :: issue, revoke, is_inapp, sweep, argv, _chat_argv; app/services/terminal.py :: base_env, Session.token, close
- kind: rationale
- logged: v0.55.0 · 2026-11-19

This replaces the single token that every shell tab carried and that sat inside the `claude` command line (see the 0.25.0 entry on the dock's shells, kept as history). Each Claude Code tab and each Chat run now gets its own token, written to a mode 0600 file in `AgentTokens/` under the data folder and handed to `claude` as `--mcp-config <file>`; the token is in no command line and no environment, and a plain Terminal tab gets neither. Closing the tab (or the end of the chat run) deletes the file and the token stops working; an engine start removes files left by an earlier run. Restarting a tab keeps its token, because the program is the same one. `./formpath cli run` no longer posts to the window's command route: it calls `run_command` over `/mcp`, so it follows the person's choice about outside agents like any other agent and cannot change it.

### app/core/seal.py · the program Claude Code runs as is sealed
- refers-to: app/core/seal.py; app/services/claude_code.py :: prefs, save_prefs, status
- kind: rationale
- logged: v0.55.0 · 2026-11-19

`agent.json` holds the program path and the folder Claude Code runs in. Both are signed with an HMAC whose key lives in the system keychain (service `FormPath`, account `settings-seal`, the `keyring` package already used for the assistant's key, imported lazily). A window write signs them. If the file is changed by hand to a non-empty program or folder, the engine treats both as unset and reports `sealBroken` in the Claude status until the next window write confirms. A hand edit that only empties them is not a break, and the first launch after this update, with a value and no seal yet, asks once. With no keychain the stored values stand and the status says `seal: "unavailable"`. The consent choice itself is not stored by the engine (the window keeps it and sends it with each poll), so it has nothing to seal here.

### setup/agents.py · sync also keeps the tool count in the harness skill description
- refers-to: setup/agents.py :: description_wanted, sync; .claude/skills/formpath-harness/SKILL.md (description); tests/test_agents_count.py
- kind: fix
- logged: v0.55.0 · 2026-11-19

The description ended "and 79 more tools" after nine named tools, which was 88 while the catalogue had 93; the wiki said 67 and PARITY.md 92. `sync` now reads "Covers a, b, c and N more tools." from the entry, counts the named tools, and writes N = catalogue size minus the named ones; `sync --check` reports the entry as drifted when N is wrong, so CI (which runs `agents sync --check`) fails on a stale count. The mirror in `.agents/skills` follows from the same run. The entry also now says to use `formpath-skillset` when the task is changing formpath's own code, as the skillset's entry already says the reverse.

### src-tauri/src/main.rs · the shell waits at most 10 seconds for the window key, then takes the engine-did-not-start path
- refers-to: src-tauri/src/main.rs :: setup (the key grace loop, the port match)
- kind: fix
- logged: v0.55.0 · 2026-11-19

Once the address is known the loop polls for the key line until a deadline, which was 3 seconds and is now 10, the family value. The key line is on standard output and the address on standard error, two pipes with no order, so the key can arrive after the address; a slow start must not fail the launch. When the deadline passes with no key, the shell no longer opens the window without one (a window that cannot write is useless and looks broken): it clears the port and takes the existing branch that shows "The formpath engine failed to start. Please relaunch the app." and exits. The first loop, which waits for the address, is unchanged. Not compiled here (no WebKit libraries): the two changes are a literal and a three-line `if` on variables already in scope (`key: Option<String>`, `port: Option<u16>`, both `mut`).

### setup/agents.py · agents/manifest.json says what the app offers agents
- refers-to: setup/agents.py :: ENGINE_FACTS, engine_facts, skill_entries, manifest_text, manifest_drift, sync, DOCK; app/routers/mcp.py :: APPROVAL_GATED; tests/test_agent_manifest.py
- kind: explainer
- logged: v0.55.0 · 2026-11-18

The family reads one small file from each app, `agents/manifest.json` (schema `spec/agent-manifest.schema.json` in formadaptor), instead of hand-typed tool counts. `./formpath agents sync` writes it and `agents sync --check` lists `agents/manifest.json` among the drifted files when the committed one is not what sync would write. Where each field comes from: `app` is `formpath` (the file name of `apps/formpath.json` in formcompiler). `mcp.tools` and `mcp.read_only` come from `mcp.TOOLS`, the list `tools/list` answers with, and the `readOnlyHint` each tool declares. `mcp.approval_gated` comes from `mcp.APPROVAL_GATED`, new, which is every tool name: the consent question in `_call` has no per-tool exception, so a first call from an outside agent waits for the person's Allow in the window whatever the tool, a read like `get_document` included, and one Allow lets the later calls run. The in-app token (Claude Code and Chat tabs the window opened) skips the question and is not an outside agent. `read_only` and `approval_gated` therefore overlap, which the schema allows. `tests/test_agent_manifest.py` calls every tool with the window asking and declining and fails if any tool reaches the window without the consent question first. `mcp.transports` is `stdio` when `setup/mcp_stdio.py` exists and `http` when the engine's OpenAPI document has `POST /mcp`. `extensions` is `null`: formpath loads `.js` plug-ins from its data folder (`routers/plugins.py`), which is not the form.ext host API. `skills` is the folders of `.claude/skills` with a `SKILL.md`, in name order; `sub_skills` the folders of `<skill>/sub-skills` with a `SUB-SKILL.md`. The registry is read by running the engine's own code in a child process with a throwaway `FORMPATH_DATA_DIR`, so sync needs `backend/requirements.txt` installed and says so when it is not; nothing is parsed from source text.

`dock` is the one declared value (`DOCK` in `setup/agents.py`), because the page's code cannot be read by a Python script reliably. Truth today, read from `frontend/src/ui/terminal-dock.ts` and `styles/terminal.css`: the dock is one panel under the canvas, above the status bar (`.ft-dock`, `border-top`, resized by dragging its top edge, `--ft-dock-h`), so positions is `bottom`; its tabs are the Chat tab (`DockKind` `chat`) and terminal tabs of kind `claude` (Claude Code) and `shell`, so tabs is `chat`, `claude`, `shell`. Change `DOCK` when the dock design changes. `frontend/src/ui/dock.ts` is the panel dock for the properties and layers panels, not the agent dock.

Run: sync wrote the file; formadaptor's `scripts/manifest.py check agents/manifest.json --app formpath` accepted it; `--check` exited 0; in a copy of the repo outside the tree, renaming `undo` and then removing `read=True` from `get_object` each made `--check` exit 1 and list `agents/manifest.json`. The engine from source on port 29700 answered `tools/list` with the same 93 names in the same order and the same 7 read-only ones as `mcp.tools` and `mcp.read_only`. Counts: 93 tools, 7 read-only, 93 approval-gated, 2 skills (9 and 8 sub-skills). The documents already say 93 tools; no number needed correcting.

### app/routers/mcp.py · the outside-agent question carries what a dialog needs, can be answered for one call, and is withdrawn
- refers-to: app/routers/mcp.py :: _caller, CONSENT_SECONDS, CONSENT_ANSWERS, _clients, _remember_client, _who, _what, _consent_request, _withdraw, _withdrawals, _ask, _call, mcp, bridge_next, status; setup/mcp_stdio.py :: forward, _client; tests/test_dock_consent.py
- kind: explainer
- logged: v0.55.0 · 2026-11-19

Engine side of the family dock contract (DOCK_SPEC 2, sections A and D), added before the window is ported, so everything here is additive: the present window sends and reads exactly what it did, and was replayed against the changed engine (Don't, Allow, the allowed poll, stop).

The question. The `__consent__` item's `arguments` were `{}` and now hold `tool` (the tool the agent called), `client` (the name the agent announced, or `""`), `what` (a phrase that completes "It asked to ...": `use select`, or `run the command object.group` for `run_command`), `answers` (`deny`, `once`, `always`), `alwaysCovers` (`all`: this engine keeps one yes for every outside agent, it has no per-agent list), `seconds` (180) and `expiresAt` (Unix milliseconds). The item's `id` is the request id. The present window ignores `arguments` on this item.

The agent's name. `/mcp` keeps no session, so `initialize` now answers with an `Mcp-Session-Id` header and remembers `clientInfo.name` under it (256 names, oldest dropped, memory only); a later call that sends the header back is named. An unknown or missing id is never refused, the name is just empty. The stdio relay (`./formpath mcp`, the path Claude Code, Codex and Cursor use after `agents install`) posts each line on its own, so it remembers the name from the `initialize` line it relays and sends it as `X-Formpath-Client`. The 2026-07-28 per-request `_meta` key `io.modelcontextprotocol/clientInfo` is read too. The name is a label for the dialog and nothing else: it decides no permission, and it is cut to 80 printable characters.

Allow once. An answer `{allowed: true, once: true}` lets the waiting call run and leaves `_allowed` as it was, so the next call asks again. `{allowed: false}` and `{allowed: true}` mean what they did. The call that was waiting on the question is now queued with `once: true` whichever yes was given, and `bridge_next` hands an item marked `once` to a window polling with `allowed: false`; without that, a ported window that keeps polling while its dialog is open would hold the approved call until its open poll ended (FormVis saw 20 seconds). The present window polls again only after the answer and ignores the field.

Withdrawal. A window that polls with `withdrawals: true` in the body is sent an item `{id: "w<request id>", name: "__withdrawn__", arguments: {request, reason}}` when a question ends: `answered` when any window answered it, `expired` when the 180 seconds passed. The item needs no result and none is accepted. A window that does not send the flag is never sent the item (and any queued ones are dropped when it polls), which is why the present window is unaffected; at most 64 wait. `GET /api/mcp/status` gained `consent: {answers, alwaysCovers, seconds, withdrawals}` so a window can tell an engine that has all this from one that does not.

Not changed, for the port: there is no Blocked state in the engine (the window holds the choice, `agentsAllowed`); the refusal sentences still name "Allow outside agents (Preferences > Plugins)", which is the control the present window has.

Run on port 33001 with a script standing in for the window and for an agent on the real `/mcp`: the item carried the fields above with `client` `probe-agent`; deny refused and the next call was refused at once; once ran the call (item marked `once`, delivered to an `allowed: false` poll) and the next call asked again, twice; plain allow ran it and the following call ran with no question; `__withdrawn__` arrived after each answer and, on a second engine, after 180.0 s with reason `expired` (the late answer got 403). Through the relay the name was `relay-probe`. Tests were written after.

### app/services/agent_programs.py · agent status in one call, and Codex and Cursor as terminal tab kinds
- refers-to: app/services/agent_programs.py :: PROGRAMS, TOKEN_VAR, find, status, codex_args, cursor_entry, write_cursor_config, open_terminal; app/routers/terminal.py :: agent_status, open_agent, AgentBody; app/services/claude_code.py :: issue_env; tests/test_agent_programs.py
- kind: explainer
- logged: v0.55.0 · 2026-11-19

Engine side of the family dock contract, clauses 10 and 13; launch approach read from FormVis `backend/app/services/agent_programs.py`. Both routes are new, so the present window is untouched.

`GET /api/terminal/agents` (window key required, like the other status reads) answers `{claude, codex, cursor}`, each `{installed, path, version, signedIn, install, title}`. `install` is always a command line a person can paste. `version` is the first word of `<program> --version` that holds a digit. `signedIn` for Claude Code is true when `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` is set, else what `claude auth status` reports as `loggedIn` (a local check, no model call), else `null`; for Codex and Cursor it is `null`, the engine cannot tell. The answer is kept for 60 seconds (`?fresh=1` asks again) and is computed only when the route is called, never at engine start. `GET /api/claude/status` is left exactly as it was (it still runs `claude --version` on every call and has no `signedIn`); the ported window should call the new route instead.

`POST /api/terminal/agent` `{kind: "codex" | "cursor", cols, rows}` starts the found program in a tab of that kind, titled Codex or Cursor, in the agent folder (`claude_code.workdir()`), through the login shell as Claude Code is. 409 with a sentence containing "is not installed" and the install line when the program is missing (the status Claude Code's route uses), 422 for another kind, and the window key guard refuses it without the key as it does every write. The tab gets its own token from `claude_code.issue_env()` in the child's environment as `FORMPATH_INAPP_TOKEN` (the variable `terminal.base_env` removes, so a plain shell tab never has it), held on the session so `terminal.close` revokes it; restart keeps the same token. The token is on no command line and in no file.

How each program is pointed at formpath's MCP server with that token. Codex: one argument, `-c mcp_servers.formpath={url="<engine>/mcp",env_http_headers={"x-formpath-inapp"="FORMPATH_INAPP_TOKEN"}}`, which names the variable and replaces a `formpath` entry `agents install` may have written to the person's config for this run only; the person's `config.toml` is not written. Cursor: `<agent folder>/.cursor/mcp.json` gets `mcpServers.formpath = {url: "${env:FORMPATH_MCP_URL}", headers: {"x-formpath-inapp": "${env:FORMPATH_INAPP_TOKEN}"}}`, placeholders the client expands, mode 0600 when the engine creates the file; other servers in an existing file are kept and a file that is not a JSON object is left alone. Neither program is installed here: that Codex accepts this `-c` value and that Cursor's agent expands `${env:...}` in `url` and `headers` and prefers the project file over the user file is from their documentation and is not verified.

Run on port 33001 with stand-in scripts named `claude`, `codex` and `cursor-agent` first on the engine's PATH: status found all three with versions 9.9.9, 0.99.1 and 2026.11.01-abc123 and Claude Code signed in; a second engine without them reported Codex and Cursor missing with install lines, and found the machine's real Claude Code 2.1.328, whose `auth status` answered `loggedIn` false in an empty home. Each tab kind started; `/proc/<pid>/environ` held a 43 character token, `ps -eo args` did not; a plain shell tab printed an empty variable; a call to `/mcp` carrying a tab's token reached the window with `inapp: true` and no question; after the tab closed the same token was treated as an outside agent's. The config file was 0600, merged into a file with another server, and left a non-JSON file alone. The cached status still said installed after the stand-in was moved away and `fresh=1` said missing. Write routes: 50 before, 51 after (`POST /api/terminal/agent`), all refused without the key except the two on the open list. Tests were written after.

### app/routers/mcp.py · a waiting question survives a window reload, and ends when its caller hangs up
- refers-to: app/routers/mcp.py :: _questions, _ask, _ask_caller, bridge_session, _call, _stop; tests/test_dock_consent.py
- kind: rationale
- logged: v0.55.0 · 2026-11-19

Found while the window was moved onto the shared dock (family dock contract, clause 15).

Reload. A `__consent__` item was taken out of `_pending` when the window read it and its id was tied to that window's bridge secret. A reloaded window opens a new bridge session, so it was never sent the question again and could not have answered it: the agent waited out the 180 seconds. `_ask` now keeps each open question in `_questions`, and `bridge_session` puts every open question that is not already queued back at the front of the queue and forgets which secret held it. The old window's late answer is refused with 403 as before.

Hang-up. `_call` asked the question and waited whatever the caller did. `_ask_caller` waits on the same `_ask` and looks once a second at the caller's connection (`request.is_disconnected`, kept in `_caller` as `gone`); when the caller has gone it cancels the question, which withdraws it (`__withdrawn__`, reason `expired`), and the call ends without the ten-minute pause a refusal starts, because the person refused nothing. Only the question is watched: a tool call that is already running in the window is not cancelled.

Wording. The two refusals that named the old checkbox ("turn on Allow outside agents (Preferences > Plugins)") now say "set Outside agents to Allowed (Preferences > Plugins)", the control the window has after the port.

Blocked stays a window matter (the bridge refuses every item while it is set); the engine has no Blocked state.

Seen on port 33411 with the window in headless Chrome and a script as the agent on the real `/mcp`: with a question open the page was reloaded and the same question came up again, was answered with Always, and the call ran; a caller with a 12 second timeout hung up and its dialog closed unanswered within a few seconds, and the next call was asked about again. Tests were written after.

### app/services/claude_code.py, agent_programs.py · the entry for FormPath's own tabs is named formpath_tab
- refers-to: app/services/claude_code.py :: issue, open_terminal, _chat_argv; app/services/agent_programs.py :: codex_args, write_cursor_config; tests/test_agent_programs.py
- kind: decision
- logged: v0.55.0 · 2026-11-19

The MCP entry the engine writes for a Claude Code tab, for Chat, for a Codex tab and for a Cursor tab was named `formpath`, the same name `./formpath agents install` gives the entry an outside agent uses. It is now `formpath_tab` everywhere the engine writes it (the 0600 token file's `mcpServers` key, `--allowedTools mcp__formpath_tab`, Codex's `-c mcp_servers.formpath_tab=...`, Cursor's `.cursor/mcp.json` key), so the two cannot be mistaken for each other and a person's own `formpath` entry is not shadowed. The entry `./formpath agents install` and `./formpath claude` write is still `formpath`. Tool names in Chat's chips therefore begin `mcp__formpath_tab__`. Two assertions in `tests/test_agent_programs.py` named the old key and were changed to the new one. A Cursor config written by an earlier build keeps its old `formpath` entry beside the new one; it points at variables only FormPath's tabs have.

Seen: the token file of a started Claude Code tab held `formpath_tab`; a call with that token ran while the tab was open and was treated as an outside agent's after the tab closed.

### app/services/agent_lookup.py · the family's finder for the agent programs, copied unchanged and held to its hash
- refers-to: app/services/agent_lookup.py (VERSION 1.0.0); setup/agents.py :: LOOKUP, LOOKUP_HASHES, lookup_problems, lookup, sync, install_claude; setup/claude_launch.py :: lookup, main; tests/test_agent_manifest.py
- kind: decision
- logged: after v0.55.0 · 2026-11-19

`agent_lookup.py` is FormVis's file (commit 146dddd1 there), copied byte for byte: standard library only, nothing imported from the app, 443 lines, SHA-256 `252ea9bb9419d4990f174f91914f09800497bc69e98f849f5643bbf4217cc3f3`. It is never edited here; a change arrives as a whole new VERSION with a new line in `LOOKUP_HASHES`. `./formpath agents sync` (with and without `--check`) reads the file's `VERSION` line, hashes its bytes and exits 1 naming the file when the two do not agree or the file is gone. The hash is of the bytes, so the file must be checked out with LF endings, which `.gitattributes` already asks for. The hash is not in `frontend/src/dock/MANIFEST.json`: that file belongs to the dock module.

`./formpath agents install` and `./formpath claude` load the file by its path (they run without the engine) and no longer ask `shutil.which("claude")`: they use `find` and `check` with the override variable `FORMPATH_CLAUDE_BIN`, start `claude mcp ...` and the launcher through `start_argv` in `child_env` (the program's own folder first on PATH), and print the finder's sentence when the program is missing or does not start. The launcher keeps every `CLAUDE*` variable of the terminal it was started from (`keep`), since it is the person's own terminal session. Neither script reads the `claudeBin` setting, which lives sealed in the engine's data folder.

Removed: the line "the claude command is not installed here; once it is, run: ..." in `install_claude` and "[formpath] Claude Code is not installed: https://claude.com/claude-code" in the launcher; both now print the finder's sentence.

Seen on Linux with stand-in programs, a stand-in login shell, a made-up home and PATH `/usr/bin:/bin:/usr/sbin:/sbin`: `agents sync --check` in step and exit 0; in a scratch copy with one newline added to the file, exit 1 with "does not match the hash recorded for version 1.0.0", with and without `--check`; in a copy without the file, exit 1 with "missing"; `agents install claude` found a `#!/usr/bin/env node` stand-in under `~/.local/bin` and the stand-in recorded `mcp get formpath` and `mcp add --scope user formpath -- [launcher] mcp`, each with its own folder first on PATH; `./formpath claude` started it with the MCP configuration and a kept `CLAUDE_EXTRA`; with nothing installed both printed "Claude Code was not found. Looked in: ...". The three tests were written after. Not run: Windows, macOS, the real Claude Code.

### app/services/claude_code.py, agent_programs.py · every lookup and every start of an agent program goes through the finder
- refers-to: app/services/claude_code.py :: OVERRIDES, SETTINGS, OTHERWISE, child_env, setting, otherwise, located, usable, said, _runnable, cli, info, _wrap, open_tab, _run, chat_send; app/services/agent_programs.py :: PROGRAMS, TABS, find, _claude_signed_in, status, open_terminal; tests/test_agent_programs.py
- kind: decision
- logged: after v0.55.0 · 2026-11-19

A window started from the Dock, the Finder or the Start menu gets the system's short PATH, so `shutil.which` and one `command -v` in a login shell reported programs installed by npm, a version manager or into the home folder as not installed, and a `#!/usr/bin/env node` program that was found could still fail to start because its `node` was not on the child's PATH. The functions keep their names and what they return; their bodies call `agent_lookup`.

- `located(kind, fresh)` is the one lookup: `agent_lookup.find` with the person's setting (`claudeBin` for Claude Code; the other programs have no path setting in FormPath, so `setting()` answers None and the record leaves it out), the override variable (`FORMPATH_CLAUDE_BIN`, and by the family's naming `FORMPATH_CODEX_BIN`, `FORMPATH_CURSOR_BIN`, `FORMPATH_ANTIGRAVITY_BIN`), then `agent_lookup.check`, which runs `--version` the way a tab starts. `usable(kind)` asks once more, fresh, when the first answer is not "runs".
- `child_env(path)` is `agent_lookup.child_env` over `terminal.base_env()`: the program's own folder first on PATH, then the repository folder (not in a frozen engine, as `base_env` has it), the person's shell PATH, the known folders, the engine's PATH; `CLAUDE*` variables other than `KEEP_ENV` left out as before.
- `_wrap(cmd)` is `agent_lookup.start_argv(cmd)`, so a Claude Code tab, Chat, a Codex tab and a Cursor tab start the same way a check does.
- `info()` and `status()` answer the finder's fields beside the old ones: `finding` (runs, broken, missing), `how`, `looked`, `error`, `said`. `installed` is true only when `--version` ran with exit code 0, and `path` is given for a program that was found but does not start.
- `GET /api/terminal/agents` reports a fourth program, `antigravity` (`agy`), found or not and where it looked; `signedIn` stays null. There is no Antigravity tab: `TABS` is codex and cursor, and the route's body still takes only those two kinds.
- The refusals of `POST /api/claude/open`, `POST /api/claude/chat/send` and `POST /api/terminal/agent` (409) carry the finder's sentence. "give its path in Preferences" is offered only for Claude Code, the one program with a path setting here.

Removed: `_from_login_shell`, `CANDIDATES`, `SYSTEM_PATHS` and the fixed sentence `INSTALL` ("Claude Code is not installed. Install it (...), run claude once in a terminal to sign in, then open it here again.") in `claude_code.py`; `_version` and the bare PATH search with its login-shell fallback in `agent_programs.find`; the sentence "[title] is not installed. Install it (...), then open it here again." in `open_terminal`.

Tests changed, and why: the fixture in `tests/test_agent_programs.py` replaced `terminal.login_shell`, which the lookup no longer calls; it now gives the finder a stand-in login shell, a made-up home and no system folders, and clears the install-folder variables (`BUN_INSTALL` and the like), so the machine's own programs stay out. The status test expected exactly claude, codex and cursor and now expects antigravity too. The refusal test expected "is not installed" and now expects the finder's sentence.

The whole suite is held to stand-ins (`tests/conftest.py`): two older tests ask the Claude Code status with nothing replaced (`test_window_key.py :: test_secret_reads_need_the_key`, `test_seal.py :: test_a_hand_edit_of_the_program_is_caught`), so a plain run on a computer with Claude Code on PATH started the real `claude --version`, before this change through `shutil.which` and after it through the finder. On macOS and Linux the session now has PATH set to a sandbox folder of logging stand-ins (`claude`, `codex`, `cursor-agent`, `agy`) and the system's four folders, SHELL set to a stand-in login shell, the install-folder variables cleared, and `agent_lookup.system_folders` replaced in every test; the run's last lines say how often a stand-in was started. Seen: a run with a logging guard `claude` first on the outer PATH left the guard's log empty and reported "agent program stand-ins started 2 time(s): claude --version". On Windows the session is as before.

Seen on Linux with the engine on port 4740, its own data folder, a made-up home, a stand-in login shell and PATH exactly `/usr/bin:/bin:/usr/sbin:/sbin`, with stand-in programs only: the status route found claude and agy under `~/.local/bin` and codex under `~/.nvm/versions/node/v22.3.0/bin` (how "folder"), cursor-agent in a folder named only by the stand-in shell's interactive file (how "shell"), each with version 1.2.3 from a `#!/usr/bin/env node` script with a stand-in `node` beside it; Codex, Claude Code and Cursor tabs opened through the real routes printed "node stand-in: yes" with the program's folder first on PATH; Chat answered through the stand-in; with the programs removed the status answered "missing" with the list of places and the tab route 409 with the same sentence; a script whose interpreter is missing answered "broken" with the error line, and the Claude Code tab and Chat refused with that sentence; a path given in Preferences was used (how "setting"), and a path that cannot run fell back with the existing note. An override variable was seen only in the tests (Claude Code through `FORMPATH_CLAUDE_BIN`). The three new tests were written after. Not run: Windows, macOS, a fish shell, a frozen engine, the real Claude Code, Codex, Cursor or Antigravity; no real install of `agy` has been seen.

### app/services/agent_lookup.py · the finder is version 1.0.1
- refers-to: app/services/agent_lookup.py :: VERSION, _last_line; setup/agents.py :: LOOKUP_HASHES; tests/test_agent_manifest.py
- kind: decision
- logged: v0.56.0 · 2026-11-19

The file was replaced whole by FormVis's copy at its commit ddc893ae (`git show ddc893ae:backend/app/services/agent_lookup.py`), SHA-256 `62667f9b68b7d101e1896ce617240424e33b7e498c560bc79d45f0ab26c77d51`. Against 1.0.0 two lines differ: `VERSION`, and `_last_line`, which no longer takes the hint line "use -[v]S to pass options" that `env` prints as the reason a program does not start. `LOOKUP_HASHES` holds both versions, so a checkout of either passes `./formpath agents sync --check`.

Test changed, and why: `test_the_check_names_the_shared_finder_edited_in_place_or_missing` held "version 1.0.0" in its expected sentence; it now reads the version from the file, so the next version of the finder needs no change to it.

Seen: `tests/test_agent_manifest.py` passes with the new file (the hash test, the edited-in-place test and the imports test among them). Not run: Windows, macOS, any real agent program.

### app/services/agent_programs.py, terminal.py, routers/terminal.py · an Antigravity tab, with its entry in a folder of formpath's own
- refers-to: app/services/agent_programs.py :: TABS, TAB_ENTRY, tab_folder, write_tab_entry, remove_tab_entry, forget_tab, open_terminal; app/services/terminal.py :: close; app/routers/terminal.py :: AgentBody; tests/test_agent_programs.py
- kind: decision
- logged: v0.56.0 · 2026-11-19

`POST /api/terminal/agent` takes kind `antigravity` and starts `agy` the way it starts Codex and Cursor: found by the finder, started through `start_argv` in `child_env`, with the tab's own token in `FORMPATH_INAPP_TOKEN`. Antigravity reads its MCP servers from a file, so before the start the entry `formpath_tab` (`serverUrl` the engine's `/mcp`, `headers` with the tab's token under `x-formpath-inapp`) is written into `.agents/mcp_config.json` of the tab's working folder: every other entry and key is kept, the file is written beside itself and moved into place, mode 0600. `terminal.close` revokes the token as before and then calls `forget_tab`, which takes the entry out only while it still carries that tab's token. A file that is not an MCP servers file is left alone and the tab is refused (500 with the sentence).

Decision, as the family's Antigravity notes ask to be said: formpath's Codex and Cursor tabs share one working folder (the Agent folder, or the one chosen in Preferences), and the Cursor tab's file there holds placeholders, never the token. Antigravity's file has to hold the token itself, so the Antigravity tab does not use that folder: it runs in `[data folder]/agent-tabs/antigravity`, a folder of formpath's own, and a live token is never written into a folder the person chose. Cost: `agy` does not start in the Agent folder. Two Antigravity tabs at once share the folder and the later one's entry replaces the earlier one's; not handled.

Test changed, and why: `test_a_missing_program_or_an_unknown_kind_is_refused` expected 422 for kind `antigravity`; the kind is now taken, so with no `agy` it expects 409 with the finder's sentence. `test_agent_manifest.py` expected the dock's tab list without `antigravity`.

Seen on Linux with the engine on port 4741, its own data folder, a made-up home, a stand-in login shell and a stand-in `agy` first on PATH (`which` printed only that one): the status answered `finding: runs`, version 9.9.9; the tab opened through the route with `cwd` the folder above and its text read "STAND-IN AGY BANNER: cwd [that folder]; token set; mcp file present"; the file, seeded with a server `other` and a key `theme`, held both beside `formpath_tab` at mode 0600; `tools/list` on `/mcp` with the tab's token answered 93 tools; after `DELETE /api/terminal/[id]` the file was byte for byte the seed. With no `agy` (port 4744): status `missing` with the places looked in, the tab route 409 with the same sentence, no file made. The test was written after. Not seen: a call with a closed tab's token being asked about or refused through `/mcp` (no window was open, so a live and a dead token both got "formpath is not open"); the token's end is held by the test through `claude_code.is_inapp`. Not run: a real `agy` (whether it reads `serverUrl` and `headers` from a workspace file, or wants the folder trusted first), a restart of the tab, Windows, macOS.

### setup/agents.py · agents install adds formpath to Antigravity
- refers-to: setup/agents.py :: install_antigravity, _ours, main, DOCK; agents/manifest.json; tests/test_agent_manifest.py
- kind: decision
- logged: v0.56.0 · 2026-11-19

`./formpath agents install` takes `antigravity`, and includes it when no client is named. It writes `mcpServers.formpath = { command: [this folder's launcher], args: ["mcp"] }` into `~/.gemini/config/mcp_config.json`, the file Google documents for the Antigravity IDE and CLI: everything else in the file is kept, the file is backed up, written beside itself and moved into place, and a second run changes nothing. An entry of formpath's own at another path (the launcher's file name with `["mcp"]`) is brought up to date; a server named `formpath` that formpath did not write is left alone and reported, and so is a file that is not an MCP servers file. When only `~/.gemini/antigravity-cli/mcp_config.json` is there, the documented file is written and the result says the older one was seen and left alone. No skill is copied: nothing read says where Antigravity looks for skills. `DOCK["tabs"]` gains `antigravity`, and `agents/manifest.json` was written again by `./formpath agents sync`.

Seen with made-up homes: dry run (nothing written), first run (the file as above), second run ("already in"), a foreign entry (file unchanged, reported), only the older file (documented file written, older one unchanged), a file that is not JSON (unchanged, reported), an unknown client (exit 2 naming the four). The test was written after. Not seen: an own entry at another path being brought up to date. Not run: a real `agy` reading the file.

### formpath_engine.py · the engine starts when it has no output streams
- refers-to: formpath_engine.py (the lines after the imports)
- kind: decision
- logged: v0.56.0 · 2026-11-19

A frozen engine built without a console on Windows starts with `sys.stdout` and `sys.stderr` set to `None`, and the first thing that writes to them (Uvicorn's logging, the window key line) ends the start. Before anything of formpath's is imported, the entry now gives `sys.stdin`, `sys.stdout` and `sys.stderr` the system's null device wherever one is `None`, as FormWeb's entry does. Streams that exist are not touched, so the desktop shell still reads the address and the key line from standard output.

Seen on Linux: `python formpath_engine.py >&- 2>&-` (both streams closed, so Python sets them to `None`) with its own port and data folder answered `GET /api/health` with 200 and kept running; started normally it printed Uvicorn's lines ("Uvicorn running on http://127.0.0.1:4743"). No test was added: the suite has no test that starts the entry script. Not run: Windows, a frozen engine.

### tests/conftest.py · the stand-ins cover Cursor's second name
- refers-to: tests/conftest.py :: AGENT_STAND_INS, only_stand_in_agent_programs
- kind: decision
- logged: v0.56.0 · 2026-11-19

The finder looks for Cursor's agent under two names, `cursor-agent` and `agent`. The session's sandbox folder of logging stand-ins held the first only, so `agent` joins the list; the five names are now the five the finder can start. Nothing else in the guard changed.

Seen: the whole suite run with a folder of logging decoys for all five names first on the outer PATH and a stand-in SHELL: 177 passed, the decoys' log stayed empty (0 lines), and the run's last lines said "agent program stand-ins started 2 time(s): claude --version" (the sandbox's own stand-in, asked by the two older status tests). Not run: Windows, where the session is as before.

### formpath (the launcher), README.md, AGENTS.md, docs/MANUAL.md, .docs/wiki/Agents-and-MCP.md · the list of agent programs names four
- refers-to: formpath :: usage (mcp, agents); README.md; AGENTS.md; docs/MANUAL.md; .docs/wiki/Agents-and-MCP.md
- kind: decision
- logged: v0.56.0 · 2026-11-19

Wherever these say which agent programs formpath is set up for, they now say Claude Code, Codex, Cursor and Antigravity. The wiki line on `./formpath agents install` says what Antigravity gets (the server, in `~/.gemini/config/mcp_config.json`) because no skill is copied for it.

Left as it is: the sentence in Preferences > Plugins ("Lets Claude Code, Codex, Cursor or another MCP client draw in the open document; ...", `src/ui/app-dialogs.ts`) is a translated string, and a changed English string needs new translations in all 25 languages; "another MCP client" already covers Antigravity. `formpath.bat` names no programs. CHANGELOG history is not touched.

### formpath_engine.py, app/core/startup.py, app/core/runtime.py, src-tauri/src/main.rs · the packaged engine takes a lock, keeps a log, leaves with its app and serves nothing on its own
- refers-to: formpath_engine.py :: serve, watch_shell, main; app/core/startup.py (whole file); app/core/runtime.py :: start_logging, claim, release; src-tauri/src/main.rs :: the engine's start in setup; tests/test_startup.py
- kind: decision
- logged: after v0.56.0 · 2026-11-19

The family's pattern for starting and stopping cleanly on Windows, as FormTools has it. Only the packaged entry is touched: `./formpath backend`, `serve` and `boot` run `uvicorn app.main:app` and take no lock and write no log file, as before.

`app/core/startup.py` is FormTools's file (its `origin/main`) with the six names at its top changed and nothing else: `APP`, `NAMES`, `SHELL_ENV` (`FORMPATH_SHELL_PID`), `ALONE_ENV` (`FORMPATH_NO_SHELL`), `ERRORS_NAME`. It imports nothing of formpath's. `app/core/runtime.py` is new and small: the log file and the two calls around the lock.

What the entry does now, in this order, before it serves:

1. The data folder (`config.data_dir()`: `FORMPATH_DATA_DIR`, else `Formpath` in the home folder) and the log, `Logs/formpath-engine.log` in it, rotating at 1 MB with three kept. A folder that cannot be made is one sentence on standard error and exit code 5.
2. `startup.keep_errors`: when the engine was started with no standard error, the stand-in from the top of the file is replaced by `Logs/formpath-engine-errors.log`, so a traceback is kept. A standard error that exists is not touched; the shell still reads its pipe.
3. Started alone (frozen, no `FORMPATH_SHELL_PID`, no `FORMPATH_NO_SHELL=1`): it opens the app found beside it and returns 0, or says "formpath-engine is a part of FormPath and serves nothing on its own. Open FormPath instead." and returns 4. No lock, no port. formpath's engine is a one-file program beside the app in all three installs, so the `.` place is the one that matters; the other places are kept as the family has them.
4. The lock, `engine.lock` in the data folder (formpath had none): `pid`, `started`, `born`, `shell`, `shellBorn`. A live engine whose app is alive refuses the newcomer ("formpath is already running on [folder] (engine process N).", exit code 2); an engine whose app is gone is ended and replaced; a damaged file, a process id nobody has, or a process that is not the recorded engine gives the lock away and the process is left alone.
5. The watch: every two seconds the engine asks whether the process in `FORMPATH_SHELL_PID` is still there, and when it is not it gives up the lock and leaves with code 0. With no such variable (a run from source) nothing is watched, as before.
6. The key line and the server. `uvicorn.run` became `uvicorn.Server(uvicorn.Config(...)).run()` with the same arguments, for two reasons: the second `start_logging` call has to come after Uvicorn has set up its own loggers (that setup removes the file handler from them), and the lock is given up in a `finally`. A SIGTERM handler gives up the lock and exits 0, because Uvicorn hands the signal back to the previous handler after its own shutdown; the default one ended the process before the `finally`.

`--selfcheck` is decided before any of this and makes no folder. An error that ends the engine is written to the log before it is raised.

The file handler sits on `formpath`, `uvicorn` and `uvicorn.access`, not on `uvicorn.error` as well: that logger hands its lines to `uvicorn`, and a handler on both writes every line twice.

The shell: one line. The start in `src-tauri/src/main.rs` sets `FORMPATH_SHELL_PID` to the shell's own process id. Without it a packaged engine takes the started-alone branch and never serves, so the line is in this commit and not a later one. Not compiled here.

A change people will meet: two copies of the app on one data folder. Until now each got its own engine and port. Now the second copy's engine is refused, and the second copy shows its "engine failed to start" message. A lock left by a 0.56.0 engine does not exist (that version wrote none), so an engine of that version left running after a quit is not found by this one; it has to be ended by hand or by the launcher once.

Seen on Linux, engine from source, stand-in shells (`sleep 300`), made-up home, own data folders and ports:

- started with `>&-`, `>&- 2>&-` and `<&- >&- 2>&-`: `/api/health` 200 in all three (the 0.56.0 entry too); descriptors 0, 1 and 2 are the null device; the log has "engine started, pid N, data folder ..." first and Uvicorn's lines after it; the errors file exists only when there was no standard error; after SIGTERM the exit code is 0 and the lock is gone (0.56.0: 143);
- a second engine with another stand-in shell: exit 2 with the sentence, the first still answers, the log has the refusal;
- the first one's stand-in shell ended: the engine left with 0 after 1.4 s, the lock gone, "the app that started this engine is gone" in the log;
- a stopped holder (`kill -STOP`) whose shell is gone: the new engine serves after 5.8 s, the holder's exit is 137, the log has "an engine left running without its app was stopped";
- locks holding `not json at all`, `[1, 2]`, `{"pid": "x"}` and nothing: the engine serves and the lock names it;
- a lock naming an unrelated `sleep`: the engine serves, the `sleep` still runs;
- started alone (the entry through `python -c` with `sys.frozen` set and `sys.executable` a stand-in path): the stand-in app beside it as `formpath` and as `FormPath`, one folder up, and in `../../MacOS`: exit 0, the app's mark appears, no lock, the port does not answer; no app near: exit 4 with the sentence; with `FORMPATH_NO_SHELL=1` it serves;
- a data folder under a file: exit 5 with the sentence.

`tests/test_startup.py` holds these as 14 tests (FormTools's 13 with formpath's names, the port file replaced by the lock and the log line, plus the second engine through the entry). Not run: Windows (`_kernel`, `_open_windows`, `_alive_windows`, `_created_windows`, `_end_windows`, the handle branch of `watch`, and in `open_app` the `SetDllDirectoryW` line and the detached flags have never run), macOS (the `ps` reading of a start time ran against Linux's `ps`), a really frozen engine.

### src-tauri/src/main.rs · a failed start says its sentence before the loading window closes
- refers-to: src-tauri/src/main.rs :: main, the `None` branch after the wait for the address and the key
- kind: decision
- logged: after v0.56.0 · 2026-11-19

When the engine gave no address and key, the shell closed the loading window and then showed its message. On Windows the loading window is the last window at that moment, and closing it first can end the app before the message is seen. The two statements changed places: the message, then `close_splash`, then the engine is stopped and the app exits. The sentence now says what the most likely cause is since the engine takes a lock (a copy of FormPath is already open on the same data folder) and where the engine's log is.

Not compiled and not run on any system: the desktop shell cannot be built here. One string and two statements in another order. Held: the rest of the family's shell side (the Windows job object, the failure text with the engine's last lines and its exit code, a limit on the wait for the address, the same order for a window that fails to build).

### app/core/startup.py · an engine that has ended but was not yet collected counts as gone where there is no /proc
- refers-to: app/core/startup.py :: finished, gone_by; tests/test_startup.py :: test_a_holder_that_has_ended_but_was_not_collected_counts_as_gone_where_there_is_no_proc
- kind: fix
- logged: v0.58.0 · 2026-11-20

FormCut's macOS job found it in the same file: ending a leftover engine waits until it is gone, and `_alive_posix` asks `kill(pid, 0)`, which still answers for a process that has ended and that its parent has not collected. It tells such a process apart only by reading `/proc`, which macOS does not have, so the wait ran out and the start was refused with "could not stop an engine that was left running". `finished(pid)` asks `ps -o stat= -p <pid>` where there is no `/proc` (never on Windows, never on Linux) and answers true for a state that starts with `Z`; `gone_by` stops waiting when the process is not alive or is finished. `alive` is unchanged, so the two second watch on the app starts no program.

Seen on Linux with `PROC` pointed at a folder that does not exist: the new test failed with that sentence before the change (1 failed) and the file passes after it (15 passed). Not run on macOS.

### src-tauri/src/main.rs, src-tauri/src/engine_start.rs, src-tauri/src/win_job.rs · the Windows engine ends with the app, a failed start says why, and the wait for the address has a limit
- refers-to: src-tauri/src/main.rs :: EngineStep, start_limit, engine_failed, kill_backend, main; src-tauri/src/engine_start.rs :: Failure, Wait, Tail, message, log_path; src-tauri/src/win_job.rs :: hold_pid, end; src-tauri/Cargo.toml :: windows-sys
- kind: feature
- logged: v0.58.0 · 2026-11-20

The rest of the shell side held in 0.57.0. FormPath starts its engine through tauri-plugin-shell, so it takes FormVis's way and keeps that start: right after the start the engine's process id is put in a job object that ends the engine when the job closes (`win_job::hold_pid`, `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`), so it goes with the app however the app ends, and `kill_backend` ends the job before the child. The start was not moved to the standard library's process start because the plugin's start can be done this way and the brief says to keep it. `win_job.rs` is FormVis's file less `hold` (the form for a standard library child, which FormPath never uses since it gives the job its engine by process id) and that function's two imports, `std::os::windows::io::AsRawHandle` and `std::process::Child` (removed in f558ffd, the one warning of the Windows type check); `hold_pid` and `end` are FormVis's unchanged.

The shell reads the engine's lines through one channel that also carries the two limits: 90 seconds for the address (the owner's D1; the shell had no limit before) and then 10 seconds for the window key. When the engine stops, is missing, cannot be started, or a limit runs out, and when the window cannot be built, `engine_failed` shows one dialog with the sentence for that case, the engine's last twelve lines (never the window key line), its exit code where it gave one (code 2 says another copy holds the data folder) and the log's path, before the loading window closes; then the engine is ended and the app exits. The log path follows the engine's own rule (`FORMPATH_DATA_DIR`, with `~` read the engine's way, else `Formpath` in the home folder, then `Logs/formpath-engine.log`).

`windows-sys` 0.61.2, the version already in the lock, under the Windows target only. The one hand-added line in the shell's own dependency list in `Cargo.lock` was proved: the old lock and the new `Cargo.toml` in a scratch crate with stub sources, `cargo update --workspace --offline`, and its lock against ours: no difference. `cargo check --target x86_64-pc-windows-msvc` of the two files in the scratch crate passes, and `cargo test` there passes the four tests of `engine_start.rs` (6 passed in the crate). The shell itself was not compiled and `main.rs` was read line by line against FormVis's, not built. `cargo metadata --locked` does not resolve offline here.

### setup/freeze_backend, setup/freeze_backend.bat · a Windows engine is packaged with no console window unless FORMPATH_ENGINE_WINDOWED=0
- refers-to: setup/freeze_backend :: windowed; setup/freeze_backend.bat :: WINDOWED
- kind: decision
- logged: v0.58.0 · 2026-11-20

The owner's decision D3: a Windows engine is packaged as FormWeb's is, with PyInstaller's `--noconsole`, so no console window opens beside the app. The scripts had no switch, so the family's switch is added with the default turned round: on Windows the engine is windowed unless `FORMPATH_ENGINE_WINDOWED=0`; Linux and macOS builds are unchanged. `formpath_engine.py` already puts the null device in place of a missing stream before anything prints, so `--selfcheck` still works with no console: run with `sys.stdout` and `sys.stderr` set to None it exits 0. The build's own check only runs `--selfcheck`, which serves nothing, so it still needs no `FORMPATH_NO_SHELL=1`; a check that starts the frozen engine to serve on its own must set it.

Checked with `bash -n` and the `.bat` by reading; no Windows build has shown it.

### app/core/seal.py, app/services/claude_code.py, app/routers/claude_code.py · a stored place for Codex, Cursor and Antigravity, sealed like Claude Code's
- refers-to: app/core/seal.py :: LATER, SEALED, digest; app/services/claude_code.py :: SETTINGS, save_prefs, places; app/routers/claude_code.py :: PrefsBody, get_prefs
- kind: decision
- logged: v0.59.0 · 2026-11-20

`agent.json` kept a place for Claude Code (`claudeBin`) under the settings seal, written only from the window and given to the finder first. Codex, Cursor and Antigravity now have the same: `codexBin`, `cursorBin` and `antigravityBin`, in `SEALED`, written through the same window-only route, and `SETTINGS` gives each to the finder before the development variables (`FORMPATH_*_BIN`) and the usual places. A hand edit of any of them reads as a broken seal and every sealed place as empty, as before.

The digest leaves out each of the three new places while it is empty, so a file sealed by 0.58.0 gives the same body and reads whole after the update; no migration. Proved before the change with real files: 0.58.0 (ca994d3, a scratch copy) wrote `agent.json` with a Claude Code place, a first message and its seal through a file-backed keyring; the new code read the same file with the same key as `seal: ok`, the place kept and given as the setting, the three new places empty, and the file unchanged. Agent access (Ask, Allowed, Blocked) is not in this file in formpath; it lives in the window's own store and the engine's MCP gate, so the update does not touch it. `test_seal.py` writes a file of 0.58.0's shape with 0.58.0's seal formula and checks the same, then that later writes keep it sealed.

`GET /api/claude/prefs` gives the four places and `sealBroken` to the window (key required, like the status), for the new fields in Preferences. The finder's sentence for a missing Codex, Cursor or Antigravity now starts with "your setting (empty)" and ends "or give its path in Preferences", as Claude Code's did; the two status tests say so.

### app/core/forms.py, app/routers/projects.py · a document over 1024 KB saves
- refers-to: app/core/forms.py :: LargeFormRequest, LargeFormRoute; app/routers/projects.py :: router, save, package, _manifest; app/core/config.py :: MAX_MANIFEST_BYTES
- kind: fix
- logged: v0.59.1 · 2026-11-26

The owner: saving is broken and stops at 1024 KB. The window sends a save as a form with the whole document as one text field (`manifest`) and each image as a file part. The web framework under the engine reads a form's text fields with a ceiling of 1024 KB each, and answers "Part exceeded maximum size of 1024KB." above it. File parts have no such ceiling, which is why images of any size went through and the document itself did not. Nothing in formpath set that number; `_manifest` has always allowed 64 MiB. A drawing with a few thousand objects is past 1024 KB of text.

Reproduced on the engine before the change: a document of 1,200 objects (659 KB of text) saved; one of 4,000 objects (2,199 KB) was refused with that sentence.

`LargeFormRoute` is the route class of the projects router. It hands each request to the route as a `LargeFormRequest`, whose `form()` reads fields up to twice `MAX_MANIFEST_BYTES`. The engine's own check in `_manifest` then decides, with its own sentence and status (413, "The document is too large.") at 64 MiB. The ceiling is twice the limit and not equal to it so that the engine's sentence is the one a person sees just past the limit, not the framework's. Save, both package routes and every other form in this router get the same reading; what the window sends does not change, so an older window and this engine still understand each other.

After the change, same engine, same test: 4,000 objects (2,199 KB) and 30,000 objects (16,652 KB) save, and the file read back holds the same document that was sent; 64 MiB and 10 bytes is refused with the engine's own sentence; the package route takes the 2,199 KB document.

Not changed here: where a project is saved. Save still writes into the library folder by name, and an export still goes to the exports folder. Choosing a place in the system's own file window, and saving again to that place, is the next change.
