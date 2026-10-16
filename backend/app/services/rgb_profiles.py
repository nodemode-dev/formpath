import struct
from functools import lru_cache

D50 = (0.9642, 1.0, 0.8249)
D65_XY = (0.3127, 0.3290)
BRADFORD = ((0.8951, 0.2664, -0.1614), (-0.7502, 1.7135, 0.0367), (0.0389, -0.0685, 1.0296))

SPACES = {
    "Adobe RGB (1998) compatible": {"r": (0.6400, 0.3300), "g": (0.2100, 0.7100), "b": (0.1500, 0.0600), "white": D65_XY, "trc": ("gamma", 563 / 256), "note": "Working space from the published Adobe RGB (1998) primaries, D65 white point and 563/256 gamma. Built by formpth."},
    "Display P3": {"r": (0.680, 0.320), "g": (0.265, 0.690), "b": (0.150, 0.060), "white": D65_XY, "trc": ("srgb", 0), "note": "Display P3 primaries, D65 white point and the sRGB transfer curve. Built by formpth."},
}


def _mul(a, b):
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))


def _vec(m, v):
    return tuple(sum(m[i][k] * v[k] for k in range(3)) for i in range(3))


def _inv(m):
    (a, b, c), (d, e, f), (g, h, i) = m
    det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
    return (
        ((e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det),
        ((f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det),
        ((d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det),
    )


def _xyz(x: float, y: float):
    return (x / y, 1.0, (1 - x - y) / y)


def _colorants(space: dict):
    cols = [_xyz(*space[k]) for k in ("r", "g", "b")]
    m = tuple(tuple(cols[j][i] for j in range(3)) for i in range(3))
    s = _vec(_inv(m), _xyz(*space["white"]))
    native = tuple(tuple(m[i][j] * s[j] for j in range(3)) for i in range(3))
    src = _vec(BRADFORD, _xyz(*space["white"]))
    dst = _vec(BRADFORD, D50)
    scale = ((dst[0] / src[0], 0, 0), (0, dst[1] / src[1], 0), (0, 0, dst[2] / src[2]))
    chad = _mul(_inv(BRADFORD), _mul(scale, BRADFORD))
    return _mul(chad, native), chad


def _s15(v: float) -> bytes:
    return struct.pack(">i", int(round(v * 65536)))


def _pad(b: bytes) -> bytes:
    return b + b"\0" * (-len(b) % 4)


def _desc(text: str) -> bytes:
    a = text.encode("ascii", "replace") + b"\0"
    return b"desc" + b"\0\0\0\0" + struct.pack(">I", len(a)) + a + struct.pack(">II", 0, 0) + struct.pack(">HB", 0, 0) + b"\0" * 67


def _curve(kind: str, g: float) -> bytes:
    if kind == "gamma":
        return b"curv" + b"\0\0\0\0" + struct.pack(">IH", 1, int(round(g * 256)))
    n = 1024
    pts = []
    for i in range(n):
        t = i / (n - 1)
        v = t / 12.92 if t <= 0.04045 else ((t + 0.055) / 1.055) ** 2.4
        pts.append(max(0, min(65535, int(round(v * 65535)))))
    return b"curv" + b"\0\0\0\0" + struct.pack(">I", n) + struct.pack(f">{n}H", *pts)


@lru_cache(maxsize=None)
def build(name: str) -> bytes:
    space = SPACES[name]
    m, chad = _colorants(space)
    xyz = lambda col: b"XYZ " + b"\0\0\0\0" + b"".join(_s15(m[i][col]) for i in range(3))
    trc = _pad(_curve(*space["trc"]))
    blobs = {
        b"desc": _pad(_desc(name)),
        b"cprt": _pad(b"text" + b"\0\0\0\0" + space["note"].encode("ascii") + b"\0"),
        b"wtpt": b"XYZ " + b"\0\0\0\0" + b"".join(_s15(v) for v in D50),
        b"chad": b"sf32" + b"\0\0\0\0" + b"".join(_s15(chad[i][j]) for i in range(3) for j in range(3)),
        b"rXYZ": xyz(0), b"gXYZ": xyz(1), b"bXYZ": xyz(2), b"TRC ": trc,
    }
    tags = [(b"desc", b"desc"), (b"cprt", b"cprt"), (b"wtpt", b"wtpt"), (b"chad", b"chad"), (b"rXYZ", b"rXYZ"), (b"gXYZ", b"gXYZ"), (b"bXYZ", b"bXYZ"), (b"rTRC", b"TRC "), (b"gTRC", b"TRC "), (b"bTRC", b"TRC ")]
    offset = 128 + 4 + 12 * len(tags)
    place: dict[bytes, int] = {}
    data = b""
    for key, blob in blobs.items():
        place[key] = offset + len(data)
        data += blob
    table = struct.pack(">I", len(tags)) + b"".join(struct.pack(">4sII", sig, place[src], len(blobs[src])) for sig, src in tags)
    size = 128 + len(table) + len(data)
    header = struct.pack(">I4sI4s4s4s", size, b"\0\0\0\0", 0x02400000, b"mntr", b"RGB ", b"XYZ ")
    header += struct.pack(">6H", 2026, 10, 16, 0, 0, 0) + b"acsp" + b"\0\0\0\0" + struct.pack(">I", 0) + b"\0\0\0\0" + b"\0\0\0\0" + b"\0" * 8
    header += struct.pack(">I", 0) + b"".join(_s15(v) for v in D50) + b"frmp" + b"\0" * 16 + b"\0" * 28
    return header + table + data


def names() -> list[str]:
    return list(SPACES)
