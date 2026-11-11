"""Counts the commands in the stored catalogue that carry a hand-written description."""
import json
import os
import sys
import urllib.request
from pathlib import Path

MINIMUM = 120
FALLBACK = (", from a panel menu or shortcut.",)


def load() -> list | None:
    port = os.environ.get("FORMPATH_PORT", "8230")
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/commands", timeout=2) as r:
            data = json.load(r)
    except Exception:
        data = None
    if data is None:
        path = Path(os.environ.get("FORMPATH_DATA_DIR") or str(Path.home() / "Formpath")).expanduser() / "commands-catalogue.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else data.get("commands", [])


def hand_written(entry: dict) -> bool:
    d = (entry.get("description") or "").strip()
    return bool(d) and not d.endswith(FALLBACK) and ", as in " not in d


def main(argv: list[str]) -> int:
    entries = load()
    if entries is None:
        print("counts: no stored command catalogue yet; open the app once so it is written")
        return 1 if "--check" in argv else 0
    cmds = [e for e in entries if e.get("kind", "command") == "command"]
    done = sum(1 for e in cmds if hand_written(e))
    print(f"commands: {len(cmds)} total, {done} with a hand-written description, {sum(1 for e in cmds if e.get('when'))} with a use-when sentence")
    if "--check" in argv and done < MINIMUM:
        print(f"counts: fewer than {MINIMUM} commands have a hand-written description")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
