import copy
import io
import json
import zipfile

import pytest
from PIL import Image

from app.services import project_format as pf

FORMAT = "com.nodemode.formpath"


def png_bytes(color):
    out = io.BytesIO()
    Image.new("RGB", (8, 6), color).save(out, "PNG")
    return out.getvalue()


def path_node(nid, x, y, w, h):
    pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    return {
        "id": nid, "kind": "path", "rule": "nonzero", "opacity": 1, "blend": "normal",
        "d": [{"closed": True, "pts": [{"x": px, "y": py, "ix": px, "iy": py, "ox": px, "oy": py} for px, py in pts]}],
        "ap": {"items": [{"kind": "fill", "paint": {"type": "solid", "color": {"space": "rgb", "r": 255, "g": 128, "b": 0}}, "opacity": 1, "blend": "normal", "visible": True, "effects": []}], "effects": []},
    }


def manifest(image="pic1.png"):
    return {
        "format": FORMAT, "version": 1, "app": "formpath",
        "document": {
            "version": 1, "title": "Round trip", "units": "pt", "colorMode": "rgb",
            "artboards": [{"id": "a1", "name": "Artboard 1", "x": 0, "y": 0, "w": 612, "h": 792, "rect": [0, 0, 612, 792], "bg": None}],
            "layers": [{
                "id": "l1", "kind": "layer", "name": "Layer 1", "color": "#4f80ff", "opacity": 1, "blend": "normal", "ap": {"items": [], "effects": []},
                "children": [
                    path_node("p1", 10.5, 20.25, 100, 50),
                    {"id": "g1", "kind": "group", "clip": False, "opacity": 0.5, "blend": "multiply", "ap": {"items": [], "effects": []}, "children": [path_node("p2", 0, 0, 30, 30)]},
                    {"id": "i1", "kind": "image", "src": image, "x": 0, "y": 0, "w": 8, "h": 6, "opacity": 1, "blend": "normal", "ap": {"items": [], "effects": []}},
                ],
            }],
            "images": {image: {"mime": "image/png", "w": 8, "h": 6}},
            "swatches": [], "symbols": [], "guides": [], "grid": {"spacing": 72, "subdivisions": 8},
        },
        "view": {"activeArtboard": 0, "activeLayer": "l1"},
    }


def save(client, name, man, assets):
    files = [("files", (key, data, "image/png")) for key, data in assets.items()]
    r = client.post("/api/projects/save", data={"name": name, "manifest": json.dumps(man)}, files=files)
    assert r.status_code == 200, r.text
    return r.json()


def load(client, name):
    r = client.get(f"/api/projects/library/{name}")
    assert r.status_code == 200, r.text
    body = r.json()
    assets = {}
    for key, url in body["images"].items():
        got = client.get(url)
        assert got.status_code == 200
        assets[key] = got.content
    return body["manifest"], assets


def read_saved(info):
    with open(info["path"], "rb") as handle:
        return pf.read_zip(handle.read())


def test_save_load_save_gives_the_same_project(client):
    assets = {"pic1.png": png_bytes((10, 200, 30))}
    first = save(client, "rt-one", manifest(), assets)
    loaded, loaded_assets = load(client, "rt-one")
    assert loaded == manifest()
    assert loaded_assets == assets
    second = save(client, "rt-two", loaded, loaded_assets)
    m1, a1 = read_saved(first)
    m2, a2 = read_saved(second)
    assert m1 == m2 == manifest()
    assert a1 == a2 == assets


def test_a_saved_file_is_a_zip_with_manifest_and_images_folder(client):
    info = save(client, "layout-check", manifest(), {"pic1.png": png_bytes((1, 2, 3))})
    with zipfile.ZipFile(info["path"]) as z:
        names = z.namelist()
        assert "manifest.json" in names and "images/pic1.png" in names
        assert json.loads(z.read("manifest.json"))["format"] == FORMAT
    assert info["path"].endswith(".fpth")


def test_import_of_a_package_gives_the_same_manifest(client):
    assets = {"pic1.png": png_bytes((9, 9, 9))}
    blob = pf.write_zip(manifest(), assets)
    r = client.post("/api/projects/import", files=[("files", ("drawing.fpth", blob, "application/zip"))])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "drawing"
    assert body["manifest"] == manifest()
    assert client.get(body["images"]["pic1.png"]).content == assets["pic1.png"]


