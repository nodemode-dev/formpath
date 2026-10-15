import asyncio
import base64
import json
import os
import secrets
import shlex
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from app.core import config
from app.services import terminal

INAPP_HEADER = "x-formpth-inapp"
INAPP_TOKEN = secrets.token_urlsafe(32)
KEEP_ENV = {"CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CONFIG_DIR"}
CANDIDATES = (".claude/local/claude", ".local/bin/claude", ".npm-global/bin/claude", ".bun/bin/claude", ".volta/bin/claude")
SYSTEM_PATHS = ("/opt/homebrew/bin/claude", "/usr/local/bin/claude", "/usr/bin/claude")
INSTALL_CMD = "irm https://claude.ai/install.ps1 | iex" if os.name == "nt" else "curl -fsSL https://claude.ai/install.sh | bash"
INSTALL = f"Claude Code is not installed. Install it ({INSTALL_CMD}, or from https://claude.com/claude-code), run claude once in a terminal to sign in, then open it here again."
NOTE = ("You are Claude Code running inside formpth, the vector illustration editor open on this computer. "
        "Draw and edit the open document with the formpth MCP server's tools: start with get_document, look with get_image before and after a change, "
        "and use list_commands, describe_command and run_command to reach any menu command. "
        "Every change happens live in the window the person is watching and is one undo step. Use the formpth-harness skill when it is available.")
CHAT_NOTE = (NOTE + " You are answering in formpth's Chat tab, which shows Markdown to people who may never have used a terminal: "
             "write short paragraphs, use **bold** for panel and setting names and a bulleted list when you changed several things, "
             "avoid tables and code blocks, say what you changed in an illustrator's words, and keep tool calls few by batching.")
MAX_MESSAGES = 200
HIDDEN = {"ToolSearch"}
_cache: dict = {"at": 0.0, "value": None}
_lock = threading.Lock()


def prefs_file() -> Path:
    return config.data_dir() / "agent.json"


def prefs() -> dict:
    try:
        data = json.loads(prefs_file().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_prefs(values: dict) -> dict:
    current = prefs()
    for key in ("claudeBin", "claudeFolder", "claudeFirstMessage"):
        if key in values and isinstance(values[key], str):
            current[key] = values[key].strip()
    prefs_file().write_text(json.dumps(current, indent=2), encoding="utf-8")
    _cache["value"] = None
    return current


def _pref(key: str) -> str:
    value = prefs().get(key)
    return value.strip() if isinstance(value, str) else ""


def child_env() -> dict:
    return {k: v for k, v in terminal.base_env().items() if not k.startswith("CLAUDE") or k in KEEP_ENV}


def _runnable(path: str) -> bool:
    p = Path(path).expanduser()
    return p.is_file() and os.access(p, os.X_OK)


def _from_login_shell() -> str | None:
    if os.name == "nt":
        return None
    try:
        out = subprocess.run(terminal.login_shell() + ["-c", "command -v claude"], capture_output=True, text=True, timeout=10, env=child_env())
    except (OSError, subprocess.SubprocessError):
        return None
    found = out.stdout.strip().splitlines()[-1:] if out.returncode == 0 else []
    return found[0] if found and os.path.isabs(found[0]) else None


def cli() -> str | None:
    chosen = _pref("claudeBin")
    if chosen and _runnable(chosen):
        return str(Path(chosen).expanduser())
    found = os.environ.get("FORMPTH_CLAUDE_BIN") or shutil.which("claude")
    if found:
        return found
    home = Path.home()
    for p in [home / c for c in CANDIDATES] + [Path(s) for s in SYSTEM_PATHS]:
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return _from_login_shell()


def info(fresh: bool = False) -> dict:
    if not fresh and _cache["value"] is not None and time.time() - _cache["at"] < 60:
        return _cache["value"]
    path, version = cli(), None
    if path:
        try:
            out = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=15, env=child_env())
            version = (out.stdout.strip().split() or [None])[0]
        except (OSError, subprocess.SubprocessError):
            path = None
    _cache["value"], _cache["at"] = {"installed": bool(path), "path": path, "version": version, "install": INSTALL_CMD}, time.time()
    return _cache["value"]


def mcp_config() -> str:
    return json.dumps({"mcpServers": {"formpth": {"type": "http", "url": terminal.engine_url() + "/mcp", "headers": {INAPP_HEADER: INAPP_TOKEN}}}})


def is_inapp(value: str | None) -> bool:
    return bool(value) and secrets.compare_digest(value, INAPP_TOKEN)


