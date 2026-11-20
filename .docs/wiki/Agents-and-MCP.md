# Agents and MCP

formpath's engine serves an MCP endpoint at `POST /mcp` (stateless JSON-RPC). `./formpath mcp` is a stdio bridge to it for Claude Code, Codex, Cursor, Antigravity and other clients, and starts the engine when it is not running.

```text
agent -> ./formpath mcp (stdio) -> POST /mcp -> window long-poll POST /api/mcp/bridge/next -> AgentBridge.run() -> engine
```

The tool runs in the open formpath window, against the same engine a person uses, so every change is one undo step and shows on the canvas. The first call asks the person once, in the window ("Allow an outside agent to edit?", with the buttons Don't and Allow); until the person answers, the agent's call waits. The Preferences > Plugins checkbox "Allow outside agents (MCP)" keeps the choice, and the person can turn it off there at any time. Only formpath's own window can change that choice, open or type into a terminal, or change which program Claude Code runs as: the desktop app hands the window a key when it starts the engine, and every write the window makes carries it. Running from source, the page claims the key once from the engine, which is a weaker arrangement because any program on the computer could claim it first. The command line (`./formpath cli`) is an outside agent like any other: it follows the choice and cannot change it. Plug-ins run in sandboxed frames, ask the page to run their tool calls, and never receive the key.

The window side of the bridge is private to the formpath window. On load the window asks `POST /api/mcp/bridge/session` for a secret, which the engine gives only to a request whose Origin is formpath's own page (the Vite dev and preview origins on 5230 and 5231, or the engine's own loopback origin, which is also the desktop app's main window). Every bridge call (`next`, `result`, `stop`) is a POST carrying the secret in `X-Formpath-Bridge` from that Origin; anything else is refused with 403, a GET of `next` with 405. Only the window holding the newest secret receives queued calls, and a result is accepted only from the window the call was handed to. `POST /mcp` itself is unchanged and needs no secret.

## Setup

- In this repository, `.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` already point at `./formpath mcp`.
- From anywhere else: `./formpath agents install` adds the server and the `formpath-harness` skill for Claude Code, Codex and Cursor, and the server for Antigravity (in `~/.gemini/config/mcp_config.json`).
- After changing `backend/app/routers/mcp.py`: `./formpath agents sync` regenerates the skill's `references/tools.md`, mirrors the skills to `.agents/skills` and writes `agents/manifest.json`, the file that lists the tools, the read-only tools, the tools that need the person's Allow, the skills and the transports for other family programs to read. `./formpath agents sync --check` fails when any of them is out of date.

## Tools

93 tools in sixteen groups: looking (`get_document`, `get_image`, `get_svg`, `get_object`), files, selecting (with `select_similar`, the Magic Wand), drawing (with `edit_shape` for live shapes), paint and appearance (freeform fills, `color_harmony`, `graphic_style` with linked styles and built-in libraries), objects and layers (with `attributes` for fill rules, path direction and notes), transform and align, path operations, effects and live objects (with the Effect Gallery's effects in `apply_effect`, `three_d` with Map Art and shadows, `live_paint`, `gradient_mesh`, `symbolism`, `edit_pattern` and live tracing in `image_trace`), artboards, type (`set_text`, `text_flow` for threads and wrap, `text_style`, `find_font`, `create_outlines`), colour management (`list_color_profiles`, `convert_to_profile`, `proof_colors`), generative (`generative_shape_fill`, `text_to_vector`), graphs and data (`graph`, `variables`), commands (`list_commands`, `run_command` for any menu command) and history. The harness skill's `references/tools.md` lists every parameter.
