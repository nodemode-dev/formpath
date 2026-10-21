from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.routers.terminal import origin_ok
from app.services import spell
from fastapi import HTTPException

router = APIRouter(prefix="/api/spell", tags=["spell"])


def require_local(request: Request) -> None:
    if not origin_ok(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(status_code=403, detail="Only the formpath window on this computer may use spell checking.")


class CheckBody(BaseModel):
    words: list[str] = Field(default_factory=list, max_length=20000)
    lang: str = Field("en", max_length=16)


class DictionaryBody(BaseModel):
    add: list[str] = Field(default_factory=list, max_length=500)
    remove: list[str] = Field(default_factory=list, max_length=500)


@router.post("/check")
async def check(body: CheckBody, request: Request) -> dict:
    require_local(request)
    words = [w[:64] for w in body.words]
    return {"unknown": await run_in_threadpool(spell.check, words, body.lang)}


@router.get("/dictionary")
async def get_dictionary(request: Request) -> dict:
    require_local(request)
    return {"words": await run_in_threadpool(spell.dictionary)}


@router.post("/dictionary")
async def post_dictionary(body: DictionaryBody, request: Request) -> dict:
    require_local(request)
    return {"words": await run_in_threadpool(spell.edit_dictionary, body.add, body.remove)}
