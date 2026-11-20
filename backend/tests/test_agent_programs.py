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
STAND_IN_SHELL = """#!/bin/sh
login=0; inter=0; script=""
while [ $# -gt 0 ]; do
  case "$1" in -l) login=1 ;; -i) inter=1 ;; -c) shift; script="$1" ;; esac
  shift
done
if [ "$login" = 1 ] && [ -f "$HOME/.zprofile-path" ]; then PATH="$(cat "$HOME/.zprofile-path"):$PATH"; fi
if [ "$inter" = 1 ] && [ -f "$HOME/.zshrc-path" ]; then PATH="$(cat "$HOME/.zshrc-path"):$PATH"; fi
export PATH
if [ -n "$script" ]; then exec /bin/sh -c "$script"; fi
exec /bin/sh
"""
NODE_STYLE = ('#!/usr/bin/env form-stand-in-node\nif [ "$1" = "--version" ]; then echo "1.2.3 (stand-in)"; exit 0; fi\n'
              'echo "stand-in started; interpreter beside it: $STAND_IN_NODE; first PATH entry: ${PATH%%:*}"\nread line\n')
STAND_IN_NODE = '#!/bin/sh\nexport STAND_IN_NODE=yes\nscript="$1"; shift; exec /bin/sh "$script" "$@"\n'


