import asyncio
import json

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.routers.terminal import origin_ok, require_local
from app.services import claude_code, terminal

router = APIRouter(prefix="/api/claude", tags=["claude"])


class OpenBody(BaseModel):
    prompt: str | None = Field(None, max_length=100_000)
    cols: int = Field(100, ge=10, le=500)
    rows: int = Field(30, ge=4, le=200)
    fresh: bool = False
    resume: str | None = Field(None, max_length=200)


class SendBody(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    context: str = Field("", max_length=20_000)
    note: str = Field("", max_length=200)


class AdoptBody(BaseModel):
    session: str = Field("", max_length=200)


class PrefsBody(BaseModel):
    claudeBin: str | None = Field(None, max_length=4096)
    claudeFolder: str | None = Field(None, max_length=4096)
    claudeFirstMessage: str | None = Field(None, max_length=20_000)


def _guard(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc).strip("'\""))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Claude Code could not start: {exc}")


@router.get("/status")
def status(request: Request) -> dict:
    require_local(request)
    return claude_code.status()


@router.post("/prefs")
def set_prefs(body: PrefsBody, request: Request) -> dict:
    require_local(request)
    return claude_code.save_prefs(body.model_dump(exclude_none=True))


@router.post("/open")
def open_tab(body: OpenBody, request: Request) -> dict:
    require_local(request)
    return _guard(claude_code.open_tab, body.prompt, body.cols, body.rows, body.fresh, body.resume)


@router.get("/chat")
def chat_state(request: Request) -> dict:
    require_local(request)
    return claude_code.chat_state()


@router.post("/chat/send")
def chat_send(body: SendBody, request: Request) -> dict:
    require_local(request)
    return _guard(claude_code.chat_send, body.text, body.context, body.note)


@router.post("/chat/cancel")
def chat_cancel(request: Request) -> dict:
    require_local(request)
    return claude_code.chat_cancel()


@router.post("/chat/reset")
def chat_reset(request: Request) -> dict:
    require_local(request)
    return claude_code.chat_reset()


@router.get("/chat/sessions")
def chat_sessions(request: Request) -> dict:
    require_local(request)
    return _guard(claude_code.chat_sessions)


@router.post("/chat/adopt")
def chat_adopt(body: AdoptBody, request: Request) -> dict:
    require_local(request)
    return _guard(claude_code.chat_adopt, body.session)


@router.get("/chat/image/{name}")
def chat_image(name: str, request: Request) -> FileResponse:
    require_local(request)
    path = claude_code.chat_image(name)
    if path is None:
        raise HTTPException(status_code=404, detail="There is no such picture.")
    return FileResponse(path)


@router.websocket("/chat/stream")
async def chat_stream(ws: WebSocket) -> None:
    if not origin_ok(ws.headers.get("origin"), ws.headers.get("host")):
        await ws.close(code=4403)
        return
    await ws.accept()
    terminal.bind(asyncio.get_running_loop())
    queue: asyncio.Queue = asyncio.Queue()
    claude_code.SUBSCRIBERS.add(queue)

    async def outbound() -> None:
        while True:
            await ws.send_text(json.dumps(await queue.get()))

    sender = asyncio.create_task(outbound())
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        sender.cancel()
        claude_code.SUBSCRIBERS.discard(queue)
