# Agents and MCP

formpath's engine serves an MCP endpoint at `POST /mcp` (stateless JSON-RPC). `./formpath mcp` is a stdio bridge to it for Claude Code, Codex, Cursor and other clients, and starts the engine when it is not running.

```text
agent -> ./formpath mcp (stdio) -> POST /mcp -> window long-poll POST /api/mcp/bridge/next -> AgentBridge.run() -> engine
```

The tool runs in the open formpath window, against the same engine a person uses, so every change is one undo step and shows on the canvas. The first call asks the person once, in the window, to allow outside agents (Preferences > Plugins keeps the choice).

The window side of the bridge is private to the formpath window. On load the window asks `POST /api/mcp/bridge/session` for a secret, which the engine gives only to a request whose Origin is formpath's own page (the Vite dev and preview origins on 5230 and 5231, or the engine's own loopback origin, which is also the desktop app's main window). Every bridge call (`next`, `result`, `stop`) is a POST carrying the secret in `X-Formpath-Bridge` from that Origin; anything else is refused with 403, a GET of `next` with 405. Only the window holding the newest secret receives queued calls, and a result is accepted only from the window the call was handed to. `POST /mcp` itself is unchanged and needs no secret.

## Setup

- In this repository, `.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` already point at `./formpath mcp`.
- From anywhere else: `./formpath agents install` adds the server and the `formpath-harness` skill for Claude Code, Codex and Cursor.
- After changing `backend/app/routers/mcp.py`: `./formpath agents sync` regenerates the skill's `references/tools.md` and mirrors it to `.agents/skills`.

## Tools

67 tools in thirteen groups: looking (`get_document`, `get_image`, `get_svg`, `get_object`), files, selecting (with `select_similar`, the Magic Wand), drawing (with `edit_shape` for live shapes), paint and appearance (freeform fills, `color_harmony`, `graphic_style` with linked styles and built-in libraries), objects and layers (with `attributes` for fill rules, path direction and notes), transform and align, path operations, effects and live objects (with the Effect Gallery's effects in `apply_effect`, `three_d` with Map Art and shadows, `live_paint`, `gradient_mesh`, `symbolism`, `edit_pattern` and live tracing in `image_trace`), artboards, type (`set_text`, `text_flow` for threads and wrap, `text_style`, `find_font`, `create_outlines`), commands (`list_commands`, `run_command` for any menu command) and history. The harness skill's `references/tools.md` lists every parameter.
