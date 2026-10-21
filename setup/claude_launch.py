#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def config() -> str:
    server = {"type": "stdio", "command": sys.executable, "args": [os.path.join(ROOT, "setup", "mcp_stdio.py")]}
    return json.dumps({"mcpServers": {"formpath": server}})


def main(argv: list[str]) -> int:
    claude = os.environ.get("FORMPATH_CLAUDE_BIN") or shutil.which("claude")
    if not claude:
        print("[formpath] Claude Code is not installed: https://claude.com/claude-code", file=sys.stderr)
        return 1
    if "--print-config" in argv:
        print(config())
        return 0
    return subprocess.call([claude, "--mcp-config", config(), "--allowedTools", "mcp__formpath", *argv])


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
