import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services import outlines

router = APIRouter(prefix="/api/fonts", tags=["fonts"])


@router.post("/outlines")
def font_outlines(ids: str = Form(...), kind: str = Form("gid"), key: str = Form(""), enc: str = Form(""), file: UploadFile | None = File(None)) -> dict:
    try:
        wanted = [int(i) for i in json.loads(ids)]
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="ids must be a JSON list of glyph or character ids.")
    if kind not in ("gid", "cid", "code"):
        raise HTTPException(status_code=422, detail="kind is gid, cid or code.")
    try:
        told = json.loads(enc) if enc else {}
        names = {str(int(k)): str(v)[:64] for k, v in list((told.get("names") or {}).items())[:256]}
        told = {"base": str(told.get("base") or "")[:32], "symbolic": bool(told.get("symbolic")), "names": names}
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=422, detail="enc must be a JSON object with base, symbolic and names.")
    if file is not None:
        data = file.file.read(outlines.MAX_BYTES + 1)
        try:
            key = outlines.load(data)
        except outlines.OutlineError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    found = outlines.glyphs(key, kind, wanted, told) if key else None
    if found is None:
        raise HTTPException(status_code=409, detail="Send the font program again; the engine no longer holds it.")
    return found
