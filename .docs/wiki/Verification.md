# Verification

The repository carries no test files until the owner asks for them; `TEST_PLAN.md` in the planning sidecar describes what should be tested, written for someone with no context of the build.

What every change is checked against before it lands:

- `./formpath check`: typecheck and production build of the frontend, a compile and self-check of the engine.
- CI (`.github/workflows/ci.yml`): the frontend build, the engine boot and MCP probe, `./formpath agents sync --check`, shell syntax, and a scan for em dashes and emoji in tracked text.
- UI changes: a browser run with the CPU throttled four times or more and a slow network, hard reload, every touched path exercised, watching the moment of change. No layout shift, no rebuilt rows, no console errors.
- Agent changes: an MCP session that draws, paints, sets and outlines type, and exports SVG, PDF and a project, with the window asking once.
