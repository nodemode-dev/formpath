#!/usr/bin/env python3
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def config() -> str:
    server = {"type": "stdio", "command": sys.executable, "args": [os.path.join(ROOT, "setup", "mcp_stdio.py")]}
    return json.dumps({"mcpServers": {"formpath": server}})


def lookup():
    import importlib.util
    spec = importlib.util.spec_from_file_location("formpath_agent_lookup", os.path.join(ROOT, "backend", "app", "services", "agent_lookup.py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main(argv: list[str]) -> int:
    finder = lookup()
    found = finder.check(finder.find("claude", override_vars=("FORMPATH_CLAUDE_BIN",)))
    if found.state != "runs":
        print("[formpath] " + finder.sentence(found, finder.install("claude")), file=sys.stderr)
        return 1
    if "--print-config" in argv:
        print(config())
        return 0
    env = finder.child_env(found.path, keep=frozenset(k for k in os.environ if k.startswith("CLAUDE")))
    return subprocess.call(finder.start_argv([found.path, "--mcp-config", config(), "--allowedTools", "mcp__formpath", *argv], env), env=env)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
