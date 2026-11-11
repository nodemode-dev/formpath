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

## oc_install

### oc_install · Python on Windows and the venv layout
- refers-to: oc_install :: PY, act
- kind: decision
- logged: v0.52.7 · 2026-10-30

formcompiler runs `./formpath install` in Git Bash on its Windows runner, where setup-python provides `python` (and `py`) and `python3` may not exist, so the candidate list tried only python3.14 to python3 and stopped with "Python 3.12 or newer is required". `python` is now the last candidate, the same list as `setup/lib.sh :: fp_python` and formpdf and formtxt; the version check still refuses an older one. The activate script is `venv/bin/activate` on macOS and Linux and `venv/Scripts/activate` on Windows; the script now picks whichever exists and stops with a message when neither does (a half-made venv), instead of a bare `source` error. Found by the family builds audit of 2026-10-30.

## app/core/config.py

### app/core/config.py · ports and folders
- refers-to: app/core/config.py :: BACKEND_PORT, data_dir, projects_dir
- kind: rationale
- logged: v0.9.0 · 2026-10-07

8230 so formpath runs beside formvis (8190). Data lives in `~/Formpath` unless `FORMPATH_DATA_DIR` is set; the library folder can be moved (`FORMPATH_LIBRARY_DIR`, or `library.json` written by the app), including into a synced folder.

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
