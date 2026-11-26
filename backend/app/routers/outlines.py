import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services import outlines

router = APIRouter(prefix="/api/fonts", tags=["fonts"])


@router.post("/outlines")
def font_outlines(ids: str = Form(...), kind: str = Form("gid"), key: str = Form(""), file: UploadFile | None = File(None)) -> dict:
    try:
        wanted = [int(i) for i in json.loads(ids)]
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="ids must be a JSON list of glyph or character ids.")
    if kind not in ("gid", "cid"):
        raise HTTPException(status_code=422, detail="kind is gid or cid.")
    if file is not None:
        data = file.file.read(outlines.MAX_BYTES + 1)
        try:
            key = outlines.load(data)
        except outlines.OutlineError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    found = outlines.glyphs(key, kind, wanted) if key else None
    if found is None:
        raise HTTPException(status_code=409, detail="Send the font program again; the engine no longer holds it.")
    return found
