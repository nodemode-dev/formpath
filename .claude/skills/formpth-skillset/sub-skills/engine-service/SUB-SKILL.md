---
name: engine-service
description: The formpth FastAPI engine service in backend/. Use for the project library and .fpth packaging, conflict copies, the fonts service, file writes for agents, the assistant's language model and keys, plugins, sending to NodeMode, configuration and .env, ports, and the PyInstaller sidecar entry.
---

# engine-service

## Layout

- `app/main.py` mounts the routers and, when `FORMPTH_DIST` is set or a built frontend is bundled, serves it.
- `app/core/config.py`: ports (8230), data folders (`~/Formpth`), CORS, limits; `.env` read from `backend/.env`.
- Routers: `system` (health, version, capabilities), `projects` (library, save with conflict copies, package, import), `fonts` (list, find, file), `io` (write exports for agents), `mcp` (catalogue and bridge), `llm` (assistant model, keys in the keyring), `plugins`, `nodemode`.
- `formpth_engine.py`: the desktop sidecar entry; `--selfcheck` prints the versions and tool count as JSON.

## Rules

- Bind to 127.0.0.1 only. Never log keys or file contents.
- Every error a person or agent sees says what to do next.
- New dependencies are vetted for licence before they are added and recorded in `NOTICE.md`.
- After a change: `python -m compileall -q app formpth_engine.py`, `python formpth_engine.py --selfcheck`, then boot and probe `/api/health`.
