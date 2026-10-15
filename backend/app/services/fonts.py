import hashlib
import os
import re
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
    dirs = [Path("/usr/share/fonts"), Path("/usr/local/share/fonts"), home / ".fonts", home / ".local/share/fonts"]
    for conf in [Path("/etc/fonts/fonts.conf"), *sorted(Path("/etc/fonts/conf.d").glob("*.conf"))]:
        try:
            text = conf.read_text(errors="ignore")
        except OSError:
            continue
        for m in re.finditer(r"<dir(?:\s[^>]*)?>([^<]+)</dir>", text):
            p = Path(os.path.expanduser(m.group(1).strip()))
            if p.is_absolute() and p not in dirs and not any(d in p.parents for d in dirs):
                dirs.append(p)
    return dirs


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


def _has_table(data: bytes, base: int, want: bytes) -> bool:
    num = struct.unpack_from(">H", data, base + 4)[0]
    return any(struct.unpack_from(">4s", data, base + 12 + i * 16)[0] == want for i in range(num))


def _members(path: Path) -> list[tuple[int, dict[int, str], bool]]:
    try:
        data = path.read_bytes()
    except OSError:
        return []
    try:
        if data[:4] == b"ttcf":
            count = struct.unpack_from(">I", data, 8)[0]
            offsets = struct.unpack_from(f">{count}I", data, 12)
            return [(i, _names(data, off), _has_table(data, off, b"fvar")) for i, off in enumerate(offsets)]
        return [(0, _names(data, 0), _has_table(data, 0, b"fvar"))]
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
            for member, names, variable in _members(path):
                family = names.get(16) or names.get(1)
                style = names.get(17) or names.get(2) or "Regular"
                if not family or family.startswith("."):
                    continue
                key = hashlib.sha1(f"{path}#{member}".encode()).hexdigest()[:16]
                out[key] = {"id": key, "family": family, "style": style, "full": names.get(4, f"{family} {style}"), "postscript": names.get(6, ""), "path": str(path), "member": member, "variable": variable}
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
    return [{**{k: f[k] for k in ("id", "family", "style", "full", "postscript")}, "variable": bool(f.get("variable"))} for f in fonts]


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
    slanted = re.search(r"italic|oblique", want_s) is not None
    same = [f for f in candidates if (re.search(r"italic|oblique", f["style"].lower()) is not None) == slanted]
    pool = sorted(same or candidates, key=lambda f: (not f.get("variable"), f["style"].lower() not in ("regular", "book", "roman", "normal", "italic", "oblique")))
    return pool[0]


_metrics: dict[str, dict | None] = {}


def _table(data: bytes, base: int, want: bytes) -> tuple[int, int] | None:
    num = struct.unpack_from(">H", data, base + 4)[0]
    for i in range(num):
        tag, _, offset, length = struct.unpack_from(">4sIII", data, base + 12 + i * 16)
        if tag == want:
            return offset, length
    return None


def _measure(entry: dict) -> dict | None:
    try:
        data = Path(entry["path"]).read_bytes()
        base = struct.unpack_from(">I", data, 12 + entry["member"] * 4)[0] if data[:4] == b"ttcf" else 0
        head, os2, post = _table(data, base, b"head"), _table(data, base, b"OS/2"), _table(data, base, b"post")
        if not head:
            return None
        upm = struct.unpack_from(">H", data, head[0] + 18)[0] or 1000
        m = {"upm": upm, "weight": 400, "width": 5, "klass": 0, "serif": 0, "xh": 0.0, "cap": 0.0, "avg": 0.0, "angle": 0.0, "italic": 0}
        if os2:
            o = os2[0]
            version, avg, weight, width = struct.unpack_from(">HhHH", data, o)
            klass = struct.unpack_from(">h", data, o + 30)[0] >> 8
            panose = struct.unpack_from(">10B", data, o + 32)
            sel = struct.unpack_from(">H", data, o + 62)[0]
            m.update(weight=weight or 400, width=width or 5, klass=klass, avg=avg / upm, italic=1 if sel & 1 else 0)
            if panose[0] == 2 and panose[1] > 1:
                m["serif"] = 0 if panose[1] >= 11 else 1
            elif klass in (1, 2, 3, 4, 5, 7):
                m["serif"] = 1
            if version >= 2 and os2[1] >= 90:
                xh, cap = struct.unpack_from(">hh", data, o + 86)
                m.update(xh=xh / upm, cap=cap / upm)
        if post:
            m["angle"] = struct.unpack_from(">i", data, post[0] + 4)[0] / 65536
        return m
    except (struct.error, OSError):
        return None


def _metrics_of(entry: dict) -> dict | None:
    if entry["id"] not in _metrics:
        _metrics[entry["id"]] = _measure(entry)
    return _metrics[entry["id"]]


def similar(font_id: str, limit: int = 10) -> list[dict] | None:
    fonts = index()
    target = fonts.get(font_id)
    if not target:
        return None
    ref = _metrics_of(target)
    if not ref:
        return []
    best: dict[str, tuple[float, dict]] = {}
    for entry in fonts.values():
        if entry["family"] == target["family"]:
            continue
        m = _metrics_of(entry)
        if not m:
            continue
        d = abs(m["weight"] - ref["weight"]) / 100 * 0.9 + abs(m["width"] - ref["width"]) * 0.8
        d += 3.0 * (m["serif"] != ref["serif"]) + 1.5 * (m["klass"] != ref["klass"]) + 2.0 * (m["italic"] != ref["italic"])
        if ref["xh"] and m["xh"]:
            d += abs(m["xh"] - ref["xh"]) * 14 + abs(m["cap"] - ref["cap"]) * 8
        d += abs(m["avg"] - ref["avg"]) * 6 + min(abs(m["angle"] - ref["angle"]), 30) / 6
        if entry["family"] not in best or d < best[entry["family"]][0]:
            best[entry["family"]] = (d, entry)
    ranked = sorted(best.values(), key=lambda t: (t[0], t[1]["family"].lower()))[: max(1, min(limit, 50))]
    return [{"id": e["id"], "family": e["family"], "style": e["style"], "score": round(max(0.0, 100 - d * 6), 1)} for d, e in ranked]
