import ctypes
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

MAX_BYTES = 16 * 1024 * 1024
TTL = 30.0

_cache: tuple[float, str | None, str, bytes | None] | None = None


def _read(path: str | Path) -> bytes | None:
    try:
        p = Path(path)
        if not p.is_file() or p.stat().st_size > MAX_BYTES:
            return None
        data = p.read_bytes()
    except OSError:
        return None
    return data if len(data) >= 128 and data[36:40] == b"acsp" else None


def _run(cmd: list[str]) -> str:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=4, check=False)
    except (OSError, subprocess.SubprocessError):
        return ""
    return out.stdout if out.returncode == 0 else ""


def _colord() -> tuple[bytes | None, str]:
    exe = shutil.which("colormgr")
    if not exe:
        return None, ""
    devices = _run([exe, "get-devices-by-kind", "display"])
    if not devices.strip():
        return None, ""
    profile_id = ""
    for line in devices.splitlines():
        m = re.match(r"\s*Profile\s+1\s*:\s*(\S+)", line)
        if m:
            profile_id = m.group(1).rsplit("/", 1)[-1]
            break
    if not profile_id:
        return None, ""
    listing = _run([exe, "get-profiles"])
    for block in re.split(r"\n\s*\n", listing):
        if profile_id not in block:
            continue
        m = re.search(r"^\s*Filename\s*:\s*(.+?)\s*$", block, re.M)
        if m:
            data = _read(m.group(1))
            if data:
                return data, "colord"
    return None, ""


def _xatom() -> tuple[bytes | None, str]:
    exe = shutil.which("xprop")
    if not exe or not os.environ.get("DISPLAY"):
        return None, ""
    out = _run([exe, "-root", "_ICC_PROFILE"])
    if "=" not in out:
        return None, ""
    nums = re.findall(r"\d+", out.split("=", 1)[1])
    try:
        data = bytes(int(n) for n in nums)
    except ValueError:
        return None, ""
    return (data, "x11") if len(data) >= 128 and data[36:40] == b"acsp" else (None, "")


def _mac() -> tuple[bytes | None, str]:
    try:
        cg = ctypes.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
        cf = ctypes.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
        cg.CGMainDisplayID.restype = ctypes.c_uint32
        cg.CGDisplayCopyColorSpace.restype = ctypes.c_void_p
        cg.CGDisplayCopyColorSpace.argtypes = [ctypes.c_uint32]
        cg.CGColorSpaceCopyICCData.restype = ctypes.c_void_p
        cg.CGColorSpaceCopyICCData.argtypes = [ctypes.c_void_p]
        cf.CFDataGetLength.restype = ctypes.c_long
        cf.CFDataGetLength.argtypes = [ctypes.c_void_p]
        cf.CFDataGetBytePtr.restype = ctypes.c_void_p
        cf.CFDataGetBytePtr.argtypes = [ctypes.c_void_p]
        cf.CFRelease.argtypes = [ctypes.c_void_p]
        space = cg.CGDisplayCopyColorSpace(cg.CGMainDisplayID())
        if not space:
            return None, ""
        blob = cg.CGColorSpaceCopyICCData(space)
        data = None
        if blob:
            size = cf.CFDataGetLength(blob)
            if 128 <= size <= MAX_BYTES:
                data = ctypes.string_at(cf.CFDataGetBytePtr(blob), size)
            cf.CFRelease(blob)
        cf.CFRelease(space)
        return (data, "colorsync") if data and data[36:40] == b"acsp" else (None, "")
    except (OSError, AttributeError):
        return None, ""


def _windows() -> tuple[bytes | None, str]:
    try:
        user32 = ctypes.WinDLL("user32")
        gdi32 = ctypes.WinDLL("gdi32")
        user32.GetDC.restype = ctypes.c_void_p
        user32.GetDC.argtypes = [ctypes.c_void_p]
        user32.ReleaseDC.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        gdi32.GetICMProfileW.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32), ctypes.c_wchar_p]
        gdi32.GetICMProfileW.restype = ctypes.c_int
        dc = user32.GetDC(None)
        if not dc:
            return None, ""
        try:
            size = ctypes.c_uint32(0)
            gdi32.GetICMProfileW(dc, ctypes.byref(size), None)
            if size.value == 0:
                return None, ""
            buf = ctypes.create_unicode_buffer(size.value)
            if not gdi32.GetICMProfileW(dc, ctypes.byref(size), buf):
                return None, ""
        finally:
            user32.ReleaseDC(None, dc)
        data = _read(buf.value)
        return (data, "windows") if data else (None, "")
    except (OSError, AttributeError):
        return None, ""


def _detect() -> tuple[bytes | None, str]:
    forced = os.environ.get("FORMPTH_DISPLAY_PROFILE", "").strip()
    if forced:
        data = _read(forced)
        return (data, "env") if data else (None, "")
    if sys.platform == "win32":
        return _windows()
    if sys.platform == "darwin":
        return _mac()
    data, via = _colord()
    return (data, via) if data else _xatom()


def detect(refresh: bool = False) -> tuple[bytes | None, str]:
    global _cache
    now = time.monotonic()
    forced = os.environ.get("FORMPTH_DISPLAY_PROFILE", "")
    if _cache and not refresh and now - _cache[0] < TTL and _cache[2] == forced:
        return _cache[3], _cache[1] or ""
    data, via = _detect()
    _cache = (now, via, forced, data)
    return data, via
