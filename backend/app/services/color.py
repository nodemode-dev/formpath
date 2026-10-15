import hashlib
import io
import math
import os
import struct
import threading
from pathlib import Path

from app.core import config

GENERIC_CMYK = "formpth Generic CMYK"
SRGB_NAME = "sRGB (built-in)"
MAX_PROFILE_BYTES = 64 * 1024 * 1024
MAX_SCAN = 4000
SPACES = {b"RGB ": "RGB", b"CMYK": "CMYK", b"GRAY": "GRAY", b"Lab ": "Lab", b"XYZ ": "XYZ"}
CLASSES = {b"mntr": "display", b"prtr": "output", b"scnr": "input", b"spac": "colorspace", b"abst": "abstract", b"link": "link", b"nmcl": "named"}
INTENTS = (0, 1, 2, 3)

_lock = threading.RLock()
_meta: dict[tuple[str, float, int], dict] = {}
_transforms: dict[tuple, object] = {}
_generic: bytes | None = None
_srgb: bytes | None = None


def _cms():
    try:
        from PIL import ImageCms
    except ImportError as exc:
        raise RuntimeError("Colour management needs Pillow with LittleCMS. Run ./formpth install to add it.") from exc
    return ImageCms


def profiles_dir() -> Path:
    path = config.data_dir() / "profiles"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _builtin_dir() -> Path:
    path = profiles_dir() / ".builtin"
    path.mkdir(parents=True, exist_ok=True)
    return path


def system_folders() -> list[Path]:
    home = Path.home()
    return [
        Path("/usr/share/color/icc"),
        home / ".local" / "share" / "icc",
        home / ".color" / "icc",
        Path("/Library/ColorSync/Profiles"),
        home / "Library" / "ColorSync" / "Profiles",
        Path("C:/Windows/System32/spool/drivers/color"),
    ]


def srgb_bytes() -> bytes:
    global _srgb
    with _lock:
        if _srgb is not None:
            return _srgb
        path = _builtin_dir() / "srgb-builtin-v1.icc"
        try:
            cached = path.read_bytes()
            if cached[36:40] == b"acsp":
                _srgb = cached
                return cached
        except OSError:
            pass
        cms = _cms()
        data = cms.ImageCmsProfile(cms.createProfile("sRGB")).tobytes()
        try:
            path.write_bytes(data)
        except OSError:
            pass
        _srgb = data
        return data


def _fix(v: float) -> bytes:
    return struct.pack(">i", int(round(v * 65536)))


def _pad(b: bytes) -> bytes:
    return b + b"\0" * (-len(b) % 4)


def _f(t: float) -> float:
    return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116


def _finv(t: float) -> float:
    return t ** 3 if t ** 3 > 216 / 24389 else (116 * t - 16) / (24389 / 27)


D50 = (0.9642, 1.0, 0.8249)


def _lab_to_xyz(L: float, a: float, b: float) -> tuple[float, float, float]:
    fy = (L + 16) / 116
    return D50[0] * _finv(fy + a / 500), D50[1] * _finv(fy), D50[2] * _finv(fy - b / 200)


def _xyz_to_lab(x: float, y: float, z: float) -> tuple[float, float, float]:
    fx, fy, fz = _f(x / D50[0]), _f(y / D50[1]), _f(z / D50[2])
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


_PAPER = _lab_to_xyz(94.0, 1.0, -3.0)
_PRIMARIES_LAB = [
    (94.0, 1.0, -3.0), (55.0, -37.0, -50.0), (48.0, 74.0, -3.0), (24.0, 22.0, -46.0),
    (89.0, -5.0, 93.0), (50.0, -65.0, 27.0), (47.0, 68.0, 48.0), (22.0, 2.0, 0.0),
]
_PRIMARIES_LAB += [(max(4.5, L * 0.17), a * 0.15, b * 0.15) for L, a, b in _PRIMARIES_LAB]
_YN = 2.0
_ROOTS = [tuple(v ** (1 / _YN) for v in _lab_to_xyz(*lab)) for lab in _PRIMARIES_LAB]


def _gain(a: float, g: float) -> float:
    return min(1.0, max(0.0, a + g * 4 * a * (1 - a)))


