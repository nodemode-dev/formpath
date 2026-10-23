---
name: formpath-skillset
description: Use when changing formpath's code, the NodeMode-styled vector illustration editor of the form family for the web and the desktop. Add a tool, fix the Layers panel, change Pathfinder, open or export SVG and PDF, add an MCP tool, build the desktop app. Covers the document engine, paths, anchors, appearance stacks, gradients, effects, type and outlines, the tool registry, the stage, panels, menus, dialogs, themes, zero-flash UI, the .fpth format, the FastAPI engine service, the MCP harness and the Tauri shell.
---

# formpath-skillset

Route every formpath code task through this file first. It maps the subsystems, states the laws that apply everywhere, and names the specialist to load. For drawing in formpath (not changing its code), use the `formpath-harness` skill instead.

## Subsystem map

| Subsystem | Root | Specialist |
| --- | --- | --- |
| Document engine | `frontend/src/engine/` | `sub-skills/engine-core/SUB-SKILL.md` |
| Tools | `frontend/src/tools/`, `frontend/src/extensions/registry.ts` | `sub-skills/tool-author/SUB-SKILL.md` |
| UI shell | `frontend/src/app.ts`, `frontend/src/ui/`, `frontend/src/styles/` | `sub-skills/ui-shell/SUB-SKILL.md` |
| File formats | `frontend/src/io/` (project, SVG, PDF, raster, trace, fonts) | `sub-skills/file-formats/SUB-SKILL.md` |
| Engine service | `backend/app/`, `backend/formpath_engine.py` | `sub-skills/engine-service/SUB-SKILL.md` |
| Agent harness | `backend/app/routers/mcp.py`, `frontend/src/automation/agent-bridge.ts`, `setup/agents.py`, `setup/mcp_stdio.py` | `sub-skills/agent-harness/SUB-SKILL.md` |
| Desktop | `src-tauri/`, `setup/freeze_backend` (releases are built by formcompiler) | `sub-skills/desktop-shell/SUB-SKILL.md` |
| Verification | a procedure, no repo code | `sub-skills/ui-verification/SUB-SKILL.md` |

## Dependency graph

```text
tools          -> engine, registry
UI shell       -> engine, tools (registry), io
io             -> engine (types), engine service over HTTP /api
agent bridge   -> engine, io (export, outlines, trace)
plugins        -> agent bridge (file tools blocked)
desktop shell  -> frozen engine service (sidecar) -> serves the built frontend
```

The engine imports nothing from `ui`, `io`, `tools` or `automation`. Tools import only the engine, the registry and `ui/cursors.ts` and `ui/text-editor.ts` for the type tools. The frontend reaches the engine service only through `frontend/src/io/api.ts`.

## Laws for every change

1. SEDO: single-region hand edits. Never patch, diff, sed or codemod a tracked file.
2. Zero DOM flash, flicker or re-render: render once, then patch in place with `patchList` and the guarded setters in `ui/dom.ts`; reserve space before content arrives. Every UI change passes `ui-verification`.
3. Colours and z-index come from tokens in `styles/tokens.css`; icons come from `ui/icons.ts` and `ui/icons-vector.ts` as hand-drawn `currentColor` SVG; no icon libraries.
4. No emoji, no U+2014 em dash (use the interpunct), near-zero comments. Decisions and removed code go in `frontend/HASHOUT_LOG.md` or `backend/HASHOUT_LOG.md` in the same turn.
5. Versions are `v*.*.*` with dots and are bumped together, see `.docs/BRANCHING.md`. Commits are Conventional Commits as `nodemode-ai`.
6. No self-authored tests. Behaviour to test goes in the planning sidecar's `TEST_PLAN.md`.
7. Compatibility: never rename a manifest field, an MCP tool name or parameter, or a command id; add new ones beside them.

## Routing table

| Task | Load |
| --- | --- |
| Add or change a tool, its options, cursor or keys | `tool-author`, then `engine-core` if it needs a new operation |
| A new node kind, path operation, appearance item, effect, history or render change | `engine-core` |
| Panels, menus, commands, dialogs, shortcuts, styles, themes, the stage overlay | `ui-shell`, then `ui-verification` |
| `.fpth`, SVG, PDF, PNG, JPEG, WebP, Export for Screens, image trace, fonts and outlines | `file-formats` |
| Library, fonts service, file writes, assistant model, plugins, NodeMode send | `engine-service` |
| An MCP tool, the bridge, consent, `./formpath mcp`, `./formpath agents` | `agent-harness` |
| Desktop app, sidecar, icons, release workflow | `desktop-shell` |
| Before handing back any UI change | `ui-verification` |

## Start of every session

Read `frontend/HASHOUT_LOG.md` and `backend/HASHOUT_LOG.md`, then the planning sidecar (`DEV_PLAN.md`, `BUILD_NOTES.md`), then open only the files the task names.
