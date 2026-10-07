
import json
import urllib.error

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services import outbound

router = APIRouter(prefix="/api/nodemode", tags=["nodemode"])
TIMEOUT = 20


def _base(target: str) -> str:
    return outbound.base(target, "NodeMode", "http://localhost:8000")


def _request(url: str, data: bytes | None = None, headers: dict | None = None, method: str = "GET", timeout: float = TIMEOUT):
    return outbound.request(url, data, headers, method, timeout)


def _unreachable(base: str, exc: Exception) -> HTTPException:
    return outbound.unreachable("NodeMode", base, "Preferences > Plugins", exc)


@router.get("/status")
def status(target: str) -> dict:
    base = _base(target)
    try:
        with _request(base + "/", timeout=3):
            pass
    except urllib.error.HTTPError:
        pass
    except (urllib.error.URLError, OSError) as exc:
        return {"running": False, "receiver": False, "detail": str(_unreachable(base, exc).detail)}
    try:
        with _request(base + "/api/formvis/receive", timeout=3):
            receiver = True
    except urllib.error.HTTPError as exc:
        receiver = exc.code == 405
    except (urllib.error.URLError, OSError):
        receiver = False
    return {"running": True, "receiver": receiver}


def _upload(base: str, name: str, blob: bytes) -> str:
    body, kind = outbound.multipart("file", name, blob)
    with _request(base + "/api/upload", body, {"Content-Type": kind}, "POST") as r:
        reply = json.loads(r.read() or b"{}")
    url = reply.get("url") or reply.get("path")
    if not url:
        file_id = reply.get("file_id") or reply.get("id") or reply.get("filename")
        if not file_id:
            raise HTTPException(status_code=502, detail="NodeMode took the upload but did not say where it put it.")
        url = f"/api/files/{file_id}"
    return url if url.startswith("http") else base + (url if url.startswith("/") else "/" + url)


@router.post("/send")
async def send(target: str = Form(...), title: str = Form("formpth"), items: str = Form(...), files: list[UploadFile] = File(...)) -> dict:
    base = _base(target)
    try:
        meta = json.loads(items)
        assert isinstance(meta, list) and len(meta) == len(files) and 0 < len(files) <= 64
    except (ValueError, AssertionError):
        raise HTTPException(status_code=422, detail="Nothing to send, or the list of what is sent did not match the files.")
    sent = []
    try:
        for m, f in zip(meta, files):
            name = str(m.get("name") or "image")[:120].replace("/", "_").replace("\\", "_") + ".png"
            sent.append({"url": _upload(base, name, await f.read()), "filename": name, "fileType": "image",
                         "kind": m.get("kind", "image"), "width": int(m.get("width", 0)), "height": int(m.get("height", 0)),
                         **({"maskOf": int(m["maskOf"])} if isinstance(m.get("maskOf"), int) else {})})
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"NodeMode refused the upload ({exc.code}).")
    except (urllib.error.URLError, OSError) as exc:
        raise _unreachable(base, exc)
    announce = json.dumps({"source": "formpth", "title": title[:120], "files": sent}).encode()
    try:
        with _request(base + "/api/formvis/receive", announce, {"Content-Type": "application/json"}, "POST"):
            placed = True
    except urllib.error.HTTPError as exc:
        if exc.code not in (404, 405):
            raise HTTPException(status_code=502, detail=f"NodeMode refused what was sent ({exc.code}).")
        placed = False
    except (urllib.error.URLError, OSError) as exc:
        raise _unreachable(base, exc)
    return {"placed": placed, "files": sent,
            **({} if placed else {"detail": "Uploaded to NodeMode, but this NodeMode cannot place them on its canvas yet: it needs the form family's receiver. The files are in NodeMode's uploads."})}