def test_package_write_then_read_is_lossless_for_numbers():
    m = manifest()
    m["document"]["layers"][0]["children"][0]["d"][0]["pts"][0]["x"] = 0.1 + 0.2
    out, _ = pf.read_zip(pf.write_zip(m, {"pic1.png": b"x"}))
    assert out == m


def test_a_second_save_of_the_same_name_replaces_the_first(client):
    save(client, "replace-me", manifest(), {"pic1.png": png_bytes((0, 0, 0))})
    changed = manifest()
    changed["document"]["title"] = "Second"
    save(client, "replace-me", changed, {"pic1.png": png_bytes((255, 255, 255))})
    loaded, assets = load(client, "replace-me")
    assert loaded["document"]["title"] == "Second"
    assert assets["pic1.png"] == png_bytes((255, 255, 255))
    names = [p["name"] for p in client.get("/api/projects").json()]
    assert names.count("replace-me") == 1


def test_a_stale_base_keeps_both_versions_instead_of_overwriting(client):
    first = save(client, "conflict-me", manifest(), {"pic1.png": png_bytes((1, 1, 1))})
    save(client, "conflict-me", manifest(), {"pic1.png": png_bytes((2, 2, 2))})
    r = client.post("/api/projects/save", data={"name": "conflict-me", "manifest": json.dumps(manifest()), "base": first["version"]}, files=[("files", ("pic1.png", png_bytes((3, 3, 3)), "image/png"))])
    body = r.json()
    assert body["conflict"] is True
    assert body["name"] != "conflict-me"
    loaded, assets = load(client, "conflict-me")
    assert assets["pic1.png"] == png_bytes((2, 2, 2))


def broken(mutate):
    m = copy.deepcopy(manifest())
    mutate(m)
    return m


REFUSED = [
    ("foreign_format", lambda m: m.update(format="com.example.other")),
    ("newer_version", lambda m: m.update(version=2)),
    ("no_artboards", lambda m: m["document"].update(artboards=[])),
    ("huge_artboard", lambda m: m["document"]["artboards"][0].update(rect=[0, 0, 10**9, 792])),
    ("unknown_kind", lambda m: m["document"]["layers"][0]["children"][0].update(kind="script")),
    ("repeated_id", lambda m: m["document"]["layers"][0]["children"][1].update(id="p1")),
    ("unsafe_image_path", lambda m: m["document"]["layers"][0]["children"][2].update(src="../../escape.png")),
    ("unsafe_linked_image_path", lambda m: m["document"]["layers"][0]["children"][2].update(src="../../escape.png", linked={"path": "/x/escape.png", "name": "escape.png"})),
    ("image_not_in_package", lambda m: m["document"]["layers"][0]["children"][2].update(src="absent.png")),
]


@pytest.mark.parametrize("label,mutate", REFUSED, ids=[r[0] for r in REFUSED])
def test_a_damaged_manifest_is_refused_and_nothing_is_written(client, label, mutate):
    name = f"bad-{label}"
    files = [("files", ("pic1.png", png_bytes((1, 1, 1)), "image/png"))]
    r = client.post("/api/projects/save", data={"name": name, "manifest": json.dumps(broken(mutate))}, files=files)
    assert r.status_code == 422
    assert name not in [p["name"] for p in client.get("/api/projects").json()]


def test_nesting_deeper_than_the_limit_is_refused(client):
    node = path_node("deep0", 0, 0, 1, 1)
    for i in range(1, 140):
        node = {"id": f"deep{i}", "kind": "group", "clip": False, "opacity": 1, "blend": "normal", "ap": {"items": [], "effects": []}, "children": [node]}
    m = manifest()
    m["document"]["layers"][0]["children"] = [node]
    m["document"]["images"] = {}
    r = client.post("/api/projects/save", data={"name": "too-deep", "manifest": json.dumps(m)})
    assert r.status_code == 422


@pytest.mark.parametrize("name", ["../escape", "a/b", "..", ".hidden", ""])
def test_project_names_cannot_leave_the_library_folder(client, name):
    r = client.post("/api/projects/save", data={"name": name, "manifest": json.dumps(broken(lambda m: m["document"]["layers"][0].update(children=[]) or m["document"].update(images={})))})
    assert r.status_code in (400, 422)


def test_unsafe_asset_name_is_refused(client):
    r = client.post("/api/projects/save", data={"name": "evil-asset", "manifest": json.dumps(manifest())}, files=[("files", ("bad name!.png", b"x", "image/png"))])
    assert r.status_code == 400
