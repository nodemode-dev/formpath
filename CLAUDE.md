# formpth

Vector illustration editor for the web and the desktop in the NodeMode design system, the Illustrator alternative in the form family: vanilla TypeScript and Vite frontend, Python and FastAPI engine service, Tauri 2 shell.

## Repo layout notes

- `assets/` is repo-level art (the README logo and the desktop icon source). It is not app runtime assets: runtime files live in `frontend/public/` and `frontend/src/`.
- `frontend/src/engine/` is the document engine and never touches the DOM. UI code lives in `frontend/src/ui/`; tools live in `frontend/src/tools/` and register through `frontend/src/extensions/registry.ts`; file formats live in `frontend/src/io/`.
- `frontend/src/automation/agent-bridge.ts` runs every MCP tool against the engine; `backend/app/routers/mcp.py` holds the tool catalogue (`TOOLS`).
- `backend/formpth_engine.py` is the PyInstaller entry for the desktop sidecar, not a dev server. Use `./formpth backend` or `./formpth boot` for development.
- `src-tauri/binaries/` receives the frozen engine from `setup/freeze_backend`; git ignores it.
- Planning documents (DEV_PLAN, BUILD_NOTES, TEST_PLAN, the root HASHOUT_LOG) ship in the planning sidecar zip, not in this tree. The living logs `frontend/HASHOUT_LOG.md` and `backend/HASHOUT_LOG.md` are in the tree: read them before editing.

## Skills

- `formpth-skillset` · the orchestrator for changing formpth's code: engine, tools, UI shell, file formats, engine service, harness, desktop builds and verification. Route through its `SKILL.md` routing table to the specialist `SUB-SKILL.md`.
- `formpth-harness` · the skill pack for drawing in formpth through its MCP server: looking, drawing, paint, type, effects, files, troubleshooting.

Always route code work through `.claude/skills/formpth-skillset/SKILL.md` first: it maps the subsystems, the dependency graph and the laws, and loads the right references.

## Drawing through formpth

When the person wants artwork made or changed (a poster, an icon, a logo, a diagram, an illustration, a layout, an export), use the `formpth` MCP server's tools with the `formpth-harness` skill (`.claude/skills/formpth-harness`), not formpth's source code. `.mcp.json` starts it (`./formpth mcp`, which starts the engine if it is not running); the first call asks the person once, in the formpth window, to allow outside agents. After changing the MCP tools in `backend/app/routers/mcp.py`, run `./formpth agents sync` so the skill's tool reference and its `.agents/skills` mirror follow (CI fails until you do).
