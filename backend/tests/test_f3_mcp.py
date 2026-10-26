import json
import subprocess

from conftest import MCP_PATH, READ_TOOL, STDIO_CMD, tool_catalogue


def rpc(client, method, params=None, headers=None, rid=1):
    body = {"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}}
    return client.post(MCP_PATH, json=body, headers=headers or {})


def initialize(client, headers=None):
    return rpc(client, "initialize", {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "family-test", "version": "1"}}, headers)


def test_initialize_without_origin_answers(client):
    r = initialize(client)
    assert r.status_code == 200
    result = r.json()["result"]
    assert result["protocolVersion"] == "2025-11-25"
    assert result["serverInfo"]["name"] == "formpath"
    assert "tools" in result["capabilities"]


def test_initialize_from_a_foreign_origin_is_refused(client):
    assert initialize(client, {"origin": "http://evil.example"}).status_code == 403


def test_tools_list_matches_the_catalogue(client):
    listed = rpc(client, "tools/list").json()["result"]["tools"]
    catalogue = tool_catalogue()
    assert len(listed) == len(catalogue) >= 50
    assert sorted(t["name"] for t in listed) == sorted(t["name"] for t in catalogue)
    assert len({t["name"] for t in listed}) == len(listed)
    for tool in listed:
        assert tool["description"].strip()
        assert tool["inputSchema"]["type"] == "object"


def test_catalogue_names_the_tools_the_plan_depends_on(client):
    names = {t["name"] for t in tool_catalogue()}
    assert {"get_document", "get_image", "draw_shape", "draw_path", "pathfinder", "create_outlines", "open_file", "save_project", "export_file"} <= names


def test_a_tool_that_is_not_in_the_catalogue_is_an_error(client):
    reply = rpc(client, "tools/call", {"name": "no_such_tool", "arguments": {}}).json()
    assert reply["error"]["code"] == -32602


def test_tool_call_with_no_window_answers_with_a_valid_error_result(client):
    name, args = READ_TOOL
    result = rpc(client, "tools/call", {"name": name, "arguments": args}).json()["result"]
    assert result["isError"] is True
    assert result["content"] and all(c["type"] == "text" and c["text"] for c in result["content"])


def test_unknown_method_is_a_jsonrpc_error(client):
    assert rpc(client, "no/such/method").json()["error"]["code"] == -32601


def test_unsupported_protocol_version_is_refused_for_other_methods(client):
    reply = rpc(client, "tools/list", headers={"mcp-protocol-version": "1999-01-01"}).json()
    assert reply["error"]["code"] == -32602


def test_notification_is_accepted_without_a_body(client):
    r = client.post(MCP_PATH, json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert r.status_code == 202


def test_stdio_relay_reaches_the_engine_it_is_pointed_at(engine):
    env = dict(engine["env"], FORMPATH_MCP_URL=f"{engine['base']}/mcp", FORMPATH_MCP_AUTOSTART="0")
    lines = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "family-test", "version": "1"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
    ]
    proc = subprocess.run(STDIO_CMD, input="".join(json.dumps(m) + "\n" for m in lines), capture_output=True, text=True, timeout=60, env=env)
    replies = {m.get("id"): m for m in (json.loads(x) for x in proc.stdout.splitlines() if x.strip().startswith("{"))}
    assert 2 in replies, f"relay gave no tools/list reply: {proc.stdout[-2000:]} {proc.stderr[-2000:]}"
    assert len(replies[2]["result"]["tools"]) == len(tool_catalogue())
    assert replies[1]["result"]["serverInfo"]["name"] == "formpath"
