import asyncio
import importlib
import importlib.util
import json
import time

import httpx
import pytest

from conftest import CHANGING_TOOL, ENGINE_PORT, MCP_PATH, REPO, window_headers

WINDOW_ORIGIN = "http://localhost:5230"
BRIDGE = "x-formpath-bridge"
OK = {"content": [{"type": "text", "text": "done"}]}


def state():
    return importlib.import_module("app.routers.mcp")


def clear():
    m = state()
    m._ready = None
    m._allowed = False
    m._declined_until = 0.0
    m._seen = 0.0
    m._secret = None
    m._withdrawals = False
    m._pending.clear()
    m._waiting.clear()
    m._delivered.clear()
    m._clients.clear()


@pytest.fixture(autouse=True)
def fresh_bridge(app):
    clear()
    yield
    clear()


def make_client(app):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=f"http://127.0.0.1:{ENGINE_PORT}", headers=window_headers())


class Window:
    def __init__(self, c, withdrawals=True):
        self.c = c
        self.secret = None
        self.withdrawals = withdrawals

    async def open(self):
        r = await self.c.post("/api/mcp/bridge/session", headers={"origin": WINDOW_ORIGIN})
        assert r.status_code == 200, r.text
        self.secret = r.json()["secret"]

    def headers(self):
        return {"origin": WINDOW_ORIGIN, BRIDGE: self.secret}

    async def poll(self, allowed):
        body = {"allowed": allowed, **({"withdrawals": True} if self.withdrawals else {})}
        r = await self.c.post("/api/mcp/bridge/next", headers=self.headers(), json=body)
        return r.json() if r.status_code == 200 else None

    async def next(self, allowed=False):
        return await asyncio.wait_for(self.poll(allowed), 10)

    async def answer(self, item, result):
        r = await self.c.post("/api/mcp/bridge/result", headers=self.headers(), json={"id": item["id"], "result": result})
        assert r.status_code == 200, r.text


async def until_live():
    for _ in range(100):
        if state()._seen:
            return
        await asyncio.sleep(0.05)
    raise AssertionError("the window never started polling")


