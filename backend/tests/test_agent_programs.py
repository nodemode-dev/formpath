import json
import os
import stat
import time

import pytest

from app.core import window_key

pytestmark = pytest.mark.skipif(os.name == "nt", reason="the stand-ins are shell scripts")

STAND_INS = {
    "claude": '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "9.9.9 (Claude Code)"; exit 0; fi\nif [ "$1" = "auth" ]; then echo \'{"loggedIn": true}\'; exit 0; fi\nread line\n',
    "codex": '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "codex-cli 0.99.1"; exit 0; fi\necho "stand-in started"\nread line\n',
    "cursor-agent": '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2026.11.01-abc123"; exit 0; fi\necho "stand-in started"\nread line\n',
}


@pytest.fixture(autouse=True)
def fresh(monkeypatch, tmp_path):
    from app.services import agent_programs, claude_code

    folder = tmp_path / "bin"
    folder.mkdir()
    script = folder / "claude"
    script.write_text(STAND_INS["claude"])
    script.chmod(0o755)
    monkeypatch.setenv("FORMPATH_CLAUDE_BIN", str(script))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.setattr(agent_programs.terminal, "login_shell", lambda: ["/bin/sh"])
    agent_programs._cache["value"] = None
    claude_code._cache["value"] = None
    yield folder
    agent_programs._cache["value"] = None
    claude_code._cache["value"] = None


@pytest.fixture
def stand_ins(fresh, monkeypatch):
    for name in ("codex", "cursor-agent"):
        script = fresh / name
        script.write_text(STAND_INS[name])
        script.chmod(0o755)
    monkeypatch.setenv("PATH", f"{fresh}{os.pathsep}/usr/bin{os.pathsep}/bin")
    return fresh


@pytest.fixture
def none_found(monkeypatch):
    monkeypatch.setenv("PATH", "/usr/bin:/bin")


def test_the_status_names_each_program_and_how_to_get_a_missing_one(client, none_found):
    found = client.get("/api/terminal/agents").json()
    assert set(found) == {"claude", "codex", "cursor"}
    assert found["claude"] == found["claude"] | {"installed": True, "version": "9.9.9", "signedIn": True, "title": "Claude Code"}
    for kind in ("codex", "cursor"):
        assert found[kind] == found[kind] | {"installed": False, "path": None, "version": None, "signedIn": None}
        assert found[kind]["install"] and "\n" not in found[kind]["install"]


def test_the_status_finds_programs_on_the_path_with_their_versions(client, stand_ins):
    found = client.get("/api/terminal/agents").json()
    assert found["codex"] == found["codex"] | {"installed": True, "path": str(stand_ins / "codex"), "version": "0.99.1", "signedIn": None, "title": "Codex"}
    assert found["cursor"] == found["cursor"] | {"installed": True, "path": str(stand_ins / "cursor-agent"), "version": "2026.11.01-abc123", "title": "Cursor"}


def test_the_status_is_kept_for_a_minute_unless_a_fresh_one_is_asked_for(client, stand_ins, monkeypatch):
    assert client.get("/api/terminal/agents").json()["codex"]["installed"] is True
    monkeypatch.setenv("PATH", "/usr/bin:/bin")
    assert client.get("/api/terminal/agents").json()["codex"]["installed"] is True
    assert client.get("/api/terminal/agents?fresh=1").json()["codex"]["installed"] is False


def test_the_status_needs_the_window_key(bare):
    assert bare.get("/api/terminal/agents").status_code == 403


def test_a_program_tab_gets_its_own_token_in_its_environment_never_on_its_command_line(client, stand_ins):
    from app.services import claude_code, terminal

    res = client.post("/api/terminal/agent", json={"kind": "codex", "cols": 80, "rows": 20})
    assert res.status_code == 200 and res.json()["kind"] == "codex" and res.json()["title"] == "Codex" and res.json()["alive"] is True
    session = terminal.SESSIONS[res.json()["id"]]
    token = session.env["FORMPATH_INAPP_TOKEN"]
    assert claude_code.is_inapp(token)
    assert all(token not in part for part in session.argv)
    assert "FORMPATH_INAPP_TOKEN" in session.argv[-1] and "/mcp" in session.argv[-1] and claude_code.INAPP_HEADER in session.argv[-1]
    assert session.env["FORMPATH_MCP_URL"].endswith("/mcp")
    assert {"id": session.id, "kind": "codex"}.items() <= next(t for t in client.get("/api/terminal").json()["terminals"] if t["id"] == session.id).items()
    assert client.post(f"/api/terminal/{session.id}/restart").json()["alive"] is True
    assert claude_code.is_inapp(token)
    assert client.delete(f"/api/terminal/{session.id}").status_code == 200
    time.sleep(0.1)
    assert not claude_code.is_inapp(token)


def test_a_cursor_tab_writes_a_private_config_that_holds_placeholders_not_the_token(client, stand_ins):
    from app.services import claude_code, terminal

    res = client.post("/api/terminal/agent", json={"kind": "cursor"})
    assert res.status_code == 200 and res.json()["kind"] == "cursor"
    session = terminal.SESSIONS[res.json()["id"]]
    token = session.env["FORMPATH_INAPP_TOKEN"]
    config = claude_code.workdir() / ".cursor" / "mcp.json"
    text = config.read_text(encoding="utf-8")
    assert stat.S_IMODE(os.stat(config).st_mode) == 0o600
    assert token not in text
    assert json.loads(text)["mcpServers"]["formpath"] == {"url": "${env:FORMPATH_MCP_URL}", "headers": {claude_code.INAPP_HEADER: "${env:FORMPATH_INAPP_TOKEN}"}}
    assert session.argv[-1].endswith("cursor-agent") and token not in session.argv[-1]
    client.delete(f"/api/terminal/{session.id}")
    assert not claude_code.is_inapp(token)
    config.unlink()


def test_the_cursor_config_keeps_other_servers_and_leaves_a_file_it_cannot_read_alone(tmp_path):
    from app.services import agent_programs

    config = tmp_path / ".cursor" / "mcp.json"
    config.parent.mkdir()
    config.write_text(json.dumps({"mcpServers": {"other": {"command": "x"}}, "kept": 1}), encoding="utf-8")
    assert agent_programs.write_cursor_config(str(tmp_path)) == config
    data = json.loads(config.read_text(encoding="utf-8"))
    assert data["kept"] == 1 and data["mcpServers"]["other"] == {"command": "x"} and data["mcpServers"]["formpath"] == agent_programs.cursor_entry()
    config.write_text("not json", encoding="utf-8")
    assert agent_programs.write_cursor_config(str(tmp_path)) is None
    assert config.read_text(encoding="utf-8") == "not json"


def test_a_missing_program_or_an_unknown_kind_is_refused(client, none_found):
    res = client.post("/api/terminal/agent", json={"kind": "codex"})
    assert res.status_code == 409 and "is not installed" in res.json()["detail"]
    assert client.post("/api/terminal/agent", json={"kind": "vim"}).status_code == 422


def test_starting_a_program_tab_needs_the_window_key(bare, stand_ins):
    res = bare.post("/api/terminal/agent", json={"kind": "codex"})
    assert res.status_code == 403 and res.json() == {"detail": window_key.REFUSED}
