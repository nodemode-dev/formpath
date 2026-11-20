import asyncio
import importlib
import json
import sys
import time

from conftest import REPO, tool_catalogue


def sync_module():
    sys.path.insert(0, str(REPO / "setup"))
    try:
        return importlib.import_module("agents")
    finally:
        sys.path.remove(str(REPO / "setup"))


def committed():
    return json.loads((REPO / "agents" / "manifest.json").read_text(encoding="utf-8"))


def test_committed_manifest_is_what_sync_writes():
    assert sync_module().manifest_drift() is False


def test_the_shared_dock_folder_is_what_its_manifest_lists_and_imports_nothing_from_the_app(tmp_path):
    import shutil

    sync = sync_module()
    assert sync.dock_problems() == []
    assert committed()["dock"] == {"present": True, "positions": ["bottom", "right"], "tabs": ["chat", "claude", "codex", "cursor", "antigravity", "shell"]}
    copy = tmp_path / "dock"
    shutil.copytree(sync.DOCK_DIR, copy)
    (copy / "keys.ts").write_text((copy / "keys.ts").read_text(encoding="utf-8") + "import { api } from '../io/api';\n", encoding="utf-8")
    (copy / "extra.ts").write_text("export const x = 1;\n", encoding="utf-8")
    (copy / "dom.ts").unlink()
    said = "\n".join(sync.dock_problems(copy))
    assert "keys.ts: differs from MANIFEST.json" in said and "keys.ts: imports ../io/api" in said
    assert "extra.ts: not in MANIFEST.json" in said and "dom.ts: missing" in said


LOOKUP = "backend/app/services/agent_lookup.py"


def test_the_shared_finder_matches_the_hash_recorded_for_its_version():
    import hashlib
    import re

    sync = sync_module()
    version = re.search(r'^VERSION = "([^"]+)"$', (REPO / LOOKUP).read_text(encoding="utf-8"), re.M).group(1)
    assert sync.LOOKUP_HASHES[version] == hashlib.sha256((REPO / LOOKUP).read_bytes()).hexdigest()
    assert sync.lookup_problems() == []


def test_the_check_names_the_shared_finder_edited_in_place_or_missing(tmp_path, monkeypatch):
    import re
    import shutil

    sync = sync_module()
    copy = tmp_path / "repo"
    (copy / "backend" / "app" / "services").mkdir(parents=True)
    shutil.copy(REPO / LOOKUP, copy / LOOKUP)
    monkeypatch.setattr(sync, "ROOT", copy)
    monkeypatch.setattr(sync, "LOOKUP", copy / LOOKUP)
    assert sync.lookup_problems() == []
    with open(copy / LOOKUP, "a", encoding="utf-8") as f:
        f.write("\n")
    version = re.search(r'^VERSION = "([^"]+)"$', (REPO / LOOKUP).read_text(encoding="utf-8"), re.M).group(1)
    assert sync.lookup_problems() == [f"{LOOKUP}: does not match the hash recorded for version {version} (the shared finder changes only as a whole new version)"]
    (copy / LOOKUP).unlink()
    assert sync.lookup_problems() == [f"{LOOKUP}: missing (the shared finder for the agent programs)"]


