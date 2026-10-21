#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

URL = os.environ.get("FORMPATH_MCP_URL", "http://127.0.0.1:8230/mcp")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_started = False


def forward(line: str) -> str | None:
    try:
        msg = json.loads(line)
    except ValueError:
        return json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
    params = msg.get("params") or {}
    version = (params.get("_meta") or {}).get("io.modelcontextprotocol/protocolVersion") or params.get("protocolVersion") or "2025-11-25"
    req = urllib.request.Request(URL, data=line.encode(), method="POST", headers={"Content-Type": "application/json", "Accept": "application/json", "MCP-Protocol-Version": version})
    try:
        with urllib.request.urlopen(req, timeout=660) as r:
            body = r.read().decode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode() or ""
    except (urllib.error.URLError, OSError) as exc:
        print(f"[formpath mcp] the engine is not answering at {URL}: {exc}", file=sys.stderr, flush=True)
        if start_engine():
            return forward(line)
        if msg.get("id") is None:
            return None
        return json.dumps({"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32000, "message": "The formpath engine is not running and could not be started: run ./formpath boot in the formpath folder, then retry."}})
    if msg.get("id") is None:
        return None
    return body.strip() or None


def start_engine() -> bool:
    global _started
    if _started or os.environ.get("FORMPATH_MCP_AUTOSTART", "1") == "0" or os.environ.get("FORMPATH_MCP_URL"):
        return False
    _started = True
    command = "serve" if os.path.isfile(os.path.join(ROOT, "frontend", "dist", "index.html")) else "boot"
    log = open(os.path.join(tempfile.gettempdir(), "formpath-engine.log"), "ab")
    print(f"[formpath mcp] starting the engine (./formpath {command}); its log: {log.name}", file=sys.stderr, flush=True)
    launcher = [os.path.join(ROOT, "formpath.bat")] if os.name == "nt" else [os.path.join(ROOT, "formpath")]
    kwargs = {"creationflags": 0x00000008} if os.name == "nt" else {"start_new_session": True}
    subprocess.Popen(launcher + [command], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, **kwargs)
    for _ in range(120):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen(URL.rsplit("/mcp", 1)[0] + "/api/version", timeout=2) as r:
                if r.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            continue
    return False


def main() -> None:
    for line in sys.stdin:
        if not line.strip():
            continue
        out = forward(line)
        if out:
            sys.stdout.write(out + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
