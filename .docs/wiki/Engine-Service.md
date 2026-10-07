# Engine Service

`backend/` is a FastAPI service on 127.0.0.1:8230 (a free loopback port in the desktop app).

| Router | Purpose |
| --- | --- |
| `system` | health, version, capabilities |
| `projects` | the `.fpth` library: list, open, save with conflict copies, delete, package, import, the library folder |
| `fonts` | installed fonts: list, find by family and style, serve the file for outlines |
| `io` | writes what the window exports or saves for an agent to the absolute path the agent named |
| `mcp` | the MCP endpoint (`POST /mcp`), the tool catalogue and the bridge to the window |
| `llm` | the assistant's language model (Ollama or an OpenAI-compatible endpoint), keys in the system keyring |
| `plugins` | installed plugin scripts |
| `nodemode` | sending artwork to a NodeMode canvas |

`backend/.env` (never committed; `.env.example` is the template) sets `FORMPTH_HOST`, `FORMPTH_PORT`, `FORMPTH_DATA_DIR`, `FORMPTH_CORS_ORIGINS` and `FORMPTH_DIST`.
