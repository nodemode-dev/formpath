#!/usr/bin/env python3
"""The README's code sizes, from the repository itself.

  python3 setup/line_counts.py            print the Stack sentence for README.md
  python3 setup/line_counts.py --check    exit 1 if README.md's figures have drifted from the code
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from icon_rules import problems as sparkle_problems

ROOT = Path(__file__).resolve().parent.parent
KINDS = (("TypeScript", ("frontend/src/",), ".ts"), ("CSS", ("frontend/src/",), ".css"),
         ("Python", ("backend/app/", "backend/formpath_engine.py", "setup/"), ".py"), ("Rust", ("src-tauri/src/",), ".rs"))


def counts(root: Path = ROOT) -> dict[str, int]:
    files = subprocess.run(["git", "ls-files"], cwd=root, capture_output=True, text=True, check=True).stdout.split("\n")
    out = {}
    for name, prefixes, ext in KINDS:
        total = 0
        for f in files:
            if f.endswith(ext) and f.startswith(prefixes):
                with open(root / f, encoding="utf-8") as fh:
                    total += sum(1 for _ in fh)
        out[name] = total
    return out


def rounded(n: int) -> int:
    return max(100, round(n / 100) * 100)


def sentence(c: dict[str, int]) -> str:
    t, css, py, rs = (f"{rounded(c[k]):,}" for k in ("TypeScript", "CSS", "Python", "Rust"))
    return f"about {t} lines of TypeScript, {css} of CSS, {py} of Python and {rs} of Rust"


def check(root: Path = ROOT) -> list[str]:
    readme = (root / "README.md").read_text(encoding="utf-8")
    problems = []
    m = re.search(r"about ([\d,]+) lines of TypeScript, ([\d,]+) of CSS, ([\d,]+) of Python and ([\d,]+) of Rust", readme)
    if not m:
        return ["README.md has no line-count sentence"]
    c = counts(root)
    for name, stated in zip(("TypeScript", "CSS", "Python", "Rust"), m.groups()):
        said, real = int(stated.replace(",", "")), c[name]
        if abs(said - real) > max(100, 0.03 * real):
            problems.append(f"{name}: README says {said:,}, the code has {real:,}")
    return problems + sparkle_problems(root)


if __name__ == "__main__":
    if "--check" in sys.argv:
        found = check()
        for p in found:
            print(p)
        print("README.md is accurate" if not found else f"{len(found)} problem(s)")
        sys.exit(1 if found else 0)
    print(sentence(counts()))
