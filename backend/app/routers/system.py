from fastapi import APIRouter, HTTPException, Request

from app.core import config, window_key

router = APIRouter(tags=["system"])


@router.post("/window/key")
def claim_window_key() -> dict:
    if window_key.stdout_mode():
        raise HTTPException(404, "Not Found")
    key = window_key.claim()
    if key is None:
        raise HTTPException(409, "Another window already holds this engine's window key; use that window, or restart formpath")
    return {"key": key}


@router.post("/window/ticket")
def window_ticket(request: Request) -> dict:
    window_key.require(request)
    return {"ticket": window_key.ticket()}


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/version")
def version() -> dict:
    return {"name": config.APP_NAME, "version": config.VERSION}


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "name": config.APP_NAME,
        "version": config.VERSION,
        "desktop": config.is_desktop(),
        "dataDir": str(config.data_dir()),
        "libraryDir": str(config.projects_dir()),
        "fonts": True,
        "secondWindowClaim": window_key.STATE["secondClaim"],
    }
