import hashlib
import os
import struct
import sys
import threading
from pathlib import Path

EXTS = {".ttf", ".otf", ".ttc", ".otc"}
_lock = threading.Lock()
_index: dict[str, dict] = {}
_stamp: tuple = ()


def _dirs() -> list[Path]:
    home = Path.home()
    if sys.platform == "darwin":
        return [Path("/System/Library/Fonts"), Path("/System/Library/Fonts/Supplemental"), Path("/Library/Fonts"), home / "Library/Fonts"]
    if os.name == "nt":
        windir = Path(os.environ.get("WINDIR", "C:\\Windows"))
        local = Path(os.environ.get("LOCALAPPDATA", str(home / "AppData/Local")))
        return [windir / "Fonts", local / "Microsoft/Windows/Fonts"]
    return [Path("/usr/share/fonts"), Path("/usr/local/share/fonts"), home / ".fonts", home / ".local/share/fonts"]


def _decode(raw: bytes, platform: int) -> str:
    try:
        return raw.decode("utf-16-be" if platform in (0, 3) else "mac_roman").strip("\x00").strip()
    except UnicodeDecodeError:
        return ""


def _names(data: bytes, base: int) -> dict[int, str]:
    num = struct.unpack_from(">H", data, base + 4)[0]
    for i in range(num):
        tag, _, offset, _ = struct.unpack_from(">4sIII", data, base + 12 + i * 16)
        if tag != b"name":
            continue
        _, count, strings = struct.unpack_from(">HHH", data, offset)
        found: dict[int, tuple[int, str]] = {}
        for j in range(count):
            platform, encoding, language, name_id, length, start = struct.unpack_from(">HHHHHH", data, offset + 6 + j * 12)
            if name_id not in (1, 2, 4, 6, 16, 17):
                continue
            text = _decode(data[offset + strings + start: offset + strings + start + length], platform)
            if not text:
                continue
            rank = 3 if platform == 3 and language in (0x409, 0) else 2 if platform == 3 else 1 if platform == 0 else 0
            if name_id not in found or rank > found[name_id][0]:
                found[name_id] = (rank, text)
        return {k: v[1] for k, v in found.items()}
    return {}


def _members(path: Path) -> list[tuple[int, dict[int, str]]]:
    try:
        data = path.read_bytes()
    except OSError:
        return []
    try:
        if data[:4] == b"ttcf":
            count = struct.unpack_from(">I", data, 8)[0]
            offsets = struct.unpack_from(f">{count}I", data, 12)
            return [(i, _names(data, off)) for i, off in enumerate(offsets)]
        return [(0, _names(data, 0))]
    except struct.error:
        return []


def _scan() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for root in _dirs():
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if path.suffix.lower() not in EXTS or not path.is_file():
                continue
            for member, names in _members(path):
                family = names.get(16) or names.get(1)
                style = names.get(17) or names.get(2) or "Regular"
                if not family or family.startswith("."):
                    continue
                key = hashlib.sha1(f"{path}#{member}".encode()).hexdigest()[:16]
                out[key] = {"id": key, "family": family, "style": style, "full": names.get(4, f"{family} {style}"), "postscript": names.get(6, ""), "path": str(path), "member": member}
    return out


def index() -> dict[str, dict]:
    global _index, _stamp
    stamp = tuple((str(d), d.stat().st_mtime) for d in _dirs() if d.is_dir())
    with _lock:
        if stamp != _stamp or not _index:
            _index, _stamp = _scan(), stamp
        return _index


def listing() -> list[dict]:
    fonts = sorted(index().values(), key=lambda f: (f["family"].lower(), f["style"].lower()))
    return [{k: f[k] for k in ("id", "family", "style", "full", "postscript")} for f in fonts]


def _extract(data: bytes, member: int) -> bytes:
    if data[:4] != b"ttcf":
        return data
    base = struct.unpack_from(">I", data, 12 + member * 4)[0]
    flavor, num = struct.unpack_from(">IH", data, base)
    records = [struct.unpack_from(">4sIII", data, base + 12 + i * 16) for i in range(num)]
    head = bytearray(data[base: base + 12])
    body = bytearray()
    table_dir = bytearray()
    start = 12 + num * 16
    for tag, checksum, offset, length in records:
        table_dir += struct.pack(">4sIII", tag, checksum, start + len(body), length)
        body += data[offset: offset + length]
        body += b"\x00" * ((4 - len(body) % 4) % 4)
    return bytes(head + table_dir + body)


def font_file(font_id: str) -> tuple[bytes, str] | None:
    entry = index().get(font_id)
    if not entry:
        return None
    try:
        data = Path(entry["path"]).read_bytes()
    except OSError:
        return None
    return _extract(data, entry["member"]), entry["postscript"] or entry["full"]


def find(family: str, style: str = "Regular") -> dict | None:
    want_f, want_s = family.strip().lower(), (style or "Regular").strip().lower()
    candidates = [f for f in index().values() if f["family"].lower() == want_f]
    if not candidates:
        return None
    exact = [f for f in candidates if f["style"].lower() == want_s]
    if exact:
        return exact[0]
    regular = [f for f in candidates if f["style"].lower() in ("regular", "book", "roman", "normal")]
    return (regular or candidates)[0]
