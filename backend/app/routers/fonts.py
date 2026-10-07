from fastapi import APIRouter, HTTPException, Response
from starlette.concurrency import run_in_threadpool

from app.services import fonts

router = APIRouter(prefix="/api/fonts", tags=["fonts"])


@router.get("")
async def listing() -> list[dict]:
    return await run_in_threadpool(fonts.listing)


@router.get("/find")
async def find(family: str, style: str = "Regular") -> dict:
    hit = await run_in_threadpool(fonts.find, family, style)
    if not hit:
        raise HTTPException(status_code=404, detail=f"The font {family} is not installed on this computer.")
    return {k: hit[k] for k in ("id", "family", "style", "full", "postscript")}


@router.get("/file/{font_id}")
async def font_file(font_id: str) -> Response:
    found = await run_in_threadpool(fonts.font_file, font_id)
    if not found:
        raise HTTPException(status_code=404, detail="That font is not installed on this computer.")
    data, _ = found
    return Response(data, media_type="font/sfnt", headers={"Cache-Control": "private, max-age=3600"})
