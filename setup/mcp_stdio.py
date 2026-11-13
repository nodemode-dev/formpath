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
ATTACH = os.environ.get("FORMPATH_MCP_ATTACH", "0") == "1"
_down = False
_changed = False
OFFLINE = "formpath is not running. Start it with ./formpath boot (or open the formpath app), then ask again."
PING_ONLY = [{"name": "ping", "description": "Reports whether formpath is running. It is not running now; start it with ./formpath boot, and the other tools appear.",
              "inputSchema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}, "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}}]


def forward(line: str) -> str | None:
    try:
        msg = json.loads(line)
    except ValueError:
        return json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
    params = msg.get("params") or {}
    version = (params.get("_meta") or {}).get("io.modelcontextprotocol/protocolVersion") or params.get("protocolVersion") or "2025-11-25"
    req = urllib.request.Request(URL, data=line.encode(), method="POST", headers={"Content-Type": "application/json", "Accept": "application/json", "MCP-Protocol-Version": version})
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            body = r.read().decode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode() or ""
    except (urllib.error.URLError, OSError) as exc:
        if isinstance(exc, TimeoutError) or isinstance(getattr(exc, "reason", None), TimeoutError):
            print(f"[formpath mcp] the engine at {URL} took too long to answer: {exc}", file=sys.stderr, flush=True)
            if msg.get("id") is None:
                return None
            return json.dumps({"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32000, "message": "formpath did not answer in time: it may be busy with a long task. Check the formpath window, then retry."}})
        print(f"[formpath mcp] the engine is not answering at {URL}: {exc}", file=sys.stderr, flush=True)
        if ATTACH:
            return offline(msg, version)
        if start_engine():
            return forward(line)
        if msg.get("id") is None:
            return None
        return json.dumps({"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32000, "message": "The formpath engine is not running and could not be started: run ./formpath boot in the formpath folder, then retry."}})
    global _down, _changed
    if _down:
        _down, _changed = False, True
    if msg.get("id") is None:
        return None
    return body.strip() or None


def offline(msg: dict, version: str) -> str | None:
    global _down
    _down = True
    rid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
    if rid is None:
        return None
    done = {"resultType": "complete"} if version == "2026-07-28" else {}
    server = {"name": "formpath", "version": "not running"}
    if method == "server/discover":
        result = {"supportedVersions": ["2026-07-28", "2025-11-25"], "capabilities": {"tools": {"listChanged": True}, "prompts": {}}, "_meta": {"io.modelcontextprotocol/serverInfo": server}, "instructions": OFFLINE}
    elif method == "initialize":
        result = {"protocolVersion": params.get("protocolVersion") or "2025-11-25", "capabilities": {"tools": {"listChanged": True}, "prompts": {}}, "serverInfo": server, "instructions": OFFLINE}
    elif method == "tools/list":
        result = {"tools": PING_ONLY}
    elif method == "tools/call":
        if params.get("name") != "ping":
            result = {"content": [{"type": "text", "text": OFFLINE}], "isError": True}
        else:
            result = {"content": [{"type": "text", "text": OFFLINE}], "structuredContent": {"version": "not running", "window": False}}
    elif method in ("ping", "prompts/list", "resources/list"):
        result = {"prompts": []} if method == "prompts/list" else {"resources": []} if method == "resources/list" else {}
    else:
        return json.dumps({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": f"Method not found: {method}"}})
    return json.dumps({"jsonrpc": "2.0", "id": rid, "result": {**result, **done}})


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
    global ATTACH, _changed
    for flag in sys.argv[1:]:
        if flag != "--attach":
            print(f"{flag}: not an option. ./formpath mcp takes --attach.", file=sys.stderr)
            sys.exit(2)
        ATTACH = True
    for line in sys.stdin:
        if not line.strip():
            continue
        out = forward(line)
        if _changed:
            _changed = False
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/tools/list_changed"}) + "\n")
            sys.stdout.flush()
        if out:
            sys.stdout.write(out + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
