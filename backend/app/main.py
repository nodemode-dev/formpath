from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core import config
import asyncio

from app.routers import batch, claude_code, commands, fonts, io, llm, mcp, nodemode, plugins, projects, spell, system, terminal
from app.services import sessions
from app.services import terminal as terminals


@asynccontextmanager
async def lifespan(_: FastAPI):
    sessions.prune()
    terminals.bind(asyncio.get_running_loop())
    yield
    terminals.close_all()


app = FastAPI(title=config.APP_NAME, version=config.VERSION, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.cors_origins(), allow_methods=["*"], allow_headers=["*"])
app.include_router(system.router, prefix="/api")
app.include_router(projects.router, prefix="/api/projects")
app.include_router(fonts.router)
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

_dist = config.dist_dir()
if _dist is not None:
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")
