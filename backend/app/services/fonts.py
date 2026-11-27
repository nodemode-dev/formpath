import gc
import hashlib
import os
import re
import struct
import sys
import threading
import unicodedata
from array import array
from bisect import bisect_left
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


LEGACY = {(3, 2): "shift_jis", (3, 3): "gbk", (3, 4): "big5", (3, 5): "cp949", (1, 1): "shift_jis", (1, 2): "big5", (1, 3): "euc_kr", (1, 25): "gbk"}
COMMON = {"gbk": "gb2312", "cp949": "euc_kr"}


def _plain(text: str) -> str:
    text = text.strip("\x00").strip()
    return text if text and all(unicodedata.category(c) not in ("Cc", "Co", "Cn", "Cs") for c in text) else ""


def _strict(raw: bytes, codec: str) -> str:
    try:
        return _plain(raw.decode(codec))
    except UnicodeDecodeError:
        return ""


def _fit(text: str, codec: str) -> int:
    n = 0
    for c in text:
        try:
            n += len(c.encode(COMMON.get(codec, codec))) <= 2
        except UnicodeEncodeError:
            pass
    return n


def _decode(raw: bytes, platform: int, encoding: int = 1) -> str:
    codec = LEGACY.get((platform, encoding))
    if platform == 1:
        return _strict(raw, codec or "mac_roman") if codec or encoding == 0 else ""
    if platform not in (0, 3):
        return ""
    wide = _strict(raw, "utf-16-be") if len(raw) % 2 == 0 else ""
    if not codec:
        return wide
    units = raw[0::2] if len(raw) % 2 == 0 else b""
    narrow = _strict(raw.replace(b"\x00", b""), codec) if all(u == 0 or u >= 0x81 for u in units) else ""
    if not wide or not narrow or wide == narrow:
        return wide or narrow
    return narrow if _fit(narrow, codec) > _fit(wide, codec) else wide


def _names(data: bytes, base: int) -> tuple[dict[int, str], list[str]]:
    num = struct.unpack_from(">H", data, base + 4)[0]
    for i in range(num):
        tag, _, offset, _ = struct.unpack_from(">4sIII", data, base + 12 + i * 16)
        if tag != b"name":
            continue
        _, count, strings = struct.unpack_from(">HHH", data, offset)
        found: dict[int, tuple[int, str]] = {}
        every: dict[str, None] = {}
        for j in range(count):
            platform, encoding, language, name_id, length, start = struct.unpack_from(">HHHHHH", data, offset + 6 + j * 12)
            if name_id not in (1, 2, 4, 6, 16, 17):
                continue
            text = _decode(data[offset + strings + start: offset + strings + start + length], platform, encoding)
            if not text:
                continue
            if name_id in (1, 4, 6, 16):
                every[text] = None
            rank = 3 if platform == 3 and language in (0x409, 0) else 2 if platform == 3 else 1 if platform == 0 else 0
            if name_id not in found or rank > found[name_id][0]:
                found[name_id] = (rank, text)
        return {k: v[1] for k, v in found.items()}, list(every)
    return {}, []


def _has_table(data: bytes, base: int, want: bytes) -> bool:
    num = struct.unpack_from(">H", data, base + 4)[0]
    return any(struct.unpack_from(">4s", data, base + 12 + i * 16)[0] == want for i in range(num))


def _members(path: Path) -> list[tuple[int, tuple[dict[int, str], list[str]], bool]]:
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
            for member, (names, every), variable in _members(path):
                family = names.get(16) or names.get(1)
                style = names.get(17) or names.get(2) or "Regular"
                if not family or family.startswith("."):
                    continue
                key = hashlib.sha1(f"{path}#{member}".encode()).hexdigest()[:16]
                aliases = [a for a in every if a.lower() != family.lower()]
                out[key] = {"id": key, "family": family, "style": style, "full": names.get(4, f"{family} {style}"), "postscript": names.get(6, ""), "aliases": aliases, "path": str(path), "member": member, "variable": variable}
    return out


def index() -> dict[str, dict]:
    global _index, _stamp
    stamp = tuple((str(d), d.stat().st_mtime) for d in _dirs() if d.is_dir())
    with _lock:
        if stamp != _stamp or not _index:
            _index, _stamp = _scan(), stamp
            _cmaps.clear()
            _shared.clear()
        return _index


def listing() -> list[dict]:
    fonts = sorted(index().values(), key=lambda f: (f["family"].lower(), f["style"].lower()))
    return [{**{k: f[k] for k in ("id", "family", "style", "full", "postscript")}, "variable": bool(f.get("variable")), "aliases": list(f.get("aliases") or [])} for f in fonts]


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
    candidates = [f for f in index().values() if f["family"].lower() == want_f] or [f for f in index().values() if any(a.lower() == want_f for a in f.get("aliases") or [])]
    if not candidates:
        return None
    exact = [f for f in candidates if f["style"].lower() == want_s]
    if exact:
        return exact[0]
    slanted = re.search(r"italic|oblique", want_s) is not None
    same = [f for f in candidates if (re.search(r"italic|oblique", f["style"].lower()) is not None) == slanted]
    pool = sorted(same or candidates, key=lambda f: (not f.get("variable"), f["style"].lower() not in ("regular", "book", "roman", "normal", "italic", "oblique")))
    return pool[0]


_cmaps: dict[str, array] = {}
_shared: dict[bytes, array] = {}


def _cmap(entry: dict) -> array:
    hit = _cmaps.get(entry["id"])
    if hit is None:
        try:
            from fontTools.ttLib import TTFont
            with TTFont(entry["path"], fontNumber=entry["member"], lazy=True) as font:
                hit = array("I", sorted(font.getBestCmap() or {})) if any(t in font for t in ("glyf", "CFF ", "CFF2")) else array("I")
        except Exception:
            hit = array("I")
        gc.collect()
        hit = _shared.setdefault(hashlib.sha1(hit.tobytes()).digest(), hit)
        _cmaps[entry["id"]] = hit
    return hit


def _upright(f: dict) -> tuple:
    s = f["style"].lower()
    return (re.search(r"italic|oblique", s) is not None, 0 if s in ("regular", "book", "roman", "normal") else 1 if s == "medium" else 2, bool(f.get("variable")), s)


def cover(cp: int, prefer: list[str] | None = None) -> dict | None:
    rank = {p.strip().lower(): i for i, p in reversed(list(enumerate(prefer or []))) if p.strip()}
    best: dict[str, dict] = {}
    for f in index().values():
        if f["family"] not in best or _upright(f) < _upright(best[f["family"]]):
            best[f["family"]] = f
    place = lambda f: min([rank[n.lower()] for n in (f["family"], *(f.get("aliases") or [])) if n.lower() in rank] or [len(rank)])
    for f in sorted(best.values(), key=lambda f: (place(f), f["family"].lower())):
        c = _cmap(f)
        i = bisect_left(c, cp)
        if i < len(c) and c[i] == cp:
            return {"family": f["family"], "style": f["style"]}
    return None


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
            if version >= 1 and os2[1] >= 86:
                m["cjk"] = struct.unpack_from(">I", data, o + 78)[0] & 0x3E0000
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
        if not m or ref.get("cjk") and not m.get("cjk", 0) & ref["cjk"]:
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
