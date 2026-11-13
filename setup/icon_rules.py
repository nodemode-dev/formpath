#!/usr/bin/env python3
"""The sparkle ban: no three-star sparkle icon, glyph or SVG anywhere in the interface, under any name.

  python3 setup/icon_rules.py      exit 1 and list each line that draws or names a sparkle
"""

from __future__ import annotations

import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCANNED = ("frontend/src", "frontend/public", "frontend/index.html", "backend/app", "src-tauri/src", "demo", "demos")
SUFFIXES = (".ts", ".py", ".rs", ".css", ".html", ".svg", ".json", ".js")
INTERFACE = ("frontend/src/ui/", "frontend/src/app.ts", "frontend/src/help/", "frontend/index.html", "frontend/public/")

SIGNATURES = re.compile("\\bsparkles?\\s*:\\s*[`'\"]?\\s*<svg|\\bsparkles?\\s*:\\s*\\w+\\(|icon\\(\\s*['\"`]sparkles?['\"`]|"
                        "M12 1\\.5l1\\.5 4\\.5 4\\.5 1\\.5|M7\\.5 5\\.6L10 7 8\\.6 4\\.5|"
                        "M17 3v3M15\\.5 4\\.5h3M20 8v2M19 9h2|M12 3l1\\.8 4\\.6L18 9l-4\\.2 1\\.4|"
                        "[\\u2726\\u2727\\u2728\\u2734\\u2747]")
NAMED = re.compile("\\bsparkles?\\s*:|['\"`]sparkles?['\"`]", re.I)
PATH_D = re.compile(r"\bd=(?:\\?[\"'])([^\"'\\]+)")
POINTS = re.compile(r"\bpoints=(?:\\?[\"'])([^\"'\\]+)")
TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?")
ARGS = {"m": 2, "l": 2, "h": 1, "v": 1, "c": 6, "s": 4, "q": 4, "t": 2, "a": 7, "z": 0}


def subpaths(d: str) -> list[tuple[list[tuple[float, float]], bool]]:
    out: list[tuple[list[tuple[float, float]], bool]] = []
    pts: list[tuple[float, float]] = []
    x = y = 0.0
    cmd = ""
    toks = TOKEN.findall(d)
    i = 0
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
            if cmd in "Zz":
                if pts:
                    out.append((pts, True))
                    x, y = pts[0]
                pts = []
                continue
        if not cmd:
            return out
        n = ARGS[cmd.lower()]
        if i + n > len(toks) or any(t.isalpha() for t in toks[i:i + n]):
            return out
        a = [float(t) for t in toks[i:i + n]]
        i += n
        rel = cmd.islower()
        low = cmd.lower()
        if low == "h":
            x = x + a[0] if rel else a[0]
        elif low == "v":
            y = y + a[0] if rel else a[0]
        else:
            x, y = (x + a[-2], y + a[-1]) if rel else (a[-2], a[-1])
        if low == "m":
            if pts:
                out.append((pts, False))
            pts = [(x, y)]
            cmd = "l" if rel else "L"
        else:
            pts.append((x, y))
    if pts:
        out.append((pts, False))
    return out


def is_star(pts: list[tuple[float, float]]) -> bool:
    if len(pts) > 1 and math.dist(pts[0], pts[-1]) < 0.05:
        pts = pts[:-1]
    if len(pts) != 8:
        return False
    cx, cy = sum(p[0] for p in pts) / 8, sum(p[1] for p in pts) / 8
    r = [math.dist(p, (cx, cy)) for p in pts]
    for k0 in (0, 1):
        tips, rt, rv = pts[k0::2], r[k0::2], r[1 - k0::2]
        if min(rt) <= 0 or max(rv) >= 0.62 * min(rt):
            continue
        ang = sorted(math.degrees(math.atan2(p[1] - cy, p[0] - cx)) % 360 for p in tips)
        gaps = [(ang[(k + 1) % 4] - ang[k]) % 360 for k in range(4)]
        if all(55 <= g <= 125 for g in gaps):
            return True
    return False


def glints(segs: list[list[tuple[float, float]]]) -> int:
    lines = [s for s in segs if len(s) == 2 and math.dist(s[0], s[1]) > 0]
    used: set[int] = set()
    n = 0
    for i, a in enumerate(lines):
        for j in range(i + 1, len(lines)):
            if i in used or j in used:
                continue
            b = lines[j]
            ua = (a[1][0] - a[0][0], a[1][1] - a[0][1])
            ub = (b[1][0] - b[0][0], b[1][1] - b[0][1])
            la, lb = math.hypot(*ua), math.hypot(*ub)
            mid_a = ((a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2)
            mid_b = ((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2)
            if abs(ua[0] * ub[0] + ua[1] * ub[1]) / (la * lb) < 0.2 and math.dist(mid_a, mid_b) < 0.35 and 0.6 < la / lb < 1.67 and max(la, lb) <= 6:
                used.update((i, j))
                n += 1
    return n


def starry(svg: str) -> bool:
    stars, open_segs = 0, []
    for d in PATH_D.findall(svg) + ["M" + p + "z" for p in POINTS.findall(svg)]:
        for pts, closed in subpaths(d):
            if closed and is_star(pts):
                stars += 1
            elif not closed:
                open_segs.append(pts)
    return stars >= 2 or stars + glints(open_segs) >= 3


def problems(root: Path = ROOT) -> list[str]:
    out = []
    files = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", *SCANNED], cwd=root,
                           capture_output=True, text=True, check=True).stdout.split("\n")
    for rel in sorted(set(files)):
        if not rel.endswith(SUFFIXES) or rel.endswith(".test.ts") or not (root / rel).is_file():
            continue
        face = rel.startswith(INTERFACE) and "/i18n/" not in rel
        for n, line in enumerate((root / rel).read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if SIGNATURES.search(line) or (face and (NAMED.search(line) or starry(line))):
                out.append(f"{rel}:{n}: the three-star sparkle icon is banned app-wide (the owner's rule)")
    return out


if __name__ == "__main__":
    found = problems()
    for p in found:
        print(p)
    print("no sparkle icon" if not found else f"{len(found)} sparkle problem(s)")
    sys.exit(1 if found else 0)
