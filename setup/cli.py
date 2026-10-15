#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("FORMPTH_URL", "http://127.0.0.1:8230").rstrip("/")
USAGE = """./formpth cli <command>

  list [text] [--group NAME] [--json]   the command catalogue (menu commands and tools), filtered
  describe <id>                          one entry in full: menu path, parameters, whether it can run now
  run <id> [key=value ...] [--json '{...}']
                                         run a command on the open window, as the menu would
  <id> [key=value ...]                   the same as run

Values are read as JSON when they parse (12, true, [1,2], "text") and as text otherwise.
The formpth window must be open; the first run asks the person to allow outside agents,
unless this runs in formpth's own terminal dock."""


def call(method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    token = os.environ.get("FORMPTH_INAPP_TOKEN")
    if token:
        req.add_header("x-formpth-inapp", token)
    try:
        with urllib.request.urlopen(req, timeout=900) as res:
            return json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read()).get("detail")
        except ValueError:
            detail = exc.reason
        if isinstance(detail, dict):
            sugg = detail.get("suggestions") or []
            detail = detail.get("error", "") + (f" Did you mean {', '.join(sugg)}?" if sugg else "")
        raise SystemExit(f"[formpth] {detail}")
    except urllib.error.URLError:
        raise SystemExit(f"[formpth] the engine at {BASE} is not running; start formpth with ./formpth boot")


def value(raw: str):
    try:
        return json.loads(raw)
    except ValueError:
        return raw


def params(args: list[str]) -> dict:
    out: dict = {}
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--json" and i + 1 < len(args):
            out.update(json.loads(args[i + 1]))
            i += 2
            continue
        if "=" not in a:
            raise SystemExit(f"[formpth] {a} is not key=value")
        k, v = a.split("=", 1)
        out[k] = value(v)
        i += 1
    return out


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(USAGE)
        return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == "list":
        group, as_json, words = "", False, []
        i = 0
        while i < len(rest):
            if rest[i] == "--group" and i + 1 < len(rest):
                group = rest[i + 1]
                i += 2
                continue
            if rest[i] == "--json":
                as_json = True
            else:
                words.append(rest[i])
            i += 1
        q = urllib.parse.urlencode({"group": group, "text": " ".join(words)})
        r = call("GET", f"/api/commands?{q}")
        if as_json:
            print(json.dumps(r, indent=2))
            return 0
        for c in r["commands"]:
            keys = f"  [{c['keys'][0]}]" if c.get("keys") else ""
            extra = f"  params: {', '.join(c['params'])}" if c.get("params") else ""
            print(f"{c['id']:<34} {c.get('path', c.get('label', ''))}{keys}{extra}")
        print(f"\n{r['shown']} of {r['size']} · groups: {', '.join(r['groups'])}" + ("" if r.get("live") else " · the window is not open"))
        return 0
    if cmd == "describe":
        if not rest:
            raise SystemExit("[formpth] describe needs an id")
        print(json.dumps(call("GET", f"/api/commands/{urllib.parse.quote(rest[0])}"), indent=2))
        return 0
    if cmd == "run":
        if not rest:
            raise SystemExit("[formpth] run needs an id")
        cmd, rest = rest[0], rest[1:]
    r = call("POST", f"/api/commands/{urllib.parse.quote(cmd)}", params(rest))
    print(r.get("message") or "done")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
