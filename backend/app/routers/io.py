import re
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core import config

router = APIRouter(prefix="/api/io", tags=["io"])
SAFE = re.compile(r"[^A-Za-z0-9 ._()-]+")
MAX = 512 * 1024 * 1024


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
