import json
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.core import config
from app.services import project_format as pf
from app.services import sessions

router = APIRouter(tags=["projects"])
NAME = re.compile(r"^[^/\\:*?\"<>|\x00-\x1f]{1,120}$")
EXT = ".fpth"
SUFFIXES = (EXT, ".zip")


def _library_path(name: str) -> Path:
    clean = name.strip()
    if not NAME.match(clean) or clean.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid project name.")
    return config.projects_dir() / f"{clean}{EXT}"


def _project_name(raw: str) -> str:
    name = Path(raw or "Untitled").name
    for suffix in SUFFIXES:
        if name.lower().endswith(suffix) and len(name) > len(suffix):
            name = name[: -len(suffix)]
    return name or "Untitled"


def _manifest(raw: str) -> dict:
    if len(raw.encode("utf-8")) > config.MAX_MANIFEST_BYTES:
        raise HTTPException(status_code=413, detail="The document is too large.")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="The document is not valid JSON.") from exc


def _assets(files: list[UploadFile]) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for upload in files:
        name = Path(upload.filename or "").name
        if not pf.safe_name(name):
            raise HTTPException(status_code=400, detail="Unsafe asset name.")
        data = upload.file.read()
        if len(data) > config.MAX_ASSET_BYTES:
            raise HTTPException(status_code=413, detail="An image is larger than 512 MiB.")
        out[name] = data
    return out


def _validated(manifest: dict, assets: dict[str, bytes]) -> None:
    try:
        pf.validate(manifest, set(assets))
    except pf.ProjectError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _version(path: Path) -> str:
    st = path.stat()
    return f"{st.st_mtime_ns}-{st.st_size}"


@router.get("")
def library() -> list[dict]:
    items = []
    for path in config.projects_dir().glob(f"*{EXT}"):
        stat = path.stat()
        items.append({"name": path.stem, "modified": stat.st_mtime, "size": stat.st_size})
    return sorted(items, key=lambda item: item["modified"], reverse=True)


@router.post("/save")
def save(name: str = Form(...), manifest: str = Form(...), files: list[UploadFile] = File(default=[]), base: str = Form("")) -> dict:
    target = _library_path(name)
    data, assets = _manifest(manifest), _assets(files)
    _validated(data, assets)
    conflict = bool(base) and target.is_file() and _version(target) != base
    if conflict:
        target = _library_path(f"{target.stem[:80]} (conflict {datetime.now().strftime('%Y-%m-%d %H.%M.%S')})")
    blob = pf.write_zip(data, assets)
    fd, tmp = tempfile.mkstemp(dir=target.parent, suffix=".tmp")
    with os.fdopen(fd, "wb") as handle:
        handle.write(blob)
    os.replace(tmp, target)
    out = {"name": target.stem, "path": str(target), "size": len(blob), "version": _version(target)}
    if conflict:
        out.update({"conflict": True, "kept": name.strip()})
    return out


def _synced() -> list[dict]:
    home, found = Path.home(), []
    cands = [("iCloud Drive", home / "Library/Mobile Documents/com~apple~CloudDocs"), ("Dropbox", home / "Dropbox"), ("OneDrive", Path(os.environ.get("OneDrive", str(home / "OneDrive")))), ("Google Drive", home / "Google Drive")]
    cloud = home / "Library/CloudStorage"
    if cloud.is_dir():
        for d in sorted(cloud.iterdir()):
            label = d.name.split("-")[0].replace("GoogleDrive", "Google Drive")
            cands.append((label, d / "My Drive" if (d / "My Drive").is_dir() else d))
    for label, path in cands:
        if path.is_dir() and not any(f["base"] == str(path) for f in found):
            found.append({"label": label, "base": str(path), "suggested": str(path / "Formpth")})
    return found


@router.get("/folder")
def folder() -> dict:
    current, default = config.projects_dir(), config.default_projects_dir()
    return {"folder": str(current), "default": str(default), "custom": current.resolve() != default.resolve(), "fixed": bool(os.environ.get("FORMPTH_LIBRARY_DIR", "").strip()), "synced": _synced()}


class FolderBody(BaseModel):
    folder: str = ""
    move: bool = False


@router.put("/folder")
def set_folder(body: FolderBody) -> dict:
    if os.environ.get("FORMPTH_LIBRARY_DIR", "").strip():
        raise HTTPException(status_code=409, detail="The library folder is set by FORMPTH_LIBRARY_DIR for this engine.")
    old = config.projects_dir()
    new = Path(body.folder).expanduser() if body.folder.strip() else config.default_projects_dir()
    if not new.is_absolute():
        raise HTTPException(status_code=400, detail="Give the folder's full path.")
    try:
        new.mkdir(parents=True, exist_ok=True)
        fd, probe = tempfile.mkstemp(dir=new, suffix=".tmp")
        os.close(fd)
        os.unlink(probe)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"formpth cannot write in that folder: {exc.strerror or exc}.") from exc
    moved = 0
    if body.move and new.resolve() != old.resolve():
        import shutil
        for src in sorted(old.glob(f"*{EXT}")):
            dst = new / src.name
            if dst.exists():
                dst = new / f"{src.stem} (moved){src.suffix}"
            shutil.copy2(src, dst)
            if dst.stat().st_size != src.stat().st_size:
                raise HTTPException(status_code=500, detail=f"{src.name} did not copy whole; nothing more was moved.")
            src.unlink()
            moved += 1
    settings = config.data_dir() / "library.json"
    if body.folder.strip():
        settings.write_text(json.dumps({"folder": str(new)}))
    else:
        settings.unlink(missing_ok=True)
    return {**folder(), "moved": moved}


@router.post("/package")
def package(manifest: str = Form(...), files: list[UploadFile] = File(default=[]), root: str = Form("")) -> Response:
    data, assets = _manifest(manifest), _assets(files)
    _validated(data, assets)
    if root and (not pf.safe_name(root) or root.startswith(".")):
        raise HTTPException(status_code=400, detail="Invalid package folder name.")
    return Response(pf.write_zip(data, assets, root), media_type="application/zip")


@router.get("/library/{name}")
def open_library(name: str) -> dict:
    path = _library_path(name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Project not found.")
    try:
        manifest, assets = pf.read_zip(path.read_bytes())
    except pf.ProjectError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _validated(manifest, assets)
    return {**sessions.payload(sessions.create(assets), manifest, assets, path.stem), "version": _version(path)}


@router.delete("/library/{name}")
def delete_library(name: str) -> dict:
    _library_path(name).unlink(missing_ok=True)
    return {"deleted": name}


@router.post("/import")
def import_project(files: list[UploadFile] = File(...), paths: list[str] = Form(default=[])) -> dict:
    try:
        if len(files) == 1 and not paths:
            manifest, assets = pf.read_zip(files[0].file.read())
            name = _project_name(files[0].filename or "")
        else:
            entries = [((paths[i] if i < len(paths) else "") or (upload.filename or ""), upload.file.read()) for i, upload in enumerate(files)]
            manifest, assets, root = pf.read_folder(entries)
            name = _project_name(root)
    except pf.ProjectError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _validated(manifest, assets)
    return sessions.payload(sessions.create(assets), manifest, assets, name)


@router.get("/session/{sid}/{filename}")
def session_asset(sid: str, filename: str) -> FileResponse:
    path = sessions.asset_path(sid, filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return FileResponse(path, media_type=sessions.media_type(filename))
