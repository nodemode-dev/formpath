import difflib
import json

from fastapi import APIRouter, HTTPException, Request

from app.core import config
from app.routers import mcp
from app.routers.terminal import require_local
from app.services import claude_code

router = APIRouter(prefix="/api/commands", tags=["commands"])

_state: dict = {"commands": None}


def _file():
    return config.data_dir() / "commands-catalogue.json"


def _catalogue() -> list[dict]:
    if _state["commands"] is None:
        try:
            data = json.loads(_file().read_text(encoding="utf-8"))
            _state["commands"] = data.get("commands") if isinstance(data, dict) else None
        except (OSError, ValueError):
            _state["commands"] = None
    return _state["commands"] or []


def _missing() -> HTTPException:
    return HTTPException(status_code=503, detail="The command catalogue arrives when the formpth window opens; open formpth (./formpth boot) and retry.")


@router.post("/catalogue")
async def mirror(request: Request) -> dict:
    require_local(request)
    body = await request.json()
    commands = body.get("commands") if isinstance(body, dict) else None
    if not isinstance(commands, list):
        raise HTTPException(status_code=422, detail="commands must be a list")
    _state["commands"] = commands
    try:
        _file().write_text(json.dumps({"size": len(commands), "commands": commands}), encoding="utf-8")
    except OSError:
        pass
    return {"size": len(commands)}


@router.get("")
def listing(request: Request, group: str = "", text: str = "") -> dict:
    require_local(request)
    rows = _catalogue()
    if not rows:
        raise _missing()
    g, needle = group.lower(), text.lower()
    shown = [r for r in rows if (not g or str(r.get("group", "")).lower() == g)
             and (not needle or needle in str(r.get("id", "")) or needle in str(r.get("label", "")).lower() or needle in str(r.get("path", "")).lower())]
    groups = sorted({str(r.get("group", "")) for r in rows})
    return {"size": len(rows), "shown": len(shown), "groups": groups, "live": mcp._live(), "commands": shown}


@router.get("/{cid}")
def describe(cid: str, request: Request) -> dict:
    require_local(request)
    rows = _catalogue()
    if not rows:
        raise _missing()
    found = next((r for r in rows if r.get("id") == cid), None)
    if found is None:
        ids = [str(r.get("id")) for r in rows]
        raise HTTPException(status_code=404, detail={"error": f"There is no command {cid}.", "suggestions": difflib.get_close_matches(cid, ids, n=8, cutoff=0.5)})
    return found


@router.post("/{cid}")
async def run(cid: str, request: Request) -> dict:
    require_local(request)
    try:
        params = await request.json()
    except ValueError:
        params = {}
    if not isinstance(params, dict):
        raise HTTPException(status_code=422, detail="the body must be a JSON object of parameters")
    token = mcp._inapp.set(claude_code.is_inapp(request.headers.get(claude_code.INAPP_HEADER)))
    try:
        out = await mcp._call("run_command", {"id": cid, **({"params": params} if params else {})})
    finally:
        mcp._inapp.reset(token)
    texts = [c.get("text", "") for c in out.get("content", []) if isinstance(c, dict)]
    if out.get("isError"):
        raise HTTPException(status_code=409, detail=" ".join(texts) or "The command did not run.")
    return {"ok": True, "command": cid, "message": " ".join(texts), "result": out.get("structuredContent")}
