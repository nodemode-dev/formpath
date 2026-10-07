# Agents and MCP

formpth's engine serves an MCP endpoint at `POST /mcp` (stateless JSON-RPC). `./formpth mcp` is a stdio bridge to it for Claude Code, Codex, Cursor and other clients, and starts the engine when it is not running.

```text
agent -> ./formpth mcp (stdio) -> POST /mcp -> window long-poll /api/mcp/bridge/next -> AgentBridge.run() -> engine
```

The tool runs in the open formpth window, against the same engine a person uses, so every change is one undo step and shows on the canvas. The first call asks the person once, in the window, to allow outside agents (Preferences > Plugins keeps the choice).

## Setup

- In this repository, `.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` already point at `./formpth mcp`.
- From anywhere else: `./formpth agents install` adds the server and the `formpth-harness` skill for Claude Code, Codex and Cursor.
- After changing `backend/app/routers/mcp.py`: `./formpth agents sync` regenerates the skill's `references/tools.md` and mirrors it to `.agents/skills`.

## Tools

66 tools in thirteen groups: looking (`get_document`, `get_image`, `get_svg`, `get_object`), files, selecting (with `select_similar`, the Magic Wand), drawing (with `edit_shape` for live shapes), paint and appearance (freeform fills, `color_harmony`), objects and layers, transform and align, path operations, effects and live objects (with the Effect Gallery's effects in `apply_effect`, `three_d`, `live_paint`, `gradient_mesh`, `symbolism`, `edit_pattern` and live tracing in `image_trace`), artboards, type (`set_text`, `text_flow` for threads and wrap, `text_style`, `find_font`, `create_outlines`), commands (`list_commands`, `run_command` for any menu command) and history. The harness skill's `references/tools.md` lists every parameter.
