#!/usr/bin/env python3
"""./formpath mcpb: the Claude Desktop extension, formpath-<version>.mcpb.

  check       validate setup/mcpb/manifest.json and the files it names; exit 1 on a problem
  build DIR   write DIR/formpath-<version>.mcpb: the manifest (its version filled in from frontend/src/version.ts),
              the stdio bridge setup/mcp_stdio.py and the icon
"""

import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "setup", "mcpb", "manifest.json")
SERVER_SOURCE = os.path.join(ROOT, "setup", "mcp_stdio.py")
ICON_SOURCE = os.path.join(ROOT, "assets", "formpath_icon.png")
VERSION_FILE = os.path.join(ROOT, "frontend", "src", "version.ts")
REQUIRED = ("manifest_version", "name", "version", "description", "author", "server")
STAMP = (1980, 1, 1, 0, 0, 0)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def version():
    with open(VERSION_FILE, encoding="utf-8") as f:
        found = re.search(r"VERSION = '([^']+)'", f.read())
    return found.group(1) if found else None


def problems_found():
    problems = []
    try:
        manifest = load(MANIFEST)
    except (OSError, ValueError) as exc:
        return [f"setup/mcpb/manifest.json cannot be read: {exc}"]
    for key in REQUIRED:
        if key not in manifest or manifest[key] in ("", None, {}):
            problems.append(f"manifest needs {key}")
    if manifest.get("manifest_version") != "0.2":
        problems.append("manifest_version must be 0.2")
    name = manifest.get("name")
    if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name or ""):
        problems.append("manifest name must be lower-case letters, digits and hyphens")
    try:
        if not version():
            problems.append("frontend/src/version.ts has no VERSION")
    except OSError:
        problems.append("frontend/src/version.ts cannot be read")
    author = manifest.get("author")
    if not isinstance(author, dict) or not author.get("name"):
        problems.append("manifest author needs a name")
    if manifest.get("icon") and not os.path.isfile(ICON_SOURCE):
        problems.append("the manifest names an icon but assets/formpath_icon.png is missing")
    server = manifest.get("server")
    if not isinstance(server, dict):
        problems.append("manifest server must be an object")
    else:
        if server.get("type") != "python":
            problems.append("server type must be python")
        entry = server.get("entry_point")
        if entry != "server/mcp_stdio.py":
            problems.append("server entry_point must be server/mcp_stdio.py")
        elif not os.path.isfile(SERVER_SOURCE):
            problems.append("setup/mcp_stdio.py is missing")
        config = server.get("mcp_config")
        if not isinstance(config, dict) or not config.get("command") or not isinstance(config.get("args"), list):
            problems.append("server mcp_config needs a command and args")
        elif "--attach" not in config["args"]:
            problems.append("server mcp_config args need --attach (the extension never starts the engine)")
    return problems


def report(problems):
    for line in problems:
        print(f"[mcpb] {line}", file=sys.stderr)
    return 1 if problems else 0


def check():
    if report(problems_found()):
        return 1
    print(f"[mcpb] manifest is valid (formpath {version()})")
    return 0


def build(folder):
    if report(problems_found()):
        return 1
    manifest = load(MANIFEST)
    manifest["version"] = version()
    with open(SERVER_SOURCE, "rb") as f:
        server = f.read()
    files = [("manifest.json", (json.dumps(manifest, indent=2) + "\n").encode("utf-8")), ("server/mcp_stdio.py", server)]
    if manifest.get("icon"):
        with open(ICON_SOURCE, "rb") as f:
            files.append((manifest["icon"], f.read()))
    os.makedirs(folder, exist_ok=True)
    target = os.path.join(folder, f"formpath-{manifest['version']}.mcpb")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(files):
            info = zipfile.ZipInfo(name, STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o644 << 16
            z.writestr(info, data, compresslevel=9)
    print(f"[mcpb] wrote {target}")
    return 0


def main(argv):
    if argv[:1] == ["check"] and len(argv) == 1:
        return check()
    if argv[:1] == ["build"] and len(argv) == 2:
        return build(argv[1])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
