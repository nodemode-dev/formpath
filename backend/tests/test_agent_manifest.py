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
