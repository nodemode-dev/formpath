import json
import os
import subprocess
import time
from pathlib import Path

from app.services import agent_lookup, claude_code, terminal

TOKEN_VAR = "FORMPATH_INAPP_TOKEN"
PROGRAMS = {
    "codex": {"bin": "codex", "title": "Codex", "install": "npm install -g @openai/codex"},
    "cursor": {"bin": "cursor-agent", "title": "Cursor", "install": "curl https://cursor.com/install -fsS | bash"},
    "antigravity": {"bin": "agy", "title": "Antigravity", "install": agent_lookup.install("antigravity")},
}
TABS = ("codex", "cursor")
CACHE_SECONDS = 60.0
_cache: dict = {"at": 0.0, "value": None}


def find(kind: str) -> str | None:
    return claude_code.located(kind).path


def _claude_signed_in(path: str) -> bool | None:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        return True
    try:
        out = agent_lookup.run([path, "auth", "status"], claude_code.child_env(path), claude_code.CHECK_WAIT)
        data = json.loads(out.stdout)
    except (OSError, subprocess.SubprocessError, ValueError):
        return None
    return bool(data.get("loggedIn")) if isinstance(data, dict) and "loggedIn" in data else None


def status(fresh: bool = False) -> dict:
    if not fresh and _cache["value"] is not None and time.time() - _cache["at"] < CACHE_SECONDS:
        return _cache["value"]
    found = claude_code.info(fresh)
    out = {"claude": found | {"signedIn": _claude_signed_in(found["path"]) if found["installed"] else None, "install": claude_code.INSTALL_CMD, "title": "Claude Code"}}
    for kind, program in PROGRAMS.items():
        seen = claude_code.located(kind, fresh)
        out[kind] = agent_lookup.answer(seen, program["install"], claude_code.otherwise(kind)) | {"signedIn": None, "install": program["install"], "title": program["title"]}
    _cache["value"], _cache["at"] = out, time.time()
    return out


def codex_args() -> list[str]:
    server = f'{{url="{terminal.engine_url()}/mcp",env_http_headers={{"{claude_code.INAPP_HEADER}"="{TOKEN_VAR}"}}}}'
    return ["-c", f"mcp_servers.formpath_tab={server}"]


def cursor_entry() -> dict:
    return {"url": "${env:FORMPATH_MCP_URL}", "headers": {claude_code.INAPP_HEADER: "${env:" + TOKEN_VAR + "}"}}


def write_cursor_config(folder: str) -> Path | None:
    path = Path(folder) / ".cursor" / "mcp.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or not isinstance(data.setdefault("mcpServers", {}), dict):
        return None
    if data["mcpServers"].get("formpath_tab") == cursor_entry():
        return path
    data["mcpServers"]["formpath_tab"] = cursor_entry()
    try:
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as handle:
            handle.write(json.dumps(data, indent=2) + "\n")
    except OSError:
        return None
    return path


def open_terminal(kind: str, cols: int = 100, rows: int = 30) -> dict:
    if kind not in TABS:
        raise ValueError(f"formpath has no agent program called {kind}.")
    program = PROGRAMS[kind]
    found = claude_code.usable(kind)
    if found.state != "runs":
        raise LookupError(claude_code.said(found))
    path = found.path
    folder = str(claude_code.workdir())
    if kind == "cursor":
        write_cursor_config(folder)
    token = claude_code.issue_env()
    env = claude_code.child_env(path) | {TOKEN_VAR: token}
    try:
        session = terminal.open_session(folder, cols, rows, program["title"], claude_code._wrap([path] + (codex_args() if kind == "codex" else [])), env, kind, token)
    except BaseException:
        claude_code.revoke(token)
        raise
    _cache["value"] = None
    return session.describe()
