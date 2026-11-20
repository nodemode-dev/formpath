import json
import os
import stat
import subprocess
import sys
import time
import urllib.request

import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import BACKEND, PORT_ENV, REPO, free_port

LOOPBACK_HOST = {"host": "127.0.0.1:8230"}


@pytest.fixture
def key_state():
    from app.core import window_key

    saved = dict(window_key.STATE)
    yield window_key
    window_key.STATE.update(saved)


def test_secret_reads_need_the_key(client, bare):
    for path in ("/api/terminal", "/api/claude/status", "/api/claude/chat", "/api/claude/chat/sessions"):
        assert bare.get(path).status_code == 403, path
        assert client.get(path).status_code in (200, 409), path


def test_the_command_catalogue_and_status_reads_stay_open(bare):
    assert bare.get("/api/mcp/status").status_code == 200
    assert bare.get("/api/health").status_code == 200


def test_development_bootstrap_answers_once_then_refuses_and_records_the_second_try(bare, key_state, monkeypatch):
    monkeypatch.delenv(key_state.STDOUT_ENV, raising=False)
    key_state.STATE.update(claimed=False, secondClaim=False)
    first = bare.post("/api/window/key")
    assert first.status_code == 200 and first.json()["key"] == key_state.KEY
    assert bare.post("/api/window/key").status_code == 409
    assert bare.get("/api/capabilities").json()["secondWindowClaim"] is True


def test_packaged_mode_has_no_bootstrap(bare, key_state, monkeypatch):
    monkeypatch.setenv(key_state.STDOUT_ENV, "1")
    key_state.STATE.update(claimed=False, secondClaim=False)
    assert bare.post("/api/window/key").status_code == 404


def test_a_ticket_needs_the_key_and_works_once(client, bare, key_state):
    assert bare.post("/api/window/ticket").status_code == 403
    ticket = client.post("/api/window/ticket").json()["ticket"]
    assert key_state.spend(ticket) is True
    assert key_state.spend(ticket) is False
    assert key_state.spend("") is False
    assert key_state.spend(None) is False


def test_a_ticket_expires(client, key_state):
    ticket = client.post("/api/window/ticket").json()["ticket"]
    key_state.TICKETS[ticket] = time.monotonic() - key_state.TICKET_LIFE - 1
    assert key_state.spend(ticket) is False


@pytest.mark.parametrize("path", ["/api/claude/chat/stream", "/api/terminal/x/stream"])
def test_a_socket_without_a_ticket_is_closed(client, path):
    for query in ("", "?ticket=", "?ticket=made-up"):
        with pytest.raises(WebSocketDisconnect) as refused:
            with client.websocket_connect(path + query, headers=LOOPBACK_HOST) as ws:
                ws.receive()
        assert refused.value.code == 4403


def test_a_socket_with_a_ticket_opens_and_the_ticket_is_spent(client):
    ticket = client.post("/api/window/ticket").json()["ticket"]
    with client.websocket_connect(f"/api/claude/chat/stream?ticket={ticket}", headers=LOOPBACK_HOST) as ws:
        ws.close()
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/claude/chat/stream?ticket={ticket}", headers=LOOPBACK_HOST) as ws:
            ws.receive()


def test_a_terminal_cannot_be_opened_or_written_to_without_the_key(client, bare):
    assert bare.post("/api/terminal", json={}, headers={"origin": "http://localhost:5230"}).status_code == 403
    opened = client.post("/api/terminal", json={"cols": 80, "rows": 24})
    assert opened.status_code == 200
    sid = opened.json()["id"]
    try:
        assert bare.post(f"/api/terminal/{sid}/write", json={"data": "echo no\n"}).status_code == 403
        assert bare.get(f"/api/terminal/{sid}/read").status_code == 403
        assert bare.delete(f"/api/terminal/{sid}").status_code == 403
    finally:
        assert client.delete(f"/api/terminal/{sid}").status_code == 200


def test_the_program_that_runs_as_the_agent_changes_only_with_the_key(client, bare):
    assert bare.post("/api/claude/prefs", json={"claudeBin": "/tmp/anything"}).status_code == 403
    from app.services import claude_code

    assert claude_code.prefs().get("claudeBin", "") != "/tmp/anything"
    assert client.post("/api/claude/prefs", json={"claudeFirstMessage": ""}).status_code == 200
    for key in ("codexBin", "cursorBin", "antigravityBin"):
        assert bare.post("/api/claude/prefs", json={key: "/tmp/anything"}).status_code == 403, key
        assert claude_code.prefs().get(key) in (None, ""), key
    assert bare.get("/api/claude/prefs").status_code == 403
    places = client.get("/api/claude/prefs").json()
    assert set(places) == {"claudeBin", "codexBin", "cursorBin", "antigravityBin", "sealBroken"} and places["codexBin"] == ""


