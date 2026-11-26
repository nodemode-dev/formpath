from __future__ import annotations

import os
import re
import shutil
import sys
from pathlib import Path

LIMIT = 16384
BATCH = (".cmd", ".bat")
ALLOWED_SETS = {"dp0", "_prog", "pathext"}
UNSAFE = re.compile(r'[\x00-\x1f"%^&|<>!()]')


def windows(platform: str | None = None) -> bool:
    return (platform or sys.platform).startswith("win")


def through_cmd(cmd: list, platform: str | None = None) -> bool:
    return bool(cmd) and windows(platform) and str(cmd[0]).lower().endswith(BATCH)


def plain(text: str) -> bool:
    return not UNSAFE.search(text)


def _local(folder: Path, rel: str) -> Path:
    return folder.joinpath(*[p for p in rel.replace("/", "\\").split("\\") if p])


def npm_target(shim: str | os.PathLike, search_path: str | None = None) -> list[str] | None:
    try:
        data = Path(shim).read_bytes()
        text = data.decode("utf-8") if len(data) <= LIMIT else ""
    except (OSError, UnicodeDecodeError):
        return None
    if text.count("%*") != 1 or any(name.lower() not in ALLOWED_SETS for name in re.findall(r'^\s*@?SET\s+"?([^=\s"]+)=', text, re.I | re.M)):
        return None
    folder = Path(shim).parent
    direct = re.search(r'^"%dp0%\\([^"%]+)"\s+%\*\s*$', text, re.M)
    if direct:
        target = _local(folder, direct.group(1))
        return [str(target)] if target.suffix.lower() in (".exe", ".com") and target.is_file() else None
    run = re.search(r'"%_prog%"\s+(?P<args>[^"%]*?)\s*"%dp0%\\(?P<target>[^"%]+)"\s+%\*\s*$', text, re.M)
    near = re.search(r'^IF EXIST "%dp0%\\([^"%\\]+\.exe)"\s*\(\s*$', text, re.I | re.M)
    named = re.search(r'^\s*SET "_prog=([^"%\\/]+)"\s*$', text, re.I | re.M)
    if not (run and near and named) or not plain(run.group("args")):
        return None
    script = _local(folder, run.group("target"))
    local = folder / near.group(1)
    prog = str(local) if local.is_file() else shutil.which(named.group(1), path=search_path)
    if not prog or prog.lower().endswith(BATCH) or not script.is_file():
        return None
    return [prog, *run.group("args").split(), str(script)]


def unshim(cmd: list, search_path: str | None = None, platform: str | None = None) -> list[str]:
    words = [str(c) for c in cmd]
    if not through_cmd(words, platform):
        return words
    real = npm_target(words[0], search_path)
    return real + words[1:] if real else words
