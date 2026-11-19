import re

import pytest

from conftest import window_headers

EXPECTED_OPEN = {"/mcp", "/api/window/key"}
READS = {"get", "head", "options"}


def write_operations(app):
    found = []
    for path, item in app.openapi()["paths"].items():
        for method in item:
            if method.lower() not in READS:
                found.append((method.upper(), path))
    return found


def concrete(path):
    return re.sub(r"\{[^}]+\}", "x", path)


def test_the_open_list_is_exactly_the_named_routes():
    from app.core import window_key

    assert set(window_key.OPEN) == EXPECTED_OPEN


def test_every_write_operation_is_refused_without_the_key_unless_it_is_on_the_open_list(app, bare):
    from app.core import window_key

    answered = []
    operations = write_operations(app)
    assert len(operations) > 40
    for method, path in operations:
        r = bare.request(method, concrete(path), content=b"{}", headers={"content-type": "application/json"})
        if r.status_code != 403 or window_key.REFUSED not in r.text:
            answered.append(path)
    assert set(answered) == EXPECTED_OPEN, f"write routes that answered without the window key: {sorted(set(answered) - EXPECTED_OPEN)}"


def test_a_window_origin_alone_is_not_enough(app, bare):
    for method, path in write_operations(app):
        if path in EXPECTED_OPEN:
            continue
        r = bare.request(method, concrete(path), content=b"{}", headers={"content-type": "application/json", "origin": "http://localhost:5230"})
        assert r.status_code == 403, f"{method} {path}"


def test_a_wrong_key_is_refused_without_naming_the_right_one(bare):
    from app.core import window_key

    r = bare.post("/api/terminal", json={}, headers={window_key.HEADER: "not-the-key"})
    assert r.status_code == 403
    assert window_key.KEY not in r.text


def test_with_the_key_the_window_routes_are_not_refused(client):
    assert client.put("/api/plugins/key-check.js", content=b"window.formpath.register({name:'k',commands:[]});").status_code == 200
    assert client.delete("/api/plugins/key-check.js").status_code == 200
    assert client.post("/api/spell/check", json={"text": "hello"}).status_code == 200


def test_window_headers_helper_carries_the_live_key():
    from app.core import window_key

    assert window_headers() == {window_key.HEADER: window_key.KEY}