def test_a_plain_terminal_gets_no_agent_token_and_no_key_flag(monkeypatch):
    from app.core import window_key
    from app.services import claude_code, terminal

    token, _ = claude_code.issue()
    monkeypatch.setenv(window_key.STDOUT_ENV, "1")
    monkeypatch.setenv("FORMPATH_INAPP_TOKEN", token)
    env = terminal.base_env()
    assert "FORMPATH_INAPP_TOKEN" not in env
    assert window_key.STDOUT_ENV not in env
    assert token not in json.dumps(env)
    claude_code.revoke(token)


@pytest.mark.skipif(os.name == "nt", reason="file modes are a Unix notion")
def test_an_agent_token_lives_in_a_private_file_and_dies_with_its_tab():
    from app.services import claude_code, terminal

    first, file_one = claude_code.issue()
    second, file_two = claude_code.issue()
    assert first != second and file_one != file_two
    assert stat.S_IMODE(os.stat(file_one).st_mode) == 0o600
    command = " ".join(claude_code.argv("claude", file_one, None))
    assert first not in command and file_one in command
    assert claude_code.is_inapp(first) and claude_code.is_inapp(second)
    assert not claude_code.is_inapp("") and not claude_code.is_inapp(None) and not claude_code.is_inapp("x" * 43)
    session = terminal.open_session(None, 80, 24, "token tab", ["/bin/sleep", "30"], dict(os.environ), "claude", first)
    terminal.close(session.id)
    assert not claude_code.is_inapp(first) and not os.path.exists(file_one)
    assert claude_code.is_inapp(second) and os.path.exists(file_two)
    claude_code.revoke(second)
    assert not os.path.exists(file_two)


def test_sweep_removes_token_files_left_by_an_earlier_run():
    from app.services import claude_code

    claude_code.token_dir().mkdir(parents=True, exist_ok=True)
    stale = claude_code.token_dir() / "mcp-stale.json"
    stale.write_text("{}")
    claude_code.sweep()
    assert not stale.exists()


def run_engine(extra_env):
    port = free_port()
    env ={k: v for k, v in os.environ.items() if k != "FORMPATH_WINDOW_KEY_STDOUT"}
    env.update(extra_env)
    env[PORT_ENV] = str(port)
    proc = subprocess.Popen([sys.executable, str(BACKEND / "formpath_engine.py")], cwd=BACKEND, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline and proc.poll() is None:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1):
                break
        except OSError:
            time.sleep(0.25)
    proc.terminate()
    out, err = proc.communicate(timeout=15)
    return out, err


def test_the_packaged_engine_prints_the_key_line_once_before_its_address():
    out, err = run_engine({"FORMPATH_WINDOW_KEY_STDOUT": "1"})
    lines = [line for line in out.splitlines() if line.startswith("formpath-window-key: ")]
    assert len(lines) == 1
    assert out.splitlines()[0] == lines[0]
    assert len(lines[0].split(": ", 1)[1]) >= 32
    assert "127.0.0.1" not in lines[0]


def test_the_engine_prints_no_key_when_the_shell_did_not_ask():
    out, err = run_engine({})
    assert "window-key" not in out and "window-key" not in err


def test_the_command_line_runs_commands_through_the_mcp_path(monkeypatch, capsys):
    sys.path.insert(0, str(REPO / "setup"))
    import cli

    seen = []

    def fake(method, path, body=None):
        seen.append((method, path, body))
        return {"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": "done it"}]}}

    monkeypatch.setattr(cli, "call", fake)
    assert cli.main(["run", "edit.undo", "n=2"]) == 0
    method, path, body = seen[0]
    assert (method, path) == ("POST", "/mcp")
    assert body["params"]["name"] == "run_command"
    assert body["params"]["arguments"] == {"id": "edit.undo", "params": {"n": 2}}
    assert "done it" in capsys.readouterr().out
    assert "FORMPATH_INAPP_TOKEN" not in (REPO / "setup" / "cli.py").read_text(encoding="utf-8")


def test_the_command_line_reports_a_refusal_in_one_line(monkeypatch):
    sys.path.insert(0, str(REPO / "setup"))
    import cli

    monkeypatch.setattr(cli, "call", lambda *a, **k: {"jsonrpc": "2.0", "id": 1, "result": {"isError": True, "content": [{"type": "text", "text": "The person did not allow outside agents in formpath."}]}})
    with pytest.raises(SystemExit) as stop:
        cli.main(["run", "edit.undo"])
    assert str(stop.value) == "[formpath] The person did not allow outside agents in formpath."