def workdir() -> Path:
    raw = _pref("claudeFolder") or os.environ.get("FORMPTH_AGENT_DIR", "").strip()
    folder = Path(raw).expanduser() if raw else config.data_dir() / "Agent"
    try:
        folder.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ValueError(f"Claude Code cannot start in {folder}: {exc.strerror or exc}. Choose another folder in Preferences > Agents.") from None
    return folder


def _wrap(cmd: list[str]) -> list[str]:
    return cmd if os.name == "nt" else terminal.login_shell() + ["-c", "exec " + shlex.join(cmd)]


def argv(path: str, prompt: str | None, resume: str | None = None) -> list[str]:
    cmd = [path, "--mcp-config", mcp_config(), "--allowedTools", "mcp__formpth", "--append-system-prompt", NOTE]
    if resume:
        cmd += ["--resume", resume]
    if prompt:
        cmd.append(prompt)
    return _wrap(cmd)


def status() -> dict:
    tab = next((s.describe() for s in terminal.SESSIONS.values() if s.kind == "claude"), None)
    chosen = _pref("claudeBin")
    note = f"{chosen} is not a program formpth can run, so it uses the one found on this computer." if chosen and not _runnable(chosen) else ""
    try:
        folder = str(workdir())
    except ValueError as exc:
        folder, note = "", str(exc)
    return info(fresh=True) | {"folder": folder, "terminal": tab, "binNote": note, "firstMessage": _pref("claudeFirstMessage")}


def open_tab(prompt: str | None = None, cols: int = 100, rows: int = 30, fresh: bool = False, resume: str | None = None) -> dict:
    running = next((s for s in terminal.SESSIONS.values() if s.kind == "claude" and s.alive), None)
    if running is not None and not fresh and not resume:
        if prompt:
            terminal.write(running.id, prompt + "\r")
        return running.describe()
    found = info(fresh=True)
    if not found["installed"]:
        raise LookupError(INSTALL)
    prompt = prompt or _pref("claudeFirstMessage") or None
    title = "Claude Code (from Chat)" if resume else "Claude Code"
    session = terminal.open_session(str(workdir()), cols, rows, title, argv(found["path"], prompt, resume), child_env(), "claude")
    return session.describe()


def _blank_usage() -> dict:
    return {"input": 0, "output": 0, "costUsd": 0.0, "context": 0, "window": 0, "model": ""}


CHAT: dict[str, Any] = {"session": None, "proc": None, "busy": False, "messages": [], "turn": 0, "usage": _blank_usage(), "cancelled": False}
SUBSCRIBERS: set[asyncio.Queue] = set()


def _deliver(msg: dict) -> None:
    for q in list(SUBSCRIBERS):
        if q.qsize() < 4000:
            q.put_nowait(msg)


def publish(kind: str, **data: Any) -> None:
    terminal.call_in_loop(_deliver, {"type": kind, "turn": CHAT["turn"], **data})


def _tool_name(name: str) -> str:
    return name.split("__")[-1] if name.startswith("mcp__") else name


def _brief(value: Any) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return text if len(text) <= 160 else text[:157] + "..."


def _save_image(block: dict) -> str | None:
    src = block.get("source") or {}
    if src.get("type") != "base64" or not src.get("data"):
        return None
    ext = {"image/png": "png", "image/webp": "webp"}.get(str(src.get("media_type")), "jpg")
    folder = config.data_dir() / "Chat"
    try:
        folder.mkdir(parents=True, exist_ok=True)
        name = f"{uuid.uuid4().hex}.{ext}"
        (folder / name).write_bytes(base64.b64decode(src["data"]))
    except (OSError, ValueError):
        return None
    return name


def chat_image(name: str) -> Path | None:
    if not name or "/" in name or "\\" in name or name.startswith("."):
        return None
    path = config.data_dir() / "Chat" / name
    return path if path.is_file() else None


def _chat_argv(path: str, text: str, session: str | None) -> list[str]:
    cmd = [path, "-p", text, "--output-format", "stream-json", "--verbose", "--include-partial-messages",
           "--mcp-config", mcp_config(), "--allowedTools", "mcp__formpth", "--append-system-prompt", CHAT_NOTE]
    if session:
        cmd += ["--resume", session]
    return _wrap(cmd)


def _usage_of(u: dict) -> tuple[int, int]:
    context = int(u.get("input_tokens") or 0) + int(u.get("cache_creation_input_tokens") or 0) + int(u.get("cache_read_input_tokens") or 0)
    return context, int(u.get("output_tokens") or 0)


