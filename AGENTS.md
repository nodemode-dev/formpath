# formpath

A vector illustration editor for the web and the desktop, the vector member of the form family: vanilla TypeScript and Vite frontend, Python and FastAPI engine service, Tauri 2 shell. Two kinds of work happen here; pick the one the person asked for.

## Drawing (natural language)

When the person wants artwork made or changed (a poster, a logo, an icon, a diagram, type set and outlined, colours changed, shapes combined, files opened, saved or exported), use the `formpath` MCP server's tools, guided by the `formpath-harness` skill in `.agents/skills/formpath-harness` (its `references/tools.md` lists every tool). Start with `get_document` and `get_image`, and check each change with `get_image`.

The MCP server is configured for this repository in `.codex/config.toml` (Codex) and `.cursor/mcp.json` (Cursor); both run `./formpath mcp`, which starts the formpath engine when it is not running. From any other folder, `./formpath agents install` sets Claude Code, Codex and Cursor up for the user account. The first call asks the person once, in the formpath window, to allow outside agents; every tool error says what to do next.

## Changing formpath's code

Read `CLAUDE.md` and `.claude/skills/formpath-skillset/SKILL.md` first: they map the subsystems, the laws that apply everywhere, and the specialist sub-skills. After changing the MCP tools in `backend/app/routers/mcp.py`, run `./formpath agents sync` so the harness skill's tool reference and its mirror follow; CI fails until you do.
