import json
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.core import config
from app.services import package as pkg
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
            found.append({"label": label, "base": str(path), "suggested": str(path / "Formpath")})
    return found


@router.get("/folder")
def folder() -> dict:
    current, default = config.projects_dir(), config.default_projects_dir()
    return {"folder": str(current), "default": str(default), "custom": current.resolve() != default.resolve(), "fixed": bool(os.environ.get("FORMPATH_LIBRARY_DIR", "").strip()), "synced": _synced()}


class FolderBody(BaseModel):
    folder: str = ""
    move: bool = False


@router.put("/folder")
def set_folder(body: FolderBody) -> dict:
    if os.environ.get("FORMPATH_LIBRARY_DIR", "").strip():
        raise HTTPException(status_code=409, detail="The library folder is set by FORMPATH_LIBRARY_DIR for this engine.")
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
        raise HTTPException(status_code=400, detail=f"formpath cannot write in that folder: {exc.strerror or exc}.") from exc
    moved = 0
    if body.move and new.resolve() != old.resolve():
        import shutil
        copies: list[tuple[Path, Path]] = []
        try:
            for src in sorted(old.glob(f"*{EXT}")):
                dst, n = new / src.name, 1
                while dst.exists():
                    dst = new / f"{src.stem} (moved{'' if n == 1 else f' {n}'}){src.suffix}"
                    n += 1
                copies.append((src, dst))
                shutil.copy2(src, dst)
                if dst.stat().st_size != src.stat().st_size:
                    raise OSError(f"{src.name} did not copy whole")
        except OSError as exc:
            for _, dst in copies:
                try:
                    dst.unlink(missing_ok=True)
                except OSError:
                    pass
            raise HTTPException(status_code=400, detail=f"{copies[-1][0].name if copies else 'A project'} could not be moved ({exc.strerror or exc}); nothing was moved.") from exc
        for src, _ in copies:
            try:
                src.unlink()
                moved += 1
            except OSError:
                pass
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


def _json_list(raw: str, what: str) -> list:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"The {what} list is not valid JSON.") from exc
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail=f"The {what} list must be a list.")
    return value


@router.post("/package-full")
def package_full(
    request: Request,
    name: str = Form(...),
    manifest: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    links: str = Form("[]"),
    fonts: str = Form("[]"),
    font_files: list[UploadFile] = File(default=[]),
    font_map: str = Form("{}"),
    report: str = Form(""),
    folder: str = Form(""),
    copy_links: bool = Form(True),
    copy_fonts: bool = Form(True),
    separate_links: bool = Form(True),
    relink_copies: bool = Form(False),
    as_zip: bool = Form(False),
) -> Response:
    host = request.client.host if request.client else ""
    served = (request.headers.get("host") or "").rsplit(":", 1)[0].strip("[]")
    if host not in ("127.0.0.1", "::1", "localhost", "testclient") or served not in ("127.0.0.1", "localhost", "::1", "tauri.localhost"):
        raise HTTPException(status_code=403, detail="Packaging reads files from this computer, so it only works from this computer.")
    data, assets = _manifest(manifest), _assets(files)
    _validated(data, assets)
    stem = pkg.clean(name)
    try:
        mapped = json.loads(font_map)
    except ValueError:
        mapped = {}
    bundled: dict[str, tuple[str, bytes]] = {}
    for upload in font_files[:32]:
        fname = Path(upload.filename or "").name
        key = mapped.get(fname) if isinstance(mapped, dict) else None
        blob = upload.file.read(config.MAX_ASSET_BYTES + 1)
        if key and pf.safe_name(fname) and len(blob) <= 64 * 1024 * 1024:
            bundled[str(key)] = (fname, blob)
    destination = None
    if not as_zip:
        base = Path(folder).expanduser() if folder.strip() else config.exports_dir()
        if not base.is_absolute():
            raise HTTPException(status_code=400, detail="Give the package folder's full path.")
        destination = base / f"{stem} Folder"
        if destination.exists():
            raise HTTPException(status_code=409, detail=f"{destination} already exists. Choose another folder or remove it first.")
    try:
        blob, summary = pkg.build(stem, data, assets, [str(x) for x in _json_list(links, "links")], [x for x in _json_list(fonts, "fonts") if isinstance(x, dict)], report, copy_links, copy_fonts, separate_links, relink_copies, destination, bundled)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"formpath could not write the package: {exc.strerror or exc}. Choose a folder you can write to.") from exc
    if blob is not None:
        return Response(blob, media_type="application/zip", headers={"X-Package-Summary": json.dumps({k: v for k, v in summary.items() if k != "files"})[:4000]})
    return Response(json.dumps(summary), media_type="application/json")


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
