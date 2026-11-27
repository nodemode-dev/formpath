import hashlib
import io
import threading
import unicodedata
from collections import OrderedDict
from functools import lru_cache

from fontTools import agl, t1Lib
from fontTools.cffLib import CFFFontSet
from fontTools.encodings.MacRoman import MacRoman
from fontTools.encodings.StandardEncoding import StandardEncoding
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

MAX_BYTES = 64 * 1024 * 1024
MAX_IDS = 4000
WHOLE = 2500
KEPT = 6
SYMBOL_PAGES = (0xF000, 0, 0xF100, 0xF200)

_lock = threading.Lock()
_programs: "OrderedDict[str, Program]" = OrderedDict()


class OutlineError(Exception):
    pass


def _n(v: float) -> float | int:
    r = round(v, 2)
    return int(r) if r == int(r) else r


class _Pen(BasePen):
    def __init__(self, glyphs) -> None:
        super().__init__(glyphs)
        self.out: list = []
        self.open = False

    def _moveTo(self, p) -> None:
        self._endPath()
        self.out += ["M", _n(p[0]), _n(p[1])]
        self.open = True

    def _lineTo(self, p) -> None:
        self.out += ["L", _n(p[0]), _n(p[1])]

    def _curveToOne(self, a, b, c) -> None:
        self.out += ["C", _n(a[0]), _n(a[1]), _n(b[0]), _n(b[1]), _n(c[0]), _n(c[1])]

    def _closePath(self) -> None:
        self._endPath()

    def _endPath(self) -> None:
        if self.open:
            self.out.append("Z")
        self.open = False


@lru_cache(maxsize=4)
def _base(name: str) -> tuple | None:
    if name == "StandardEncoding":
        return tuple(StandardEncoding)
    if name == "MacRomanEncoding":
        return tuple(MacRoman)
    if name == "WinAnsiEncoding":
        return tuple(agl.UV2AGL.get(ord(ch)) if ch else None for ch in (bytes([c]).decode("cp1252", "ignore") for c in range(256)))
    return None


def _type1(data: bytes):
    if data[:1] == b"\x80":
        parts, at = [], 0
        while at + 6 <= len(data) and data[at] == 0x80 and data[at + 1] in (1, 2):
            size = int.from_bytes(data[at + 2:at + 6], "little")
            parts.append(data[at + 6:at + 6 + size])
            at += 6 + size
        data = b"".join(parts)
    chunks = [t1Lib.deHexString(chunk) if locked and t1Lib.isHex(chunk[:4]) else chunk for locked, chunk in t1Lib.findEncryptedChunks(data)]
    font = t1Lib.T1Font.__new__(t1Lib.T1Font)
    font.data = b"".join(chunks)
    font.encoding = "ascii"
    font.parse()
    return font


