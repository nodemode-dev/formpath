import re
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse

from app.core import config
from app.services import dwg

router = APIRouter(prefix="/api/io", tags=["io"])
SAFE = re.compile(r"[^A-Za-z0-9 ._()-]+")
MAX = 512 * 1024 * 1024


def _local(request: Request) -> None:
    host = request.client.host if request.client else ""
    served = (request.headers.get("host") or "").rsplit(":", 1)[0].strip("[]")
    if host not in ("127.0.0.1", "::1", "localhost", "testclient") or served not in ("127.0.0.1", "localhost", "::1", "tauri.localhost"):
        raise HTTPException(status_code=403, detail="DWG conversion runs a program on this computer, so it only works from this computer.")


@router.get("/dwg/converters")
def dwg_converters(request: Request) -> dict:
    _local(request)
    return {"converters": dwg.converters()}


@router.post("/dwg/to-dxf")
def dwg_to_dxf(request: Request, file: UploadFile = File(...)) -> PlainTextResponse:
    _local(request)
    data = file.file.read()
    if len(data) > MAX:
        raise HTTPException(status_code=413, detail="The drawing is larger than 512 MiB.")
    try:
        text, used = dwg.to_dxf(data)
    except dwg.DwgError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return PlainTextResponse(text, headers={"X-Converter": used})


@router.post("/export")
def export(name: str = Form(...), file: UploadFile = File(...)) -> dict:
    clean = SAFE.sub("_", Path(name).name).strip(" .") or "export"
    data = file.file.read()
    if len(data) > MAX:
        raise HTTPException(status_code=413, detail="The export is larger than 512 MiB.")
    folder = config.exports_dir()
    target = folder / clean
    stem, suffix, n = target.stem, target.suffix, 1
    while target.exists():
        n += 1
        target = folder / f"{stem} {n}{suffix}"
    target.write_bytes(data)
    return {"path": str(target), "bytes": len(data)}
