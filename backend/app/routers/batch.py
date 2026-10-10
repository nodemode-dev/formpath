import json
import os
import re
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, File, Form, Request, Response, UploadFile

from app.core import config
from app.routers.mcp import _app_origin

router = APIRouter(tags=["batch"])
SAFE = re.compile(r"[^A-Za-z0-9 ._()\[\]+&,'@-]+")
SET_NAME = re.compile(r"^[^\\/:*?\"<>|\x00-\x1f]{1,80}$")
READABLE = {".fpth", ".svg", ".svgz", ".pdf", ".ai", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".csv", ".tsv", ".txt", ".json", ".xml", ".fpaction"}
WRITABLE = {".fpth", ".svg", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".csv", ".json", ".fpaction", ".zip"}
MAX = 512 * 1024 * 1024


def _refuse(status: int, text: str) -> Response:
    return Response(status_code=status, content=json.dumps({"detail": text}), media_type="application/json", headers={"Cache-Control": "no-store"})


def _json(data) -> Response:
    return Response(content=json.dumps(data), media_type="application/json", headers={"Cache-Control": "no-store"})


async def _body(request: Request) -> dict:
    try:
        body = json.loads(await request.body() or b"{}")
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _folder(raw, create: bool) -> Path:
    text = str(raw or "").strip()
    path = Path(os.path.expanduser(text))
    if not text or not path.is_absolute():
        raise ValueError("Give the folder as an absolute path, for example /Users/you/Documents/batch (~ works too).")
    if create:
        path.mkdir(parents=True, exist_ok=True)
    if not path.is_dir():
        raise ValueError(f"There is no folder at {path}.")
    return path


def _actions_dir() -> Path:
    d = config.data_dir() / "Actions"
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/api/actions/list")
async def actions_list(request: Request) -> Response:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can read the action library.")
    out = []
    for p in sorted(_actions_dir().glob("*.fpaction")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            out.append({"file": p.name, "set": data})
    return _json({"folder": str(_actions_dir()), "sets": out})


@router.post("/api/actions/save")
async def actions_save(request: Request) -> Response:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can write the action library.")
    body = await _body(request)
    name, data = str(body.get("name") or "").strip(), body.get("set")
    if not SET_NAME.match(name) or not isinstance(data, dict):
        return _refuse(422, "An action set needs a plain name (no slashes) and its actions.")
    raw = json.dumps(data, indent=1)
    if len(raw) > 16 * 1024 * 1024:
        return _refuse(413, "The action set is larger than 16 MiB.")
    target = _actions_dir() / f"{name}.fpaction"
    target.write_text(raw, encoding="utf-8")
    return _json({"path": str(target)})


@router.post("/api/actions/delete")
async def actions_delete(request: Request) -> Response:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can change the action library.")
    name = str((await _body(request)).get("name") or "").strip()
    if not SET_NAME.match(name):
        return _refuse(422, "Give the action set's name.")
    target = _actions_dir() / f"{name}.fpaction"
    if target.exists():
        target.unlink()
    return _json({"ok": True})


@router.post("/api/files/list")
async def files_list(request: Request) -> Response:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can list folders.")
    body = await _body(request)
    kinds = {str(k).lower() for k in (body.get("kinds") or [".fpth", ".svg", ".pdf"]) if str(k).lower() in READABLE}
    try:
        folder = _folder(body.get("folder"), False)
    except ValueError as exc:
        return _refuse(422, str(exc))
    entries = sorted(folder.iterdir(), key=lambda q: q.name.lower())
    files = [{"name": p.name, "path": str(p), "size": p.stat().st_size, "mtime": int(p.stat().st_mtime * 1000)} for p in entries if p.is_file() and p.suffix.lower() in kinds and not p.name.startswith(".")]
    dirs = [p.name for p in entries if p.is_dir() and not p.name.startswith(".")] if body.get("dirs") else []
    return _json({"folder": str(folder), "parent": str(folder.parent) if folder.parent != folder else "", "files": files, "dirs": dirs})


@router.post("/api/files/stat")
async def files_stat(request: Request) -> Response:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can check files.")
    raw = (await _body(request)).get("paths")
    if not isinstance(raw, list) or len(raw) > 2000:
        return _refuse(422, "Give up to 2000 absolute paths.")
    out = []
    for item in raw:
        path = Path(os.path.expanduser(str(item or "").strip()))
        try:
            st = path.stat() if path.is_absolute() and path.is_file() else None
        except OSError:
            st = None
        out.append({"path": str(item), "exists": st is not None, "size": st.st_size if st else 0, "mtime": int(st.st_mtime * 1000) if st else 0})
    return _json({"files": out})


@router.post("/api/files/read")
async def files_read(request: Request) -> Response:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can read files.")
    raw = str((await _body(request)).get("path") or "").strip()
    path = Path(os.path.expanduser(raw))
    if not raw or not path.is_absolute():
        return _refuse(422, "Give an absolute path (~ works too).")
    if path.suffix.lower() not in READABLE:
        return _refuse(422, f"{path.name}: formpth reads {', '.join(sorted(READABLE))} here.")
    if not path.is_file():
        return _refuse(404, f"There is no file at {path}.")
    st = path.stat()
    if st.st_size > MAX:
        return _refuse(413, f"{path.name} is larger than 512 MiB.")
    return Response(content=path.read_bytes(), media_type="application/octet-stream", headers={"Cache-Control": "no-store", "X-Formpth-Name": quote(path.name), "X-Formpth-Path": quote(str(path)), "X-Formpth-Size": str(st.st_size), "X-Formpth-Mtime": str(int(st.st_mtime * 1000))})


@router.post("/api/files/write")
async def files_write(request: Request, folder: str = Form(...), name: str = Form(...), file: UploadFile = File(...)) -> Response:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can write files.")
    clean = SAFE.sub("_", Path(name).name).strip(" .") or "output"
    if Path(clean).suffix.lower() not in WRITABLE:
        return _refuse(422, f"{clean}: formpth writes {', '.join(sorted(WRITABLE))} here.")
    try:
        target_dir = _folder(folder, True)
    except ValueError as exc:
        return _refuse(422, str(exc))
    except OSError as exc:
        return _refuse(422, f"Could not create the folder: {exc.strerror or exc}.")
    data = await file.read()
    if len(data) > MAX:
        return _refuse(413, "The file is larger than 512 MiB.")
    target = target_dir / clean
    try:
        target.write_bytes(data)
    except OSError as exc:
        return _refuse(422, f"Could not write {clean}: {exc.strerror or exc}.")
    return _json({"path": str(target), "bytes": len(data)})
