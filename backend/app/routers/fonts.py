import json

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile
from starlette.concurrency import run_in_threadpool

from app.services import fonts, subset

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


@router.get("/similar")
async def similar(id: str, limit: int = 10) -> dict:
    found = await run_in_threadpool(fonts.similar, id, limit)
    if found is None:
        raise HTTPException(status_code=404, detail="That font is not installed on this computer.")
    return {"fonts": found}


@router.get("/file/{font_id}")
async def font_file(font_id: str) -> Response:
    found = await run_in_threadpool(fonts.font_file, font_id)
    if not found:
        raise HTTPException(status_code=404, detail="That font is not installed on this computer.")
    data, _ = found
    return Response(data, media_type="font/sfnt", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/subset")
def subset_font(
    request: Request,
    gids: str = Form(...),
    font_id: str = Form(""),
    axes: str = Form("{}"),
    file: UploadFile | None = File(None),
) -> Response:
    host = request.client.host if request.client else ""
    served = (request.headers.get("host") or "").rsplit(":", 1)[0].strip("[]")
    if host not in ("127.0.0.1", "::1", "localhost", "testclient") or served not in ("127.0.0.1", "localhost", "::1", "tauri.localhost"):
        raise HTTPException(status_code=403, detail="Font subsetting reads fonts from this computer, so it only works from this computer.")
    try:
        wanted = [int(g) for g in json.loads(gids)]
        spots = {str(k): float(v) for k, v in json.loads(axes).items()}
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=422, detail="gids must be a JSON list of glyph ids and axes a JSON object of axis tag to number.")
    if len(wanted) > 70000:
        raise HTTPException(status_code=422, detail="At most 70000 glyph ids can be subset at once.")
    if file is not None:
        data = file.file.read(subset.MAX_BYTES + 1)
    elif font_id:
        found = fonts.font_file(font_id)
        if not found:
            raise HTTPException(status_code=404, detail="That font is not installed on this computer.")
        data = found[0]
    else:
        raise HTTPException(status_code=422, detail="Send either font_id of an installed font or the font file itself.")
    try:
        out, outlines = subset.build(data, wanted, spots)
    except subset.SubsetError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return Response(out, media_type="font/sfnt", headers={"X-Font-Outlines": outlines, "Access-Control-Expose-Headers": "X-Font-Outlines"})
