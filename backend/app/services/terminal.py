import asyncio
import os
import shutil
import sys
import threading
import uuid
from collections import deque
from pathlib import Path

from app.core import config

if os.name == "nt":
    from winpty import PtyProcess
else:
    from ptyprocess import PtyProcessUnicode as PtyProcess

SCROLLBACK = 256 * 1024
MIN_COLS, MIN_ROWS = 10, 4


class Session:
    def __init__(self, sid: str, title: str, cwd: str, argv: list[str], env: dict, kind: str) -> None:
        self.id = sid
        self.title = title
        self.cwd = cwd
        self.argv = argv
        self.env = env
        self.kind = kind
        self.proc = None
        self.chunks: deque[str] = deque()
        self.size = 0
        self.alive = False
        self.subscribers: set[asyncio.Queue] = set()
        self.lock = threading.Lock()
        self.gen = 0
        self.cols = 100
        self.rows = 30

    def describe(self) -> dict:
        return {"id": self.id, "title": self.title, "cwd": self.cwd, "alive": self.alive, "kind": self.kind}

    def keep(self, text: str) -> None:
        with self.lock:
            self.chunks.append(text)
            self.size += len(text)
            while self.size > SCROLLBACK and len(self.chunks) > 1:
                self.size -= len(self.chunks.popleft())

    def scrollback(self) -> str:
        with self.lock:
            return "".join(self.chunks)


SESSIONS: dict[str, Session] = {}
_loop: asyncio.AbstractEventLoop | None = None


def bind(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def call_in_loop(fn, *args) -> None:
    if _loop is not None and not _loop.is_closed():
        _loop.call_soon_threadsafe(fn, *args)


def engine_url() -> str:
    return f"http://127.0.0.1:{config.port()}"


def login_shell() -> list[str]:
    if os.name == "nt":
        return [os.environ.get("COMSPEC", "cmd.exe")]
    shell = os.environ.get("SHELL") or shutil.which("bash") or "/bin/sh"
    return [shell, "-l"]


def base_env() -> dict:
    env = dict(os.environ)
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    env["FORMPATH_TERMINAL"] = "1"
    env["FORMPATH_ENGINE_URL"] = engine_url()
    env["FORMPATH_MCP_URL"] = engine_url() + "/mcp"
    env["FORMPATH_URL"] = engine_url()
    from app.services import claude_code
    env["FORMPATH_INAPP_TOKEN"] = claude_code.INAPP_TOKEN
    if not getattr(sys, "frozen", False):
        env["PATH"] = str(config.REPO_DIR) + os.pathsep + env.get("PATH", "")
    return env


def _deliver(session: Session, text: str | None) -> None:
    for q in list(session.subscribers):
        if q.qsize() < 4000:
            q.put_nowait(text)


def _send(session: Session, text: str | None) -> None:
    call_in_loop(_deliver, session, text)


def _pump(session: Session, proc, gen: int) -> None:
    while True:
        try:
            text = proc.read(65536)
        except (EOFError, OSError):
            break
        if not text:
            continue
        if session.gen != gen:
            return
        session.keep(text)
        _send(session, text)
    if session.gen != gen:
        return
    session.alive = False
    _send(session, None)


def _spawn(session: Session) -> None:
    where = session.cwd if os.path.isdir(session.cwd) else str(Path.home())
    proc = PtyProcess.spawn(session.argv, cwd=where, env=session.env, dimensions=(session.rows, session.cols))
    session.proc = proc
    session.alive = True
    threading.Thread(target=_pump, args=(session, proc, session.gen), name=f"pty-{session.id}-{session.gen}", daemon=True).start()


def default_folder() -> str:
    return str(config.REPO_DIR) if (config.REPO_DIR / "frontend").is_dir() else str(Path.home())


def open_session(cwd: str | None = None, cols: int = 100, rows: int = 30, title: str | None = None,
                 argv: list[str] | None = None, env: dict | None = None, kind: str = "shell") -> Session:
    where = cwd or default_folder()
    if not os.path.isdir(where):
        raise FileNotFoundError(f"There is no folder {where}.")
    sid = uuid.uuid4().hex[:12]
    shells = sum(1 for s in SESSIONS.values() if s.kind == "shell")
    session = Session(sid, title or f"Terminal {shells + 1}", where, argv or login_shell(), env or base_env(), kind)
    session.cols, session.rows = max(MIN_COLS, cols), max(MIN_ROWS, rows)
    _spawn(session)
    SESSIONS[sid] = session
    return session


def restart(sid: str) -> Session:
    session = get(sid)
    old = session.proc
    session.gen += 1
    try:
        old.terminate(force=True)
    except Exception:
        pass
    with session.lock:
        session.chunks.clear()
        session.size = 0
    _send(session, "\x1bc")
    _spawn(session)
    return session


def write(sid: str, data: str) -> None:
    session = get(sid)
    if session.proc is not None and session.alive:
        session.proc.write(data)


def resize(sid: str, cols: int, rows: int) -> None:
    session = get(sid)
    session.cols, session.rows = max(MIN_COLS, cols), max(MIN_ROWS, rows)
    if session.alive and session.proc is not None:
        session.proc.setwinsize(session.rows, session.cols)


def close(sid: str) -> None:
    session = SESSIONS.pop(sid, None)
    if session is None:
        return
    session.gen += 1
    if session.proc is not None:
        try:
            session.proc.terminate(force=True)
        except Exception:
            pass
    _send(session, None)


def get(sid: str) -> Session:
    session = SESSIONS.get(sid)
    if session is None:
        raise KeyError(sid)
    return session


def listing() -> list[dict]:
    return [s.describe() for s in SESSIONS.values()]


def close_all() -> None:
    for sid in list(SESSIONS):
        close(sid)