class Program:
    def __init__(self, data: bytes) -> None:
        self.upm = 1000
        self.cids: dict[int, str] | None = None
        self.builtin: list | None = None
        self.cmaps: dict | None = None
        self.unicode: dict = {}
        head = data[:4]
        if head in (b"\x00\x01\x00\x00", b"true", b"OTTO", b"ttcf"):
            font = TTFont(io.BytesIO(data), fontNumber=0, lazy=True)
            self.font = font
            if "head" in font:
                self.upm = font["head"].unitsPerEm or 1000
            if "cmap" in font and "glyf" in font:
                self.cmaps = {}
                for table in font["cmap"].tables:
                    try:
                        self.cmaps[(table.platformID, table.platEncID)] = dict(table.cmap)
                    except Exception:
                        continue
                for at in ((3, 10), (0, 6), (0, 4), (3, 1), (0, 3), (0, 2), (0, 1), (0, 0)):
                    if at in self.cmaps:
                        self.unicode = self.cmaps[at]
                        break
            elif "glyf" in font:
                self.cmaps = {}
            if "glyf" in font:
                try:
                    self.order = font.getGlyphOrder()
                except Exception:
                    count = int(font["maxp"].numGlyphs)
                    self.order = [".notdef"] + ["glyph%.5d" % i for i in range(1, count)]
                    font.setGlyphOrder(self.order)
                try:
                    self.glyphs = font.getGlyphSet()
                except Exception:
                    self.glyphs = None
                    self.glyf = font["glyf"]
            elif "CFF " in font:
                self._cff(font["CFF "].cff)
            else:
                raise OutlineError("This font program has no outlines the engine can read.")
        elif data[:1] == b"\x01":
            cff = CFFFontSet()
            cff.decompile(io.BytesIO(data), None)
            self._cff(cff)
        elif data[:1] == b"\x80" or data[:2] == b"%!":
            font = _type1(data)
            self.glyphs = font.getGlyphSet()
            self.order = list(self.glyphs.keys())
            encoding = font["Encoding"]
            self.builtin = list(StandardEncoding) if isinstance(encoding, str) else list(encoding)
            matrix = font.font.get("FontMatrix")
            if matrix and matrix[0]:
                self.upm = round(1 / matrix[0]) or 1000
        else:
            raise OutlineError("This font program is not TrueType, OpenType, CFF or Type 1.")

    def _cff(self, cff) -> None:
        top = cff[0]
        self.glyphs = top.CharStrings
        self.order = list(top.charset)
        matrix = getattr(top, "FontMatrix", None)
        if matrix and matrix[0]:
            self.upm = round(1 / matrix[0]) or 1000
        if hasattr(top, "ROS"):
            self.cids = {0: self.order[0]} if self.order else {}
            for name in self.order:
                if name.startswith("cid") and name[3:].isdigit():
                    self.cids[int(name[3:])] = name
        else:
            encoding = getattr(top, "Encoding", None)
            self.builtin = list(StandardEncoding) if isinstance(encoding, str) or encoding is None else list(encoding)

    def name(self, kind: str, index: int) -> str | None:
        if kind == "cid" and self.cids is not None:
            return self.cids.get(index)
        return self.order[index] if 0 <= index < len(self.order) else None

    def ids(self, kind: str) -> list[int]:
        return sorted(self.cids) if kind == "cid" and self.cids is not None else list(range(len(self.order)))

    def _simple(self, code: int, name: str | None, symbolic: bool) -> str | None:
        maps = self.cmaps or {}

        def named() -> str | None:
            if not name:
                return None
            text = agl.toUnicode(name)
            if len(text) == 1 and self.unicode.get(ord(text)):
                return self.unicode[ord(text)]
            if (1, 0) in maps and name in MacRoman and maps[(1, 0)].get(MacRoman.index(name)):
                return maps[(1, 0)][MacRoman.index(name)]
            return name if name in self.order else None

        def coded() -> str | None:
            for page in SYMBOL_PAGES:
                found = maps.get((3, 0), {}).get(page + code)
                if found:
                    return found
            return maps.get((1, 0), {}).get(code)

        return (coded() or named()) if symbolic else (named() or coded() or self.unicode.get(code))

    def code(self, code: int, enc: dict) -> str | None:
        name = (enc.get("names") or {}).get(str(code))
        base = _base(enc.get("base") or "")
        if name is None and base is not None and 0 <= code < 256:
            name = base[code]
        if self.cmaps is not None:
            found = self._simple(code, name, bool(enc.get("symbolic")))
        else:
            found = name if name in self.order else None
            if found is None and self.builtin is not None and 0 <= code < len(self.builtin):
                found = self.builtin[code] if self.builtin[code] in self.order else None
        return None if found == ".notdef" else found

    def draw(self, kind: str, index: int) -> list | None:
        return self.outline(self.name(kind, index))

    def outline(self, name: str | None) -> list | None:
        if name is None:
            return None
        pen = _Pen(self.glyphs)
        try:
            if self.glyphs is None:
                self.glyf[name].draw(pen, self.glyf)
            else:
                self.glyphs[name].draw(pen)
        except Exception:
            return None
        pen._endPath()
        return pen.out


def load(data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise OutlineError("The font program is larger than 64 MiB.")
    key = hashlib.sha256(data).hexdigest()[:32]
    with _lock:
        if key in _programs:
            _programs.move_to_end(key)
            return key
    try:
        program = Program(data)
    except OutlineError:
        raise
    except Exception as exc:
        raise OutlineError(f"The font program could not be read ({type(exc).__name__}).") from exc
    with _lock:
        _programs[key] = program
        while len(_programs) > KEPT:
            _programs.popitem(last=False)
    return key


def glyphs(key: str, kind: str, wanted: list[int], enc: dict | None = None) -> dict | None:
    with _lock:
        program = _programs.get(key)
        if program is None:
            return None
        _programs.move_to_end(key)
        if kind == "code":
            out, chars = {}, {}
            for code in range(256):
                name = program.code(code, enc or {})
                drawn = program.outline(name)
                if drawn is None:
                    continue
                out[str(code)] = drawn
                text = "".join(unicodedata.normalize("NFKC", ch) if 0xFB00 <= ord(ch) <= 0xFB06 else ch for ch in agl.toUnicode(name))
                if text and all(32 <= ord(ch) < 0xD800 or 0xF900 <= ord(ch) < 0xF0000 for ch in text):
                    chars[str(code)] = text
            return {"key": key, "upm": program.upm, "whole": True, "glyphs": out, "chars": chars}
        every = program.ids(kind)
        whole = len(every) <= WHOLE
        out = {}
        for index in every if whole else wanted[:MAX_IDS]:
            drawn = program.draw(kind, index)
            if drawn is not None:
                out[str(index)] = drawn
        return {"key": key, "upm": program.upm, "whole": whole, "glyphs": out}
