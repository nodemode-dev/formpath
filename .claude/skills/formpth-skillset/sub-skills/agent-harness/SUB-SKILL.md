---
name: agent-harness
description: The formpth agent harness. Use for adding or changing an MCP tool, the TOOLS catalogue, the bridge from the engine service to the window, consent, the AgentBridge dispatch, run_command and list_commands, the assistant and plugins sharing the tools, ./formpth mcp, ./formpth agents install and sync, and the formpth-harness skill's generated tool reference.
---

# agent-harness

## Path of a call

```text
client -> setup/mcp_stdio.py (stdio) -> POST /mcp (backend/app/routers/mcp.py)
       -> queue -> window long-poll POST /api/mcp/bridge/next -> AgentBridge.run(name, args)
       -> engine -> result -> POST /api/mcp/bridge/result -> JSON-RPC response
```

The window bridge is private to the formpth window: it gets a secret from `POST /api/mcp/bridge/session` (issued only to formpth's own Origin) and sends it in `X-Formpth-Bridge` on every bridge call through `io/api.ts`. Never add a bridge endpoint that skips `_bridge_refusal`, and never make one a GET.

The first call queues `__consent__`; the window asks the person once and remembers the answer in Preferences. File tools (`open_file`, `save_project`, `export_file`, `place_image`) run in the backend, which calls the window's `__open`, `__place`, `__project` and `__export` and writes or reads the absolute path itself.

## Adding a tool

1. Add an entry to `TOOLS` in `mcp.py` with `_tool(name, description, properties, required, read=..., destructive=..., idempotent=...)`. Descriptions say what the tool does and what to call next; property descriptions give units and defaults.
2. Add the `case` in `AgentBridge.run` (`frontend/src/automation/agent-bridge.ts`). Validate arguments, throw `ToolError` with a message that tells the agent what to do, and make the change one engine edit so it is one undo step.
3. Add the name to a group in `setup/agents.py` (`GROUPS`), then run `./formpth agents sync`. CI runs `agents sync --check`.
4. Document it in the `formpth-harness` skill's sub-skill that owns its area.

## Rules

- Never rename a tool or parameter; add new ones.
- Coordinates are document points, origin at the first artboard's top-left, y down; rotation is degrees counter-clockwise for positive values.
- Plugins reach the same tools through `plugins/host.ts`, with file tools blocked; the assistant blocks them too.