def _run(text: str, path: str, folder: str) -> None:
    reply: dict[str, Any] = {"role": "assistant", "parts": [], "error": "", "meta": {}}
    tail: list[str] = []
    started = time.time()
    result: dict | None = None
    usage = CHAT["usage"]
    try:
        proc = subprocess.Popen(_chat_argv(path, text, CHAT["session"]), cwd=folder, env=child_env(), stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1, encoding="utf-8", errors="replace")
        CHAT["proc"] = proc

        def drain() -> None:
            for line in proc.stderr:
                tail.append(line.rstrip())
                del tail[:-15]
        threading.Thread(target=drain, daemon=True).start()
        for line in proc.stdout:
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            t = ev.get("type")
            if ev.get("parent_tool_use_id"):
                continue
            if t == "system" and ev.get("subtype") == "init":
                CHAT["session"] = ev.get("session_id") or CHAT["session"]
                usage["model"] = str(ev.get("model") or usage["model"])
            elif t == "stream_event":
                e = ev.get("event") or {}
                d = e.get("delta") or {}
                if e.get("type") == "message_start":
                    u = (e.get("message") or {}).get("usage")
                    if isinstance(u, dict):
                        usage["context"] = _usage_of(u)[0] or usage["context"]
                        publish("usage", context=usage["context"], window=usage["window"], model=usage["model"])
                elif e.get("type") == "content_block_delta" and d.get("type") == "text_delta" and d.get("text"):
                    if not reply["parts"] or reply["parts"][-1]["kind"] != "text":
                        reply["parts"].append({"kind": "text", "text": ""})
                    reply["parts"][-1]["text"] += d["text"]
                    publish("delta", text=d["text"])
            elif t == "assistant":
                for b in (ev.get("message") or {}).get("content") or []:
                    if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") not in HIDDEN:
                        part = {"kind": "tool", "id": b.get("id"), "name": _tool_name(str(b.get("name") or "")), "input": _brief(b.get("input") or {}), "status": "running"}
                        reply["parts"].append(part)
                        publish("tool", **{k: part[k] for k in ("id", "name", "input")})
            elif t == "user":
                for b in (ev.get("message") or {}).get("content") or []:
                    if isinstance(b, dict) and b.get("type") == "tool_result" and any(p["kind"] == "tool" and p["id"] == b.get("tool_use_id") for p in reply["parts"]):
                        state = "error" if b.get("is_error") else "done"
                        content = b.get("content") if isinstance(b.get("content"), list) else []
                        images = [p for p in (_save_image(c) for c in content if isinstance(c, dict) and c.get("type") == "image") if p]
                        for p in reply["parts"]:
                            if p["kind"] == "tool" and p["id"] == b.get("tool_use_id"):
                                p["status"] = state
                                if images:
                                    p["images"] = images
                        publish("toolDone", id=b.get("tool_use_id"), status=state, images=images)
            elif t == "result":
                result = ev
                CHAT["session"] = ev.get("session_id") or CHAT["session"]
                total = ev.get("usage") or {}
                usage["input"] += _usage_of(total)[0]
                usage["output"] += int(total.get("output_tokens") or 0)
                usage["costUsd"] = round(usage["costUsd"] + float(ev.get("total_cost_usd") or 0), 6)
                per = (ev.get("modelUsage") or {}).get(usage["model"]) or {}
                usage["window"] = int(per.get("contextWindow") or usage["window"] or 0)
        proc.wait(timeout=30)
    except (OSError, subprocess.SubprocessError) as exc:
        reply["error"] = f"Claude Code could not run: {exc}"
    finally:
        CHAT["proc"] = None
    if result is None and not reply["error"]:
        reply["error"] = "Stopped" if CHAT.get("cancelled") else "Claude Code stopped before answering" + (f": {tail[-1]}" if tail else "")
    elif result is not None and result.get("is_error"):
        reply["error"] = str(result.get("result") or result.get("subtype") or "Claude Code reported an error")
        if "login" in reply["error"].lower() or "api key" in reply["error"].lower():
            reply["error"] += ". Open the Claude Code tab, sign in with /login, then send again."
    reply["meta"] = {"seconds": round(time.time() - started, 1), "turns": (result or {}).get("num_turns"), "costUsd": (result or {}).get("total_cost_usd")}
    with _lock:
        CHAT["messages"].append(reply)
        del CHAT["messages"][:-MAX_MESSAGES]
        CHAT["busy"] = False
        CHAT["cancelled"] = False
    publish("done", error=reply["error"], meta=reply["meta"], usage=dict(usage))


