import json
import os
import tempfile
from pathlib import Path

from app import __version__

APP_NAME = "formpath"
VERSION = __version__
FRONTEND_PORT = 5230
BACKEND_PORT = 8230
MAX_SIDE_PT = 16_383 * 72
MAX_NODES = 500_000
MAX_DEPTH = 128
MAX_MANIFEST_BYTES = 64 * 1024 * 1024
MAX_ASSET_BYTES = 512 * 1024 * 1024
SESSION_TTL_SECONDS = 24 * 60 * 60
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


def _load_env_file() -> None:
    env = BACKEND_DIR / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if value.strip():
            os.environ.setdefault(key.strip(), value.strip())


_load_env_file()


def _ensure(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def data_dir() -> Path:
    raw = os.environ.get("FORMPATH_DATA_DIR")
    return _ensure(Path(raw).expanduser() if raw else Path.home() / "Formpath")


def default_projects_dir() -> Path:
    return data_dir() / "Projects"


def projects_dir() -> Path:
    raw = os.environ.get("FORMPATH_LIBRARY_DIR", "").strip()
    if not raw:
        try:
            raw = str(json.loads((data_dir() / "library.json").read_text()).get("folder", "")).strip()
        except (OSError, ValueError, AttributeError):
            raw = ""
    if raw:
        try:
            return _ensure(Path(raw).expanduser())
        except OSError:
            pass
    return _ensure(default_projects_dir())


def exports_dir() -> Path:
    return _ensure(data_dir() / "Exports")


def sessions_dir() -> Path:
    return _ensure(Path(tempfile.gettempdir()) / "formpath-sessions")


def dist_dir() -> Path | None:
    raw = os.environ.get("FORMPATH_DIST")
    candidate = Path(raw) if raw else REPO_DIR / "frontend" / "dist"
    return candidate if (candidate / "index.html").is_file() else None


def is_desktop() -> bool:
    return os.environ.get("FORMPATH_DESKTOP") == "1"


def port() -> int:
    try:
        return int(os.environ.get("FORMPATH_PORT", "") or BACKEND_PORT)
    except ValueError:
        return BACKEND_PORT


def cors_origins() -> list[str]:
    raw = os.environ.get("FORMPATH_CORS_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [f"http://localhost:{FRONTEND_PORT}", f"http://127.0.0.1:{FRONTEND_PORT}"]