def _model(c: float, m: float, y: float, k: float) -> tuple[float, float, float]:
    c, m, y, k = _gain(c, 0.15), _gain(m, 0.15), _gain(y, 0.15), _gain(k, 0.17)
    wc, wm, wy, wk = (1 - c, c), (1 - m, m), (1 - y, y), (1 - k, k)
    x = yy = z = 0.0
    for i in range(16):
        w = wc[i & 1] * wm[(i >> 1) & 1] * wy[(i >> 2) & 1] * wk[(i >> 3) & 1]
        if w:
            r = _ROOTS[i]
            x += w * r[0]
            yy += w * r[1]
            z += w * r[2]
    x, yy, z = x ** _YN, yy ** _YN, z ** _YN
    return x / _PAPER[0] * D50[0], yy / _PAPER[1] * D50[1], z / _PAPER[2] * D50[2]


def _model_lab(c: float, m: float, y: float, k: float) -> tuple[float, float, float]:
    return _xyz_to_lab(*_model(c, m, y, k))


def _solve(L: float, a: float, b: float) -> tuple[float, float, float, float]:
    chroma = math.hypot(a, b)
    t = min(1.0, max(0.0, (88.0 - L) / 80.0))
    k = t ** 1.6 * (1 - 0.9 * min(1.0, chroma / 55.0) ** 0.8)
    if L < 10:
        k = max(k, 0.97)
    k = min(1.0, max(0.0, k))
    x, y, z = _lab_to_xyz(L, a, b)
    lin = (3.1339 * x - 1.6169 * y - 0.4906 * z, -0.9788 * x + 1.9161 * y + 0.0335 * z, 0.0720 * x - 0.2290 * y + 1.4057 * z)
    cmy = [1 - min(1.0, max(0.0, v)) ** (1 / 2.2) for v in lin]
    cmy = [min(1.0, max(0.0, (v - k) / (1 - k + 1e-6))) for v in cmy]
    target = (L, a, b)
    for _ in range(10):
        f0 = _model_lab(cmy[0], cmy[1], cmy[2], k)
        r = [f0[i] - target[i] for i in range(3)]
        if math.sqrt(r[0] ** 2 + r[1] ** 2 + r[2] ** 2) < 0.25:
            break
        cols = []
        for j in range(3):
            p = list(cmy)
            lo, hi = max(0.0, p[j] - 0.01), min(1.0, p[j] + 0.01)
            q = list(p)
            p[j], q[j] = hi, lo
            fh, fl = _model_lab(p[0], p[1], p[2], k), _model_lab(q[0], q[1], q[2], k)
            cols.append([(fh[i] - fl[i]) / max(hi - lo, 1e-9) for i in range(3)])
        m00, m01, m02 = cols[0][0], cols[1][0], cols[2][0]
        m10, m11, m12 = cols[0][1], cols[1][1], cols[2][1]
        m20, m21, m22 = cols[0][2], cols[1][2], cols[2][2]
        det = m00 * (m11 * m22 - m12 * m21) - m01 * (m10 * m22 - m12 * m20) + m02 * (m10 * m21 - m11 * m20)
        if abs(det) < 1e-9:
            break
        d0 = (r[0] * (m11 * m22 - m12 * m21) - m01 * (r[1] * m22 - m12 * r[2]) + m02 * (r[1] * m21 - m11 * r[2])) / det
        d1 = (m00 * (r[1] * m22 - m12 * r[2]) - r[0] * (m10 * m22 - m12 * m20) + m02 * (m10 * r[2] - r[1] * m20)) / det
        d2 = (m00 * (m11 * r[2] - r[1] * m21) - m01 * (m10 * r[2] - r[1] * m20) + r[0] * (m10 * m21 - m11 * m20)) / det
        for j, dj in enumerate((d0, d1, d2)):
            cmy[j] = min(1.0, max(0.0, cmy[j] - max(-0.3, min(0.3, dj))))
    total = cmy[0] + cmy[1] + cmy[2] + k
    if total > 3.0 and cmy[0] + cmy[1] + cmy[2] > 0:
        s = max(0.0, (3.0 - k) / (cmy[0] + cmy[1] + cmy[2]))
        cmy = [v * s for v in cmy]
    return cmy[0], cmy[1], cmy[2], k


def _u16(v: float) -> int:
    return max(0, min(65535, int(round(v))))


