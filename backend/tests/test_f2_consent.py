import asyncio
import importlib

import httpx
import pytest

from conftest import CHANGING_TOOL, ENGINE_PORT, INAPP_HEADER, MCP_PATH, READ_TOOL, inapp_token

WINDOW_ORIGIN = "http://localhost:5230"
BRIDGE = "x-formpath-bridge"


def state():
    return importlib.import_module("app.routers.mcp")


@pytest.fixture(autouse=True)
def fresh_bridge(app):
    m = state()
    m._ready = None
    m._allowed = False
    m._declined_until = 0.0
    m._seen = 0.0
    m._secret = None
    m._pending.clear()
    m._waiting.clear()
    m._delivered.clear()
    yield
    m._ready = None
    m._allowed = False
    m._declined_until = 0.0
    m._seen = 0.0
    m._secret = None
    m._pending.clear()
    m._waiting.clear()
    m._delivered.clear()


def make_client(app):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=f"http://127.0.0.1:{ENGINE_PORT}")


class Window:
    def __init__(self, c):
        self.c = c
        self.secret = None

    async def open(self):
        r = await self.c.post("/api/mcp/bridge/session", headers={"origin": WINDOW_ORIGIN})
        assert r.status_code == 200, r.text
        self.secret = r.json()["secret"]

    def headers(self):
        return {"origin": WINDOW_ORIGIN, BRIDGE: self.secret}

    async def poll(self, allowed):
        r = await self.c.post("/api/mcp/bridge/next", headers=self.headers(), json={"allowed": allowed})
        return r.json() if r.status_code == 200 else None

    def start_poll(self, allowed):
        task = asyncio.create_task(self.poll(allowed))
        return task

    async def answer(self, item, result):
        r = await self.c.post("/api/mcp/bridge/result", headers=self.headers(), json={"id": item["id"], "result": result})
        assert r.status_code == 200, r.text


async def until_live():
    for _ in range(100):
        if state()._seen:
            return
        await asyncio.sleep(0.05)
    raise AssertionError("the window never started polling")


async def call(c, tool, headers=None, rid=2):
    name, args = tool
    r = await c.post(MCP_PATH, json={"jsonrpc": "2.0", "id": rid, "method": "tools/call", "params": {"name": name, "arguments": args}}, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def text_of(reply):
    return " ".join(c.get("text", "") for c in (reply.get("result") or {}).get("content", []) if isinstance(c, dict))


OK = {"content": [{"type": "text", "text": "done"}]}


def run(coro):
    return asyncio.run(asyncio.wait_for(coro, timeout=40))


def test_with_no_window_every_tool_is_refused_and_nothing_is_queued(app):
    async def go():
        async with make_client(app) as c:
            for tool in (READ_TOOL, CHANGING_TOOL):
                reply = await call(c, tool)
                assert reply["result"]["isError"]
                assert "not open" in text_of(reply)
            assert not state()._pending
    run(go())


def test_outside_agent_is_asked_before_a_changing_tool_runs(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            first = w.start_poll(False)
            await until_live()
            pending = asyncio.create_task(call(c, CHANGING_TOOL))
            item = await asyncio.wait_for(first, 10)
            assert item["name"] == "__consent__"
            assert not pending.done()
            await w.answer(item, {"allowed": False})
            reply = await asyncio.wait_for(pending, 10)
            assert reply["result"]["isError"]
            assert "did not allow outside agents" in text_of(reply)
    run(go())


def test_a_decline_blocks_the_next_call_without_asking_again(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            first = w.start_poll(False)
            await until_live()
            pending = asyncio.create_task(call(c, CHANGING_TOOL))
            item = await asyncio.wait_for(first, 10)
            await w.answer(item, {"allowed": False})
            await asyncio.wait_for(pending, 10)
            again = await call(c, CHANGING_TOOL, rid=3)
            assert again["result"]["isError"]
            assert "chose not to allow" in text_of(again)
            assert not state()._pending
    run(go())


def test_allowing_lets_the_tool_run_and_later_calls_skip_the_ask(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            first = w.start_poll(False)
            await until_live()
            pending = asyncio.create_task(call(c, CHANGING_TOOL))
            consent = await asyncio.wait_for(first, 10)
            assert consent["name"] == "__consent__"
            await w.answer(consent, {"allowed": True})
            tool = await asyncio.wait_for(w.poll(True), 10)
            assert tool["name"] == CHANGING_TOOL[0]
            await w.answer(tool, OK)
            reply = await asyncio.wait_for(pending, 10)
            assert not reply["result"].get("isError")
            assert text_of(reply) == "done"
            second = asyncio.create_task(call(c, READ_TOOL, rid=4))
            tool2 = await asyncio.wait_for(w.poll(True), 10)
            assert tool2["name"] == READ_TOOL[0]
            await w.answer(tool2, OK)
            assert text_of(await asyncio.wait_for(second, 10)) == "done"
    run(go())


def test_in_app_token_skips_the_ask(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            first = w.start_poll(False)
            await until_live()
            pending = asyncio.create_task(call(c, CHANGING_TOOL, {INAPP_HEADER: inapp_token()}))
            item = await asyncio.wait_for(first, 10)
            assert item["name"] == CHANGING_TOOL[0]
            await w.answer(item, OK)
            assert text_of(await asyncio.wait_for(pending, 10)) == "done"
    run(go())


@pytest.mark.parametrize("token", ["", "wrong-token", "x" * 64])
def test_wrong_in_app_token_still_asks(app, token):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            first = w.start_poll(False)
            await until_live()
            pending = asyncio.create_task(call(c, CHANGING_TOOL, {INAPP_HEADER: token}))
            item = await asyncio.wait_for(first, 10)
            assert item["name"] == "__consent__"
            await w.answer(item, {"allowed": False})
            assert (await asyncio.wait_for(pending, 10))["result"]["isError"]
    run(go())


def test_turning_outside_agents_off_fails_waiting_calls_and_blocks_new_ones(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            first = w.start_poll(False)
            await until_live()
            pending = asyncio.create_task(call(c, CHANGING_TOOL))
            consent = await asyncio.wait_for(first, 10)
            await w.answer(consent, {"allowed": True})
            for _ in range(100):
                if state()._pending:
                    break
                await asyncio.sleep(0.05)
            assert state()._pending
            assert (await c.post("/api/mcp/bridge/stop", headers=w.headers())).status_code == 200
            reply = await asyncio.wait_for(pending, 10)
            assert reply["result"]["isError"]
            assert "turned off" in text_of(reply)
            blocked = await call(c, CHANGING_TOOL, rid=5)
            assert "chose not to allow" in text_of(blocked)
    run(go())


def test_bridge_refuses_a_caller_without_the_window_session(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            no_secret = await c.post("/api/mcp/bridge/next", headers={"origin": WINDOW_ORIGIN}, json={"allowed": True})
            assert no_secret.status_code == 403
            wrong = await c.post("/api/mcp/bridge/next", headers={"origin": WINDOW_ORIGIN, BRIDGE: "not-the-secret"}, json={"allowed": True})
            assert wrong.status_code == 403
            no_origin = await c.post("/api/mcp/bridge/session")
            assert no_origin.status_code == 403
            stray = await c.post("/api/mcp/bridge/result", headers=w.headers(), json={"id": "999", "result": OK})
            assert stray.status_code == 403
    run(go())