def chat_state() -> dict:
    return {"busy": CHAT["busy"], "messages": CHAT["messages"], "session": CHAT["session"] or "", "turn": CHAT["turn"], "usage": CHAT["usage"]}


def chat_send(text: str, context: str = "", note: str = "") -> dict:
    shown = str(text or "").strip()
    if not shown:
        raise ValueError("Type a message first.")
    prompt = f"{shown} ({context.strip()})" if context.strip() else shown
    found = info(fresh=True)
    if not found["installed"]:
        raise LookupError(INSTALL)
    folder = str(workdir())
    with _lock:
        if CHAT["busy"]:
            raise RuntimeError("Claude is still answering; wait or press Stop.")
        CHAT["busy"] = True
        CHAT["turn"] += 1
        CHAT["messages"].append({"role": "user", "text": shown, "note": note.strip()})
    publish("start", text=shown, note=note.strip())
    threading.Thread(target=_run, args=(prompt, found["path"], folder), daemon=True).start()
    return {"turn": CHAT["turn"]}


def chat_cancel() -> dict:
    proc = CHAT["proc"]
    if proc is not None and proc.poll() is None:
        CHAT["cancelled"] = True
        proc.terminate()
    return {"stopped": proc is not None}


def chat_reset() -> dict:
    chat_cancel()
    with _lock:
        CHAT["session"] = None
        CHAT["messages"] = []
        CHAT["turn"] += 1
        CHAT["usage"] = _blank_usage()
    publish("reset")
    return {"reset": True}


def _project_dir(folder: str) -> Path:
    root = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude").expanduser()
    return root / "projects" / "".join(ch if ch.isalnum() else "-" for ch in folder)


def _transcript(path: Path) -> list[dict]:
    out: list[dict] = []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return out
    for line in lines:
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        msg = ev.get("message") or {}
        if ev.get("type") not in ("user", "assistant") or ev.get("isSidechain") or ev.get("isMeta"):
            continue
        content = msg.get("content")
        texts = [content] if isinstance(content, str) else [b.get("text", "") for b in content or [] if isinstance(b, dict) and b.get("type") == "text"]
        tools = [b for b in content or [] if isinstance(b, dict) and b.get("type") == "tool_use"] if isinstance(content, list) else []
        text = "\n\n".join(t for t in texts if t and not t.startswith("<"))
        if ev["type"] == "user" and text:
            out.append({"role": "user", "text": text, "note": "from Claude Code"})
        elif ev["type"] == "assistant" and (text or tools):
            parts = [{"kind": "tool", "id": b.get("id"), "name": _tool_name(str(b.get("name") or "")), "input": _brief(b.get("input") or {}), "status": "done"}
                     for b in tools if b.get("name") not in HIDDEN]
            if text:
                parts.append({"kind": "text", "text": text})
            if out and out[-1]["role"] == "assistant":
                out[-1]["parts"] += parts
            elif parts:
                out.append({"role": "assistant", "parts": parts, "error": "", "meta": {}})
    return out[-MAX_MESSAGES:]


def chat_sessions() -> dict:
    folder = _project_dir(str(workdir()))
    items = []
    for f in sorted(folder.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)[:20]:
        first = next((m["text"] for m in _transcript(f) if m["role"] == "user"), "")
        items.append({"id": f.stem, "modified": f.stat().st_mtime, "title": first[:90], "current": f.stem == CHAT["session"]})
    return {"sessions": items, "folder": str(folder)}


def chat_adopt(session: str = "") -> dict:
    if CHAT["busy"]:
        raise RuntimeError("Claude is still answering; wait or press Stop.")
    listed = chat_sessions()["sessions"]
    pick = next((s for s in listed if s["id"] == session), None) if session else (listed[0] if listed else None)
    if pick is None:
        raise LookupError("No Claude Code conversation was found in formpth's agent folder yet.")
    messages = _transcript(_project_dir(str(workdir())) / f"{pick['id']}.jsonl")
    with _lock:
        CHAT["session"] = pick["id"]
        CHAT["messages"] = messages
        CHAT["turn"] += 1
        CHAT["usage"] = _blank_usage()
    publish("adopted", session=pick["id"], count=len(messages))
    return {"session": pick["id"], "messages": len(messages)}