def _lab_enc(L: float, a: float, b: float) -> tuple[int, int, int]:
    return _u16(L * 652.8), _u16((a + 128) * 256), _u16((b + 128) * 256)


def _lut16(inch: int, outch: int, grid: int, clut: list[int]) -> bytes:
    head = b"mft2" + b"\0\0\0\0" + bytes([inch, outch, grid, 0])
    head += b"".join(_fix(v) for v in (1, 0, 0, 0, 1, 0, 0, 0, 1))
    head += struct.pack(">HH", 2, 2)
    head += b"".join(struct.pack(">HH", 0, 65535) for _ in range(inch))
    body = struct.pack(f">{len(clut)}H", *clut)
    tail = b"".join(struct.pack(">HH", 0, 65535) for _ in range(outch))
    return head + body + tail


def _desc(text: str) -> bytes:
    a = text.encode("ascii", "replace") + b"\0"
    return b"desc" + b"\0\0\0\0" + struct.pack(">I", len(a)) + a + struct.pack(">II", 0, 0) + struct.pack(">HB", 0, 0) + b"\0" * 67


def build_generic_cmyk() -> bytes:
    ga, gb = 11, 17
    a2b: list[int] = []
    step = 1 / (ga - 1)
    for ic in range(ga):
        for im in range(ga):
            for iy in range(ga):
                for ik in range(ga):
                    a2b.extend(_lab_enc(*_model_lab(ic * step, im * step, iy * step, ik * step)))
    b2a: list[int] = []
    for il in range(gb):
        for ia in range(gb):
            for ib in range(gb):
                f = (il / (gb - 1), ia / (gb - 1), ib / (gb - 1))
                L, a, b = min(100.0, f[0] * 65535 / 652.8), f[1] * 65535 / 256 - 128, f[2] * 65535 / 256 - 128
                b2a.extend(_u16(v * 65535) for v in _solve(L, a, b))
    lut_a, lut_b = _pad(_lut16(4, 3, ga, a2b)), _pad(_lut16(3, 4, gb, b2a))
    desc = _pad(_desc(GENERIC_CMYK))
    cprt = _pad(b"text" + b"\0\0\0\0" + b"Generic coated press model by formpth. Not a FOGRA, SWOP or other characterised printing condition.\0")
    wtpt = b"XYZ " + b"\0\0\0\0" + b"".join(_fix(v) for v in _PAPER)
    blobs = {b"desc": desc, b"cprt": cprt, b"wtpt": wtpt, b"A2B0": lut_a, b"B2A0": lut_b}
    tags = [(b"desc", b"desc"), (b"cprt", b"cprt"), (b"wtpt", b"wtpt"), (b"A2B0", b"A2B0"), (b"A2B1", b"A2B0"), (b"A2B2", b"A2B0"), (b"B2A0", b"B2A0"), (b"B2A1", b"B2A0"), (b"B2A2", b"B2A0")]
    offset = 128 + 4 + 12 * len(tags)
    place: dict[bytes, int] = {}
    data = b""
    for key, blob in blobs.items():
        place[key] = offset + len(data)
        data += blob
    table = struct.pack(">I", len(tags)) + b"".join(struct.pack(">4sII", sig, place[src], len(blobs[src])) for sig, src in tags)
    size = 128 + len(table) + len(data)
    header = struct.pack(">I4sI4s4s4s", size, b"\0\0\0\0", 0x02400000, b"prtr", b"CMYK", b"Lab ")
    header += struct.pack(">6H", 2026, 10, 15, 0, 0, 0) + b"acsp" + b"\0\0\0\0" + struct.pack(">I", 0) + b"\0\0\0\0" + b"\0\0\0\0" + b"\0" * 8
    header += struct.pack(">I", 0) + b"".join(_fix(v) for v in D50) + b"frmp" + b"\0" * 16 + b"\0" * 28
    return header + table + data


def generic_cmyk_bytes() -> bytes:
    global _generic
    with _lock:
        if _generic is not None:
            return _generic
        path = _builtin_dir() / "formpth-generic-cmyk-v1.icc"
        try:
            cached = path.read_bytes()
            _cms().ImageCmsProfile(io.BytesIO(cached))
            _generic = cached
            return cached
        except (OSError, Exception):
            pass
        data = build_generic_cmyk()
        _cms().ImageCmsProfile(io.BytesIO(data))
        try:
            path.write_bytes(data)
        except OSError:
            pass
        _generic = data
        return data


