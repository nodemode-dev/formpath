import json
import mimetypes
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core import config
from app.core.local_guard import LocalGuard
from app.core.window_key import WindowKeyGuard
import asyncio

from app.routers import batch, claude_code, color, commands, fonts, io, llm, mcp, nodemode, outlines, plugins, projects, spell, system, terminal
from app.services import claude_code as claude_service, sessions
from app.services import terminal as terminals

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")


@asynccontextmanager
async def lifespan(_: FastAPI):
    sessions.prune()
    claude_service.sweep()
    terminals.bind(asyncio.get_running_loop())
    yield
    terminals.close_all()


class AsciiJSON(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=True, allow_nan=False, separators=(",", ":")).encode("ascii")


app = FastAPI(title=config.APP_NAME, version=config.VERSION, lifespan=lifespan, default_response_class=AsciiJSON)
app.add_middleware(CORSMiddleware, allow_origins=config.cors_origins(), allow_methods=["*"], allow_headers=["*"])
app.add_middleware(WindowKeyGuard)
app.add_middleware(LocalGuard, origins=config.window_origins())
app.include_router(system.router, prefix="/api")
app.include_router(projects.router, prefix="/api/projects")
app.include_router(fonts.router)
app.include_router(outlines.router)
app.include_router(io.router)
app.include_router(llm.router)
app.include_router(mcp.router)
app.include_router(plugins.router)
app.include_router(nodemode.router)
app.include_router(batch.router)
app.include_router(terminal.router)
app.include_router(claude_code.router)
app.include_router(commands.router)
app.include_router(spell.router)
app.include_router(color.router)

_dist = config.dist_dir()
if _dist is not None:
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")
