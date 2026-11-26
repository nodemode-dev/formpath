import hashlib
import io
import threading
from collections import OrderedDict

from fontTools.cffLib import CFFFontSet
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

MAX_BYTES = 64 * 1024 * 1024
MAX_IDS = 4000
WHOLE = 2500
KEPT = 6

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


class Program:
    def __init__(self, data: bytes) -> None:
        self.upm = 1000
        self.cids: dict[int, str] | None = None
        head = data[:4]
        if head in (b"\x00\x01\x00\x00", b"true", b"OTTO", b"ttcf"):
            font = TTFont(io.BytesIO(data), fontNumber=0, lazy=True)
            self.font = font
            if "head" in font:
                self.upm = font["head"].unitsPerEm or 1000
            if "glyf" in font:
                try:
                    self.order = font.getGlyphOrder()
                except Exception:
                    count = int(font["maxp"].numGlyphs)
                    self.order = [".notdef"] + ["glyph%.5d" % i for i in range(1, count)]
                    font.setGlyphOrder(self.order)
                self.glyphs = font.getGlyphSet()
            elif "CFF " in font:
                self._cff(font["CFF "].cff)
            else:
                raise OutlineError("This font program has no outlines the engine can read.")
        elif data[:1] == b"\x01":
            cff = CFFFontSet()
            cff.decompile(io.BytesIO(data), None)
            self._cff(cff)
        else:
            raise OutlineError("This font program is not TrueType, OpenType or CFF.")

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

    def name(self, kind: str, index: int) -> str | None:
        if kind == "cid" and self.cids is not None:
            return self.cids.get(index)
        return self.order[index] if 0 <= index < len(self.order) else None

    def ids(self, kind: str) -> list[int]:
        return sorted(self.cids) if kind == "cid" and self.cids is not None else list(range(len(self.order)))

    def draw(self, kind: str, index: int) -> list | None:
        name = self.name(kind, index)
        if name is None:
            return None
        pen = _Pen(self.glyphs)
        try:
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


def glyphs(key: str, kind: str, wanted: list[int]) -> dict | None:
    with _lock:
        program = _programs.get(key)
        if program is None:
            return None
        _programs.move_to_end(key)
        every = program.ids(kind)
        whole = len(every) <= WHOLE
        out = {}
        for index in every if whole else wanted[:MAX_IDS]:
            drawn = program.draw(kind, index)
            if drawn is not None:
                out[str(index)] = drawn
        return {"key": key, "upm": program.upm, "whole": whole, "glyphs": out}