def _describe(data: bytes, name: str | None = None) -> dict | None:
    if len(data) < 128 or data[36:40] != b"acsp":
        return None
    cms = _cms()
    try:
        prof = cms.ImageCmsProfile(io.BytesIO(data))
        desc = (cms.getProfileDescription(prof) or "").strip()
    except Exception:
        return None
    return {
        "id": hashlib.sha1(data).hexdigest(),
        "name": name or desc or "Untitled profile",
        "space": SPACES.get(data[16:20], data[16:20].decode("ascii", "replace").strip()),
        "class": CLASSES.get(data[12:16], data[12:16].decode("ascii", "replace").strip()),
        "size": len(data),
    }


def _scan(folder: Path) -> list[tuple[Path, os.stat_result]]:
    found: list[tuple[Path, os.stat_result]] = []
    if not folder.is_dir():
        return found
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if f.lower().endswith((".icc", ".icm")):
                p = Path(root) / f
                try:
                    found.append((p, p.stat()))
                except OSError:
                    continue
            if len(found) >= MAX_SCAN:
                return found
    return found


def _file_meta(path: Path, st: os.stat_result) -> dict | None:
    key = (str(path), st.st_mtime, st.st_size)
    if key in _meta:
        return _meta[key]
    if st.st_size > MAX_PROFILE_BYTES or st.st_size < 128:
        return None
    try:
        info = _describe(path.read_bytes())
    except OSError:
        return None
    if info:
        _meta[key] = info
    return info


def _entries() -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()

    def add(info: dict | None, source: str, path: Path | None = None) -> None:
        if not info or info["id"] in seen:
            return
        seen.add(info["id"])
        out.append({**info, "source": source, "path": str(path) if path else None})

    add(_describe(srgb_bytes(), SRGB_NAME), "builtin")
    add(_describe(generic_cmyk_bytes(), GENERIC_CMYK), "builtin")
    for source, folders in (("user", [profiles_dir()]), ("system", system_folders())):
        for folder in folders:
            for path, st in _scan(folder):
                add(_file_meta(path, st), source, path)
    return out


def listing() -> list[dict]:
    return [{k: v for k, v in e.items() if k != "path"} for e in _entries()]


def profile_bytes(pid: str) -> bytes | None:
    if not pid or len(pid) != 40 or any(c not in "0123456789abcdef" for c in pid):
        return None
    for e in _entries():
        if e["id"] == pid:
            if e["source"] == "builtin":
                return srgb_bytes() if e["name"] == SRGB_NAME else generic_cmyk_bytes()
            try:
                return Path(e["path"]).read_bytes()
            except OSError:
                return None
    return None


def _safe_name(name: str) -> str:
    base = Path(name.replace("\\", "/")).name
    stem = "".join(ch if ch.isalnum() or ch in " ._-()" else "_" for ch in Path(base).stem).strip(" .") or "profile"
    return f"{stem[:80]}.icc"


def upload(name: str, data: bytes) -> dict:
    if len(data) > MAX_PROFILE_BYTES:
        raise ValueError("That profile is larger than 64 MiB. Pick an ICC profile file (.icc or .icm).")
    info = _describe(data)
    if not info:
        raise ValueError("That file is not a readable ICC profile. Pick a .icc or .icm file.")
    if info["space"] not in ("RGB", "CMYK", "GRAY"):
        raise ValueError(f"A {info['space']} profile cannot be used as a working space. Pick an RGB, CMYK or gray profile.")
    existing = next((e for e in _entries() if e["id"] == info["id"]), None)
    if existing:
        return {k: v for k, v in existing.items() if k != "path"}
    folder = profiles_dir()
    target = folder / _safe_name(name)
    n = 1
    while target.exists():
        target = folder / f"{Path(_safe_name(name)).stem} {n}.icc"
        n += 1
    target.write_bytes(data)
    return {**info, "source": "user"}


def _profile(pid: str):
    data = profile_bytes(pid)
    if data is None:
        raise LookupError("That colour profile is not available on this computer. Choose another one in Color Settings or load the file again.")
    cms = _cms()
    return cms.ImageCmsProfile(io.BytesIO(data))


def _space(pid: str) -> str:
    data = profile_bytes(pid)
    return SPACES.get(data[16:20], "") if data else ""


