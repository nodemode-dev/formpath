from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.routers.terminal import origin_ok
from app.services import color

router = APIRouter(prefix="/api/color", tags=["color"])

MAX_UPLOAD = 64 * 1024 * 1024


def require_local(request: Request) -> None:
    if not origin_ok(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(status_code=403, detail="Only the formpth window on this computer may manage colour profiles.")


class RgbToCmyk(BaseModel):
    rgb: str = Field(min_length=40, max_length=40)
    cmyk: str = Field(min_length=40, max_length=40)
    intent: int = Field(1, ge=0, le=3)
    bpc: bool = True
    grid: int = Field(17, ge=9, le=33)


class CmykToRgb(BaseModel):
    cmyk: str = Field(min_length=40, max_length=40)
    rgb: str = Field(min_length=40, max_length=40)
    intent: int = Field(1, ge=0, le=3)
    bpc: bool = True
    grid: int = Field(9, ge=9, le=11)


class Proof(BaseModel):
    rgb: str = Field(min_length=40, max_length=40)
    device: str = Field(min_length=40, max_length=40)
    monitor: str | None = Field(None, min_length=40, max_length=40)
    intent: int = Field(1, ge=0, le=3)
    bpc: bool = True
    paper: bool = False
    black_ink: bool = False
    grid: int = Field(17, ge=17, le=33)


def _lut(data: bytes, grid: int, channels: int) -> Response:
    return Response(data, media_type="application/octet-stream", headers={"X-Formpth-Grid": str(grid), "X-Formpth-Channels": str(channels), "Cache-Control": "no-store"})


async def _run(fn, *args):
    try:
        return await run_in_threadpool(fn, *args)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/profiles")
async def profiles(request: Request) -> dict:
    require_local(request)
    return {"profiles": await _run(color.listing)}


@router.post("/profiles")
async def upload_profile(request: Request, file: UploadFile = File(...)) -> dict:
    require_local(request)
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="That profile is larger than 64 MiB. Pick an ICC profile file (.icc or .icm).")
    return await _run(color.upload, file.filename or "profile.icc", data)


@router.get("/profiles/{pid}/bytes")
async def profile_bytes(pid: str, request: Request) -> Response:
    require_local(request)
    data = await run_in_threadpool(color.profile_bytes, pid)
    if data is None:
        raise HTTPException(status_code=404, detail="That colour profile is not available on this computer. Choose another one in Color Settings or load the file again.")
    return Response(data, media_type="application/vnd.iccprofile", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/lut/rgb-to-cmyk")
async def lut_rgb_to_cmyk(body: RgbToCmyk, request: Request) -> Response:
    require_local(request)
    data = await _run(color.rgb_to_cmyk, body.rgb, body.cmyk, body.intent, body.bpc, body.grid)
    return _lut(data, body.grid if body.grid in (9, 17, 33) else 17, 4)


@router.post("/lut/cmyk-to-rgb")
async def lut_cmyk_to_rgb(body: CmykToRgb, request: Request) -> Response:
    require_local(request)
    data = await _run(color.cmyk_to_rgb, body.cmyk, body.rgb, body.intent, body.bpc, body.grid)
    return _lut(data, body.grid if body.grid in (9, 11) else 9, 3)


@router.post("/lut/proof")
async def lut_proof(body: Proof, request: Request) -> Response:
    require_local(request)
    data = await _run(color.proof, body.rgb, body.device, body.intent, body.bpc, body.paper, body.black_ink, body.monitor, body.grid)
    return _lut(data, body.grid if body.grid in (17, 33) else 17, 3)
