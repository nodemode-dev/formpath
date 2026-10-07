import io
import json
import re
import zipfile

from app.core import config

FORMAT = "com.nodemode.formpth"
SUPPORTED = {FORMAT: range(1, 2)}
SAFE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$")
KINDS = {"layer", "group", "path", "compound", "text", "image", "symbol", "blend", "envelope", "mesh", "repeat"}


class ProjectError(Exception):
    pass


def safe_name(name: str) -> bool:
    return bool(SAFE.match(name or "")) and ".." not in name


def _walk(nodes: list, files: set[str], seen: set[str], depth: int) -> int:
    if depth > config.MAX_DEPTH:
        raise ProjectError("Groups nest too deeply.")
    count = 0
    for node in nodes:
        if not isinstance(node, dict):
            raise ProjectError("An object record is invalid.")
        nid, kind = node.get("id"), node.get("kind")
        if not isinstance(nid, str) or not nid or nid in seen:
            raise ProjectError("An object id is missing or repeated.")
        if kind not in KINDS:
            raise ProjectError(f"An object has an unknown kind: {kind!r}.")
        seen.add(nid)
        count += 1
        if kind == "image":
            src = node.get("src")
            if not isinstance(src, str) or not safe_name(src):
                raise ProjectError("An image path is unsafe.")
            if src not in files:
                raise ProjectError(f"The image {src} is missing from the project.")
        for key in ("children", "content"):
            child = node.get(key)
            if child is not None:
                if not isinstance(child, list):
                    raise ProjectError("A group's contents are invalid.")
                count += _walk(child, files, seen, depth + 1)
        mask = node.get("mask")
        if isinstance(mask, dict) and isinstance(mask.get("art"), dict):
            count += _walk([mask["art"]], files, seen, depth + 1)
    return count


def validate(manifest: dict, files: set[str]) -> None:
    if not isinstance(manifest, dict):
        raise ProjectError("The manifest is not a JSON object.")
    fmt, version = manifest.get("format"), manifest.get("version")
    if fmt not in SUPPORTED:
        raise ProjectError("This is not a formpth project.")
    if not isinstance(version, int) or version not in SUPPORTED[fmt]:
        raise ProjectError(f"This project uses format version {version}, which this build cannot read.")
    doc = manifest.get("document")
    if not isinstance(doc, dict):
        raise ProjectError("The document is missing.")
    boards = doc.get("artboards")
    if not isinstance(boards, list) or not boards:
        raise ProjectError("The document has no artboards.")
    for board in boards:
        rect = board.get("rect") if isinstance(board, dict) else None
        if not (isinstance(rect, list) and len(rect) == 4 and all(isinstance(v, (int, float)) for v in rect)):
            raise ProjectError("An artboard is invalid.")
        if not (0 < rect[2] <= config.MAX_SIDE_PT and 0 < rect[3] <= config.MAX_SIDE_PT):
            raise ProjectError("An artboard is too large.")
    layers = doc.get("layers")
    if not isinstance(layers, list):
        raise ProjectError("The layer list is invalid.")
    symbols = doc.get("symbols") or []
    seen: set[str] = set()
    total = _walk(layers, files, seen, 0)
    for symbol in symbols if isinstance(symbols, list) else []:
        art = symbol.get("art") if isinstance(symbol, dict) else None
        if isinstance(art, dict):
            total += _walk([art], files, seen, 1)
    if total > config.MAX_NODES:
        raise ProjectError("The document has too many objects.")


def _collect(entries: list[tuple[str, int, callable]]) -> tuple[dict, dict[str, bytes], str]:
    manifest_entry, prefix = None, ""
    for path, size, read in entries:
        parts = path.replace("\\", "/").strip("/").split("/")
        if parts[-1] == "manifest.json" and len(parts) <= 2 and "__MACOSX" not in parts:
            manifest_entry, prefix = (path, size, read), ("/".join(parts[:-1]) + "/" if len(parts) == 2 else "")
            break
    if manifest_entry is None:
        raise ProjectError("manifest.json was not found in the project.")
    if manifest_entry[1] > config.MAX_MANIFEST_BYTES:
        raise ProjectError("The manifest is too large.")
    try:
        manifest = json.loads(manifest_entry[2]())
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ProjectError("The manifest is damaged.") from exc
    assets: dict[str, bytes] = {}
    for path, size, read in entries:
        clean = path.replace("\\", "/").strip("/")
        if not clean.startswith(prefix + "images/"):
            continue
        name = clean[len(prefix) + len("images/"):]
        if "/" in name or not safe_name(name):
            continue
        if size > config.MAX_ASSET_BYTES:
            raise ProjectError("An image in the project is larger than 512 MiB.")
        assets[name] = read()
    return manifest, assets, prefix.rstrip("/")


def read_zip(data: bytes) -> tuple[dict, dict[str, bytes]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ProjectError("The file is not a formpth package.") from exc
    with archive:
        infos = [info for info in archive.infolist() if not info.is_dir()]
        entries = [(info.filename, info.file_size, (lambda info=info: archive.read(info))) for info in infos]
        manifest, assets, _ = _collect(entries)
    return manifest, assets


def read_folder(files: list[tuple[str, bytes]]) -> tuple[dict, dict[str, bytes], str]:
    entries = [(path, len(data), (lambda data=data: data)) for path, data in files]
    return _collect(entries)


def write_zip(manifest: dict, assets: dict[str, bytes], root: str = "") -> bytes:
    prefix = f"{root}/" if root else ""
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr(f"{prefix}manifest.json", json.dumps(manifest, separators=(",", ":")), compress_type=zipfile.ZIP_DEFLATED)
        for name, data in assets.items():
            archive.writestr(f"{prefix}images/{name}", data)
    return out.getvalue()
