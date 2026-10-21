import glob
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TIMEOUT = 180

ODA_GLOBS = {
    "win32": [r"C:\Program Files\ODA\ODAFileConverter*\ODAFileConverter.exe"],
    "darwin": ["/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter"],
    "linux": ["/usr/bin/ODAFileConverter", "/opt/ODAFileConverter*/ODAFileConverter"],
}


class DwgError(Exception):
    pass


def _oda() -> str | None:
    env = os.environ.get("FORMPATH_ODA_CONVERTER", "").strip()
    if env and Path(env).is_file():
        return env
    found = shutil.which("ODAFileConverter")
    if found:
        return found
    key = "win32" if sys.platform.startswith("win") else "darwin" if sys.platform == "darwin" else "linux"
    for pattern in ODA_GLOBS[key]:
        hits = sorted(glob.glob(pattern))
        if hits:
            return hits[-1]
    return None


def converters() -> list[dict]:
    out = []
    oda = _oda()
    if oda:
        out.append({"name": "ODA File Converter", "path": oda})
    libre = shutil.which("dwg2dxf")
    if libre:
        out.append({"name": "LibreDWG dwg2dxf", "path": libre})
    return out


def _run(argv: list[str]) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    if sys.platform.startswith("linux") and not env.get("DISPLAY") and not env.get("WAYLAND_DISPLAY"):
        env.setdefault("QT_QPA_PLATFORM", "offscreen")
    return subprocess.run(argv, capture_output=True, timeout=TIMEOUT, env=env, check=False)


def to_dxf(data: bytes) -> tuple[str, str]:
    if not data.startswith(b"AC10"):
        raise DwgError("This file is not a DWG drawing (it does not start with an AutoCAD version tag).")
    found = converters()
    if not found:
        raise DwgError(
            "Opening DWG needs a DWG converter on this computer: the free ODA File Converter "
            "(opendesign.com/guestfiles/oda_file_converter) or LibreDWG's dwg2dxf. Install either, "
            "or set FORMPATH_ODA_CONVERTER to the converter's path, then open the drawing again."
        )
    errors = []
    with tempfile.TemporaryDirectory(prefix="formpath-dwg-") as tmp:
        src_dir, out_dir = Path(tmp, "in"), Path(tmp, "out")
        src_dir.mkdir()
        out_dir.mkdir()
        src = src_dir / "drawing.dwg"
        src.write_bytes(data)
        for conv in found:
            try:
                if conv["name"].startswith("ODA"):
                    res = _run([conv["path"], str(src_dir), str(out_dir), "ACAD2018", "DXF", "0", "1", "*.DWG"])
                    hits = list(out_dir.glob("*.dxf")) + list(out_dir.glob("*.DXF"))
                else:
                    target = out_dir / "drawing.dxf"
                    res = _run([conv["path"], "-y", "-o", str(target), str(src)])
                    hits = [target] if target.is_file() else []
            except (OSError, subprocess.TimeoutExpired) as exc:
                errors.append(f"{conv['name']}: {exc}")
                continue
            if hits and hits[0].stat().st_size > 0:
                return hits[0].read_bytes().decode("utf-8", errors="replace"), conv["name"]
            tail = (res.stderr or res.stdout or b"").decode("utf-8", errors="replace").strip().splitlines()[-1:] or ["no output"]
            errors.append(f"{conv['name']}: {tail[0]}")
    raise DwgError("The DWG converter could not read this drawing. " + "; ".join(errors))
