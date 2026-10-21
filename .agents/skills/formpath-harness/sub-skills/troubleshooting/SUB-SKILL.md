---
name: troubleshooting
description: Recovering a formpath MCP session. Load when a formpath tool returns an error, a call hangs or times out, no formpath tools are listed, the window is asking for permission, ids are reported missing, a result looks wrong in get_image, or a multi-step build was interrupted.
---

# troubleshooting

## Purpose

Get the session working again without the person diagnosing anything, and leave the document in a known state. Hands back what failed, what was done, and whether the build can continue.

## Preconditions

None: load directly for any failure.

## Procedure

1. **No formpath tools listed**: the MCP server is not connected. Ask the person to run `./formpath mcp` setup (`./formpath agents install`) or check the client's MCP settings, then restart the client.
2. **A call waits, then fails with a consent message**: the formpath window is asking whether to allow outside agents. Tell the person to answer in the formpath window (Preferences > Plugins keeps the choice), then retry once.
3. **The engine is not answering**: formpath is not running. `./formpath mcp` starts it; otherwise ask the person to run `./formpath boot` and open http://localhost:5230.
4. **No window open**: tools run in the open formpath window; ask the person to open formpath in a browser or the desktop app.
5. **No object has the id**: ids changed (Pathfinder, expand, outlines, undo, or the person edited). Call `get_document`, match by name or bounds, retry.
6. **Nothing is selected**: pass `ids` or call `select` first.
7. **The art looks wrong**: `undo` the last step, re-read `get_object` for the numbers, and redo with corrected parameters. Never delete the person's own art to fix a mistake.
8. **Interrupted build**: compare the ledger with `get_document`; continue from the first planned element that is missing.
9. **Is it the skill or the server?** Call the failing tool directly with minimal arguments (for example `get_document`). If that fails too, the problem is the server or the connection, not the plan; follow `checklists/connection-gate.md`.

## Gate

A read-only call (`get_document`) succeeds and the ledger matches the document.

## Hands back

The failure, the fix, and whether to continue.

## Owned resources

- `checklists/connection-gate.md` the ordered connection checks.
