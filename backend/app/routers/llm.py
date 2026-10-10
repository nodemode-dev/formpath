
from fastapi import APIRouter, Form, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from app.services import llm

router = APIRouter(prefix="/api/llm", tags=["llm"])


def _run(fn, *args):
    try:
        return fn(*args)
    except llm.LlmError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


@router.get("/status")
def status() -> dict:
    return llm.status()


@router.post("/settings")
def settings(base_url: str = Form(...), model: str = Form(...), key: str | None = Form(None), forget_key: bool = Form(False), vision: bool | None = Form(None)) -> dict:
    return _run(llm.save, base_url, model, key, forget_key, vision)


@router.post("/generate")
async def generate(request: Request) -> dict:
    try:
        body = await request.json()
    except ValueError as exc:
        raise HTTPException(400, "Send the request as JSON.") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "Send the request as a JSON object.")
    return await run_in_threadpool(_run, llm.generate, str(body.get("system") or ""), str(body.get("prompt") or ""), body.get("image"), body.get("temperature", 0.8), body.get("max_tokens", 6000))


@router.get("/models")
async def models() -> dict:
    return {"models": await run_in_threadpool(_run, llm.models)}


@router.post("/chat")
async def chat(request: Request) -> dict:
    from app.routers.mcp import TOOLS
    body = await request.json()
    tools = [{"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["inputSchema"]}} for t in TOOLS] if body.get("tools", True) else []
    return await run_in_threadpool(_run, llm.chat, body.get("messages"), tools)


@router.post("/improve")
async def improve(prompt: str = Form(...), instructions: str = Form("")) -> dict:
    return {"prompt": await run_in_threadpool(_run, llm.improve, prompt, instructions)}