def _check_intent(intent: int) -> int:
    if intent not in INTENTS:
        raise ValueError("Rendering intent must be 0 (Perceptual), 1 (Relative Colorimetric), 2 (Saturation) or 3 (Absolute Colorimetric).")
    return intent


def _expect(pid: str, space: str, label: str) -> None:
    got = _space(pid)
    if got != space:
        raise ValueError(f"The {label} profile must be a {space} profile; this one is {got or 'unreadable'}.")


def _apply(key: tuple, build, mode_in: str, mode_out: str, raw: bytes, count: int) -> bytes:
    cms = _cms()
    from PIL import Image
    with _lock:
        tr = _transforms.get(key)
        if tr is None:
            if len(_transforms) > 24:
                _transforms.clear()
            tr = build()
            _transforms[key] = tr
    src = Image.frombytes(mode_in, (count, 1), raw)
    return cms.applyTransform(src, tr).tobytes()


def rgb_to_cmyk(rgb_id: str, cmyk_id: str, intent: int, bpc: bool, n: int = 17) -> bytes:
    _check_intent(intent)
    _expect(rgb_id, "RGB", "RGB")
    _expect(cmyk_id, "CMYK", "CMYK")
    n = 17 if n not in (9, 17, 33) else n
    cms = _cms()
    flags = int(cms.Flags.BLACKPOINTCOMPENSATION) if bpc else 0
    raw = bytearray()
    for r in range(n):
        for g in range(n):
            for b in range(n):
                raw += bytes((round(r * 255 / (n - 1)), round(g * 255 / (n - 1)), round(b * 255 / (n - 1))))
    key = ("r2c", rgb_id, cmyk_id, intent, flags)
    return _apply(key, lambda: cms.buildTransform(_profile(rgb_id), _profile(cmyk_id), "RGB", "CMYK", renderingIntent=intent, flags=flags), "RGB", "CMYK", bytes(raw), n ** 3)


def cmyk_to_rgb(cmyk_id: str, rgb_id: str, intent: int, bpc: bool, n: int = 9) -> bytes:
    _check_intent(intent)
    _expect(rgb_id, "RGB", "RGB")
    _expect(cmyk_id, "CMYK", "CMYK")
    n = 9 if n not in (9, 11) else n
    cms = _cms()
    flags = int(cms.Flags.BLACKPOINTCOMPENSATION) if bpc else 0
    raw = bytearray()
    for c in range(n):
        for m in range(n):
            for y in range(n):
                for k in range(n):
                    raw += bytes((round(c * 255 / (n - 1)), round(m * 255 / (n - 1)), round(y * 255 / (n - 1)), round(k * 255 / (n - 1))))
    key = ("c2r", cmyk_id, rgb_id, intent, flags)
    return _apply(key, lambda: cms.buildTransform(_profile(cmyk_id), _profile(rgb_id), "CMYK", "RGB", renderingIntent=intent, flags=flags), "CMYK", "RGB", bytes(raw), n ** 4)


def proof(rgb_id: str, device_id: str, intent: int, bpc: bool, paper: bool, black_ink: bool, monitor_id: str | None = None, n: int = 17) -> bytes:
    _check_intent(intent)
    _expect(rgb_id, "RGB", "RGB")
    _expect(device_id, "CMYK", "device")
    monitor = monitor_id or _entries()[0]["id"]
    _expect(monitor, "RGB", "monitor")
    n = 17 if n not in (17, 33) else n
    cms = _cms()
    flags = int(cms.Flags.SOFTPROOFING)
    if bpc and not black_ink:
        flags |= int(cms.Flags.BLACKPOINTCOMPENSATION)
    proof_intent = 3 if paper else 1
    raw = bytearray()
    for r in range(n):
        for g in range(n):
            for b in range(n):
                raw += bytes((round(r * 255 / (n - 1)), round(g * 255 / (n - 1)), round(b * 255 / (n - 1))))
    key = ("proof", rgb_id, device_id, monitor, intent, proof_intent, flags)
    build = lambda: cms.buildProofTransform(_profile(rgb_id), _profile(monitor), _profile(device_id), "RGB", "RGB", renderingIntent=intent, proofRenderingIntent=proof_intent, flags=flags)
    return _apply(key, build, "RGB", "RGB", bytes(raw), n ** 3)
