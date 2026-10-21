---
name: tool-catalog-author
description: Maintaining the formpath-harness pack when formpath's MCP tool catalogue changes. Load when a tool is added, renamed or given new parameters in backend/app/routers/mcp.py, when references/tools.md is out of date, when CI reports agents drift, or when a sub-skill names a tool that no longer exists.
---

# tool-catalog-author

## Purpose

Keep this pack true to the tools the server actually exposes. Hands back a regenerated tool reference and sub-skills that name only real tools.

## Preconditions

A formpath repository checkout with the engine installed (`./formpath install`).

## Procedure

1. Run `./formpath agents sync`. It regenerates `references/tools.md` at the pack root from the engine's catalogue and mirrors the pack to `.agents/skills/formpath-harness`. Never edit `references/tools.md` by hand.
2. For a new tool, add it to the group it belongs to in `setup/agents.py` (`GROUPS`), then sync again.
3. Find the sub-skill that owns its area (the routing table in the pack's `SKILL.md`) and add a step naming the tool exactly, with the parameters and the earlier step that supplies each value.
4. Search the sub-skills for every tool name and confirm each still appears in `references/tools.md`.
5. Run the god-tier validator on the pack and `./formpath agents sync --check`; both must pass.

## Gate

`./formpath agents sync --check` prints in step, and the validator reports no FAIL.

## Hands back

The regenerated reference, the edited sub-skills, and the validator output.