def test_install_adds_formpath_to_antigravity_and_leaves_what_it_did_not_write(tmp_path):
    sync = sync_module()
    cfg = tmp_path / ".gemini" / "config" / "mcp_config.json"
    entry = {"command": sync.LAUNCH, "args": ["mcp"]}
    said = []
    sync.install_antigravity(tmp_path, True, said)
    assert said == ["Antigravity:", f"  MCP server formpath -> {cfg}"] and not cfg.exists()
    sync.install_antigravity(tmp_path, False, said)
    assert json.loads(cfg.read_text(encoding="utf-8")) == {"mcpServers": {"formpath": entry}}
    said = []
    sync.install_antigravity(tmp_path, False, said)
    assert said == ["Antigravity:", f"  MCP server formpath already in {cfg}"] and [p.name for p in cfg.parent.iterdir()] == ["mcp_config.json"]
    foreign = {"mcpServers": {"formpath": {"command": "/elsewhere/tool", "args": ["serve"]}, "other": {"command": "x"}}, "kept": 1}
    cfg.write_text(json.dumps(foreign), encoding="utf-8")
    said = []
    sync.install_antigravity(tmp_path, False, said)
    assert said[1].endswith("has a server named formpath that formpath did not write; left alone") and json.loads(cfg.read_text(encoding="utf-8")) == foreign
    cfg.write_text("not json", encoding="utf-8")
    said = []
    sync.install_antigravity(tmp_path, False, said)
    assert said[1].endswith("is not an MCP servers file formpath can read; left alone") and cfg.read_text(encoding="utf-8") == "not json"
    older = tmp_path / "second" / ".gemini" / "antigravity-cli" / "mcp_config.json"
    older.parent.mkdir(parents=True)
    older.write_text("{}", encoding="utf-8")
    said = []
    sync.install_antigravity(tmp_path / "second", False, said)
    assert said[1].startswith(f"  an older file was seen at {older} and left alone") and older.read_text(encoding="utf-8") == "{}"
    assert json.loads((tmp_path / "second" / ".gemini" / "config" / "mcp_config.json").read_text(encoding="utf-8")) == {"mcpServers": {"formpath": entry}}


def test_the_shared_finder_imports_nothing_from_the_app():
    import re

    imports = set(re.findall(r"^\s*(?:from|import)\s+([\w.]+)", (REPO / LOOKUP).read_text(encoding="utf-8"), re.M))
    assert imports == {"__future__", "dataclasses", "os", "pathlib", "re", "shutil", "signal", "subprocess", "sys", "threading", "time", "winreg"}


def test_manifest_lists_the_tools_the_server_lists():
    listed = committed()["mcp"]
    assert listed["tools"] == [t["name"] for t in tool_catalogue()]
    assert listed["read_only"] == [t["name"] for t in tool_catalogue() if t["annotations"]["readOnlyHint"]]
    assert set(listed["read_only"]) <= set(listed["tools"])
    assert set(listed["approval_gated"]) <= set(listed["tools"])
    assert listed["transports"] == ["stdio", "http"]


def test_manifest_names_the_skills_and_hosts_no_extensions():
    manifest = committed()
    assert [s["name"] for s in manifest["skills"]] == sorted(p.name for p in (REPO / ".claude" / "skills").iterdir() if (p / "SKILL.md").is_file())
    assert manifest["extensions"] is None
    assert manifest["app"] == "formpath"


def test_every_tool_asks_the_person_before_it_acts(tmp_path, monkeypatch):
    mcp = importlib.import_module("app.routers.mcp")
    assert committed()["mcp"]["approval_gated"] == [t["name"] for t in tool_catalogue()]
    art = tmp_path / "art.svg"
    art.write_text("<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>", encoding="utf-8")
    arguments = {
        "open_file": {"path": str(art)},
        "place_image": {"path": str(art)},
        "save_project": {"path": str(tmp_path / "out.fpth")},
        "export_file": {"path": str(tmp_path / "out.svg")},
    }
    asked = []

    async def ask(name, args, timeout):
        asked.append(name)
        return {"allowed": False}

    monkeypatch.setattr(mcp, "_ask", ask)
    monkeypatch.setattr(mcp, "_allowed", False)

    async def go():
        for name in sorted(mcp.NAMES):
            del asked[:]
            monkeypatch.setattr(mcp, "_seen", time.monotonic())
            monkeypatch.setattr(mcp, "_declined_until", 0.0)
            out = await mcp._run(name, arguments.get(name, {}))
            assert out["isError"], name
            assert asked == ["__consent__"], name

    asyncio.run(go())