async def announce(c, name):
    r = await c.post(MCP_PATH, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-11-25", "clientInfo": {"name": name, "version": "1"}}})
    assert r.status_code == 200, r.text
    return {"mcp-session-id": r.headers["mcp-session-id"]}


async def call(c, tool=CHANGING_TOOL, headers=None, rid=2):
    name, args = tool
    r = await c.post(MCP_PATH, json={"jsonrpc": "2.0", "id": rid, "method": "tools/call", "params": {"name": name, "arguments": args}}, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def text_of(reply):
    return " ".join(c.get("text", "") for c in (reply.get("result") or {}).get("content", []) if isinstance(c, dict))


def run(coro):
    return asyncio.run(asyncio.wait_for(coro, timeout=40))


async def asked(c, w, tool=CHANGING_TOOL, headers=None, rid=2):
    first = asyncio.create_task(w.poll(False))
    await until_live()
    pending = asyncio.create_task(call(c, tool, headers, rid))
    item = await asyncio.wait_for(first, 10)
    assert item["name"] == "__consent__"
    return item, pending


def test_the_question_says_who_asked_for_what_which_answers_exist_and_when_it_ends(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            agent = await announce(c, "probe-agent")
            item, pending = await asked(c, w, ("run_command", {"command": "object.group"}), agent)
            q = item["arguments"]
            assert isinstance(item["id"], str) and item["id"]
            assert q["client"] == "probe-agent" and q["tool"] == "run_command" and q["what"] == "run the command object.group"
            assert q["answers"] == ["deny", "once", "always"] and q["alwaysCovers"] == "all"
            assert q["seconds"] == state().CONSENT_SECONDS
            assert 0 < q["expiresAt"] / 1000 - time.time() <= state().CONSENT_SECONDS
            await w.answer(item, {"allowed": False})
            assert "did not allow outside agents" in text_of(await asyncio.wait_for(pending, 10))
    run(go())


def test_an_agent_that_gave_no_name_is_asked_about_with_an_empty_name(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            item, pending = await asked(c, w)
            assert item["arguments"]["client"] == "" and item["arguments"]["what"] == "use select"
            await w.answer(item, {"allowed": False})
            await asyncio.wait_for(pending, 10)
    run(go())


def test_the_relay_header_names_the_agent(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            item, pending = await asked(c, w, headers={"x-formpath-client": "relay-probe"})
            assert item["arguments"]["client"] == "relay-probe"
            await w.answer(item, {"allowed": False})
            await asyncio.wait_for(pending, 10)
    run(go())


def test_allow_once_runs_this_call_and_the_next_call_asks_again(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c, withdrawals=False)
            await w.open()
            for rid in (2, 3):
                item, pending = await asked(c, w, rid=rid)
                await w.answer(item, {"allowed": True, "once": True})
                tool = await w.next(False)
                assert tool["name"] == CHANGING_TOOL[0] and tool["once"] is True
                await w.answer(tool, OK)
                assert text_of(await asyncio.wait_for(pending, 10)) == "done"
                assert state()._allowed is False
    run(go())


def test_the_plain_allow_still_means_every_later_call_runs(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c, withdrawals=False)
            await w.open()
            item, pending = await asked(c, w)
            await w.answer(item, {"allowed": True})
            tool = await w.next(False)
            assert tool["name"] == CHANGING_TOOL[0]
            assert state()._allowed is True
            await w.answer(tool, OK)
            assert text_of(await asyncio.wait_for(pending, 10)) == "done"
            second = asyncio.create_task(call(c, rid=4))
            tool2 = await w.next(True)
            assert tool2["name"] == CHANGING_TOOL[0] and "once" not in tool2
            await w.answer(tool2, OK)
            assert text_of(await asyncio.wait_for(second, 10)) == "done"
    run(go())


def test_an_answer_withdraws_the_question_for_a_window_that_asked_to_be_told(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            item, pending = await asked(c, w)
            await w.answer(item, {"allowed": False})
            await asyncio.wait_for(pending, 10)
            gone = await w.next(False)
            assert gone["name"] == "__withdrawn__" and gone["arguments"] == {"request": item["id"], "reason": "answered"}
            assert gone["id"] not in state()._delivered
    run(go())


def test_a_window_that_did_not_ask_is_sent_no_withdrawal(app):
    async def go():
        async with make_client(app) as c:
            w = Window(c, withdrawals=False)
            await w.open()
            item, pending = await asked(c, w)
            await w.answer(item, {"allowed": False})
            await asyncio.wait_for(pending, 10)
            assert not state()._pending
    run(go())


def test_a_question_nobody_answers_expires_and_is_withdrawn(app, monkeypatch):
    monkeypatch.setattr(state(), "CONSENT_SECONDS", 0.3)

    async def go():
        async with make_client(app) as c:
            w = Window(c)
            await w.open()
            item, pending = await asked(c, w)
            reply = await asyncio.wait_for(pending, 10)
            assert reply["result"]["isError"] and "did not allow outside agents" in text_of(reply)
            gone = await w.next(False)
            assert gone["name"] == "__withdrawn__" and gone["arguments"] == {"request": item["id"], "reason": "expired"}
            r = await c.post("/api/mcp/bridge/result", headers=w.headers(), json={"id": item["id"], "result": {"allowed": True}})
            assert r.status_code == 403
            assert state()._allowed is False
    run(go())


def test_the_status_says_which_answers_the_engine_takes(client):
    consent = client.get("/api/mcp/status").json()["consent"]
    assert consent == {"answers": ["deny", "once", "always"], "alwaysCovers": "all", "seconds": 180.0, "withdrawals": True}


def test_the_stdio_relay_passes_on_the_name_the_agent_announced(monkeypatch):
    spec = importlib.util.spec_from_file_location("formpath_mcp_stdio_under_test", REPO / "setup" / "mcp_stdio.py")
    relay = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(relay)
    sent = []

    class Reply:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return b'{"jsonrpc": "2.0", "id": 1, "result": {}}'

    def fake(req, timeout=0):
        sent.append({k.lower(): v for k, v in req.header_items()})
        return Reply()

    monkeypatch.setattr(relay.urllib.request, "urlopen", fake)
    relay.forward(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}))
    relay.forward(json.dumps({"jsonrpc": "2.0", "id": 2, "method": "initialize", "params": {"protocolVersion": "2025-11-25", "clientInfo": {"name": "relay-probe"}}}))
    relay.forward(json.dumps({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "select", "arguments": {}}}))
    assert "x-formpath-client" not in sent[0]
    assert sent[1]["x-formpath-client"] == "relay-probe" and sent[2]["x-formpath-client"] == "relay-probe"