def stand_in(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    path.chmod(0o755)
    return path


@pytest.fixture(autouse=True)
def fresh(monkeypatch, tmp_path):
    from app.services import agent_lookup, agent_programs, claude_code

    folder = tmp_path / "bin"
    folder.mkdir()
    script = folder / "claude"
    script.write_text(STAND_INS["claude"])
    script.chmod(0o755)
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("FORMPATH_CLAUDE_BIN", str(script))
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("SHELL", str(stand_in(tmp_path / "zsh", STAND_IN_SHELL)))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    for name in ("NPM_CONFIG_PREFIX", "npm_config_prefix", "PNPM_HOME", "VOLTA_HOME", "BUN_INSTALL", "NVM_SYMLINK", "FORMPATH_CODEX_BIN", "FORMPATH_CURSOR_BIN", "FORMPATH_ANTIGRAVITY_BIN"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(agent_lookup, "system_folders", lambda platform=None: [])
    agent_lookup.forget()
    agent_programs._cache["value"] = None
    claude_code._cache["value"] = None
    yield folder
    agent_lookup.forget()
    agent_programs._cache["value"] = None
    claude_code._cache["value"] = None


@pytest.fixture
def home(fresh):
    return fresh.parent / "home"


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
    assert set(found) == {"claude", "codex", "cursor", "antigravity"}
    assert found["claude"] == found["claude"] | {"installed": True, "version": "9.9.9", "signedIn": True, "title": "Claude Code", "finding": "runs", "how": "override"}
    for kind, title in (("codex", "Codex"), ("cursor", "Cursor"), ("antigravity", "Antigravity")):
        assert found[kind] == found[kind] | {"installed": False, "path": None, "version": None, "signedIn": None, "finding": "missing", "title": title}
        assert found[kind]["install"] and "\n" not in found[kind]["install"]
        assert found[kind]["looked"][:2] == ["your setting (empty)", "PATH (/usr/bin:/bin)"] and found[kind]["looked"][-1] == "your shell (zsh, login and interactive)"
        assert found[kind]["said"].startswith(f"{title} was not found. Looked in: your setting (empty); PATH (/usr/bin:/bin); ~/.local/bin, ") and found[kind]["said"].endswith(f"Install it with: {found[kind]['install']}, or give its path in Preferences.")


def test_the_status_finds_programs_a_window_started_from_the_dock_would_miss(client, none_found, home, tmp_path):
    stand_in(home / ".local" / "bin" / "agy", STAND_INS["codex"])
    stand_in(home / ".nvm" / "versions" / "node" / "v22.3.0" / "bin" / "codex", NODE_STYLE)
    stand_in(home / ".nvm" / "versions" / "node" / "v22.3.0" / "bin" / "form-stand-in-node", STAND_IN_NODE)
    stand_in(tmp_path / "elsewhere" / "cursor-agent", STAND_INS["cursor-agent"])
    (home / ".zshrc-path").write_text(str(tmp_path / "elsewhere"))
    found = client.get("/api/terminal/agents?fresh=1").json()
    assert found["antigravity"] == found["antigravity"] | {"installed": True, "path": str(home / ".local" / "bin" / "agy"), "how": "folder", "finding": "runs", "signedIn": None}
    assert found["codex"] == found["codex"] | {"installed": True, "path": str(home / ".nvm" / "versions" / "node" / "v22.3.0" / "bin" / "codex"), "version": "1.2.3", "how": "folder"}
    assert found["cursor"] == found["cursor"] | {"installed": True, "path": str(tmp_path / "elsewhere" / "cursor-agent"), "how": "shell", "finding": "runs"}
    assert found["cursor"]["said"] == f"Cursor is at {tmp_path / 'elsewhere' / 'cursor-agent'} (your shell's PATH)."


def test_a_program_whose_interpreter_is_beside_it_starts_in_a_tab(client, none_found, home):
    from app.services import terminal

    folder = home / ".nvm" / "versions" / "node" / "v22.3.0" / "bin"
    stand_in(folder / "codex", NODE_STYLE)
    stand_in(folder / "form-stand-in-node", STAND_IN_NODE)
    res = client.post("/api/terminal/agent", json={"kind": "codex", "cols": 200, "rows": 20})
    assert res.status_code == 200 and res.json()["alive"] is True
    session = terminal.SESSIONS[res.json()["id"]]
    assert session.env["PATH"].split(os.pathsep)[0] == str(folder)
    deadline = time.time() + 10
    text = ""
    while time.time() < deadline and "first PATH entry" not in text:
        time.sleep(0.1)
        text = client.get(f"/api/terminal/{session.id}/read").json()["text"]
    assert f"stand-in started; interpreter beside it: yes; first PATH entry: {folder}" in text
    assert client.delete(f"/api/terminal/{session.id}").status_code == 200


def test_a_program_that_is_found_but_does_not_start_is_reported_as_such(client, none_found, home):
    stand_in(home / ".local" / "bin" / "codex", "#!/usr/bin/env form-interpreter-that-is-not-here\n")
    found = client.get("/api/terminal/agents?fresh=1").json()["codex"]
    assert found == found | {"installed": False, "path": str(home / ".local" / "bin" / "codex"), "finding": "broken", "how": "folder", "version": None}
    assert "form-interpreter-that-is-not-here" in found["error"] and "but does not start" in found["said"]
    res = client.post("/api/terminal/agent", json={"kind": "codex"})
    assert res.status_code == 409 and res.json()["detail"] == found["said"]


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
    assert json.loads(text)["mcpServers"]["formpath_tab"] == {"url": "${env:FORMPATH_MCP_URL}", "headers": {claude_code.INAPP_HEADER: "${env:FORMPATH_INAPP_TOKEN}"}}
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
    assert data["kept"] == 1 and data["mcpServers"]["other"] == {"command": "x"} and data["mcpServers"]["formpath_tab"] == agent_programs.cursor_entry()
    config.write_text("not json", encoding="utf-8")
    assert agent_programs.write_cursor_config(str(tmp_path)) is None
    assert config.read_text(encoding="utf-8") == "not json"


def test_an_antigravity_tab_gets_its_entry_in_a_folder_of_its_own_and_loses_it_at_close(client, stand_ins):
    from app.core import config
    from app.services import claude_code, terminal

    stand_in(stand_ins / "agy", STAND_INS["codex"])
    kept = config.data_dir() / "agent-tabs" / "antigravity" / ".agents" / "mcp_config.json"
    kept.parent.mkdir(parents=True, exist_ok=True)
    seed = {"mcpServers": {"other": {"command": "x"}}, "kept": 1}
    kept.write_text(json.dumps(seed), encoding="utf-8")
    res = client.post("/api/terminal/agent", json={"kind": "antigravity"})
    assert res.status_code == 200 and res.json()["kind"] == "antigravity" and res.json()["title"] == "Antigravity"
    assert res.json()["cwd"] == str(kept.parent.parent)
    session = terminal.SESSIONS[res.json()["id"]]
    token = session.env["FORMPATH_INAPP_TOKEN"]
    assert claude_code.is_inapp(token) and all(token not in part for part in session.argv)
    assert stat.S_IMODE(os.stat(kept).st_mode) == 0o600
    entry = {"serverUrl": session.env["FORMPATH_MCP_URL"], "headers": {claude_code.INAPP_HEADER: token}}
    assert json.loads(kept.read_text(encoding="utf-8")) == {"mcpServers": {"other": {"command": "x"}, "formpath_tab": entry}, "kept": 1}
    assert client.delete(f"/api/terminal/{session.id}").status_code == 200
    assert not claude_code.is_inapp(token)
    assert json.loads(kept.read_text(encoding="utf-8")) == seed
    kept.unlink()


def test_a_missing_program_or_an_unknown_kind_is_refused(client, none_found):
    res = client.post("/api/terminal/agent", json={"kind": "codex"})
    assert res.status_code == 409 and res.json()["detail"].startswith("Codex was not found. Looked in: your setting (empty); PATH (/usr/bin:/bin); ")
    assert client.post("/api/terminal/agent", json={"kind": "vim"}).status_code == 422
    res = client.post("/api/terminal/agent", json={"kind": "antigravity"})
    assert res.status_code == 409 and res.json()["detail"].startswith("Antigravity was not found. Looked in: your setting (empty); PATH (/usr/bin:/bin); ")


def test_starting_a_program_tab_needs_the_window_key(bare, stand_ins):
    res = bare.post("/api/terminal/agent", json={"kind": "codex"})
    assert res.status_code == 403 and res.json() == {"detail": window_key.REFUSED}
