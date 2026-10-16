#!/usr/bin/env python3
"""./formpth agents: drawing in formpth from Claude Code, Codex and Cursor.

  sync [--check]            generate the harness skill's tool reference from the engine's MCP catalogue and mirror the
                            skill from .claude/skills to .agents/skills (Codex, Cursor); --check: exit 1 if drifted
  install [--dry-run] [claude|codex|cursor ...]
                            set the three up for this user account (all by default): the MCP server (./formpth mcp at
                            this folder's absolute path) and the harness skill; files backed up before changing;
                            running it again changes nothing
"""

import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = "formpth-harness"
SKILL = ROOT / ".claude" / "skills" / NAME
MIRROR = ROOT / ".agents" / "skills" / NAME
LAUNCH = str(ROOT / ("formpth.bat" if os.name == "nt" else "formpth"))
GROUPS = [
    ("Look", {"get_document", "get_image", "get_svg", "get_object"}),
    ("Files and documents", {"new_document", "open_file", "save_project", "export_file", "switch_document", "place_image", "links", "document_setup"}),
    ("Selecting", {"select", "select_same", "select_similar"}),
    ("Drawing", {"draw_path", "draw_shape", "edit_shape", "add_text", "edit_anchors", "add_dimension", "perspective"}),
    ("Paint and appearance", {"set_paint", "set_stroke", "set_appearance", "add_swatch", "swatch_library", "swatch_group", "color_harmony", "graphic_style"}),
    ("Objects and layers", {"set_object", "arrange", "group", "compound_path", "attributes", "clipping_mask", "opacity_mask", "delete_objects", "duplicate_objects", "add_layer", "set_layer", "delete_layer", "move_to_layer", "layer_action"}),
    ("Transform and align", {"transform", "align", "puppet_warp"}),
    ("Path operations", {"pathfinder", "path_operation", "shape_builder", "shaper"}),
    ("Effects and live objects", {"apply_effect", "three_d", "expand", "make_blend", "envelope", "repeat", "symbol", "symbolism", "apply_brush", "new_brush", "brush_library", "image_trace", "live_paint", "intertwine", "gradient_mesh", "make_pattern", "edit_pattern", "recolor"}),
    ("Colour management", {"list_color_profiles", "set_color_settings", "convert_to_profile", "proof_colors"}),
    ("Artboards", {"artboard"}),
    ("Type", {"set_text", "text_flow", "text_style", "find_font", "create_outlines", "retype"}),
    ("Generative", {"generative_shape_fill", "generate_patterns", "text_to_vector", "generative_recolor"}),
    ("Graphs and data", {"graph", "variables"}),
    ("Commands", {"list_commands", "run_command", "actions"}),
    ("History", {"undo", "redo"}),
]


def tools_reference() -> str:
    sys.path.insert(0, str(ROOT / "backend"))
    from app.routers.mcp import TOOLS
    out = ["# formpth tools", "", "Generated from the engine's catalogue by `./formpth agents sync`; do not edit by hand.", "", "## Contents", ""]
    listed = set()
    for title, names in GROUPS:
        here = [t["name"] for t in TOOLS if t["name"] in names]
        listed.update(here)
        if here:
            out.append(f"- {title}: " + ", ".join(f"`{n}`" for n in here))
    rest = [t["name"] for t in TOOLS if t["name"] not in listed]
    if rest:
        out.append("- Other: " + ", ".join(f"`{n}`" for n in rest))
    out.append("")
    for t in TOOLS:
        a = t["annotations"]
        marks = [m for m, on in (("read-only", a["readOnlyHint"]), ("replaces or removes", a["destructiveHint"]), ("reaches outside this computer", a["openWorldHint"])) if on]
        out += [f"## {t['name']}", "", t["description"], ""]
        props, required = t["inputSchema"]["properties"], set(t["inputSchema"]["required"])
        for k, v in props.items():
            kind = v.get("type", "any")
            if isinstance(kind, list):
                kind = " or ".join(kind)
            kind += f" ({' | '.join(map(str, v['enum']))})" if "enum" in v else ""
            extra = "; ".join(x for x in (("required" if k in required else ""), (f"default {json.dumps(v['default'])}" if "default" in v else ""), v.get("description", "")) if x)
            out.append(f"- `{k}`: {kind}" + (f"; {extra}" if extra else ""))
        if not props:
            out.append("- no parameters")
        if marks:
            out += ["", "Note: " + ", ".join(marks) + "."]
        out.append("")
    return "\n".join(out)


def commands_reference() -> str | None:
    path = Path(os.environ.get("FORMPTH_DATA", str(Path.home() / "Formpth"))) / "commands-catalogue.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    entries = data if isinstance(data, list) else data.get("commands", [])
    out = ["# formpth commands", "", "Generated from the engine's stored catalogue by `./formpth agents sync`; do not edit by hand.", ""]
    groups: dict = {}
    for e in entries:
        if e.get("kind", "command") == "command":
            groups.setdefault(e.get("group", "Other"), []).append(e)
    for g in sorted(groups):
        out += [f"## {g}", ""]
        for e in sorted(groups[g], key=lambda x: x["id"]):
            line = f"- `{e['id']}` ({e.get('path', e.get('label', ''))}): {e.get('description', '')}"
            if e.get("when"):
                line += f" {e['when']}"
            out.append(line)
        out.append("")
    return "\n".join(out)


def _files(folder: Path) -> dict:
    return {str(p.relative_to(folder)): p.read_bytes() for p in sorted(folder.rglob("*")) if p.is_file()}


def sync(check: bool) -> int:
    ref = SKILL / "references" / "tools.md"
    want = tools_reference()
    drift = []
    if not ref.exists() or ref.read_text(encoding="utf-8") != want:
        drift.append(str(ref.relative_to(ROOT)))
        if not check:
            ref.parent.mkdir(parents=True, exist_ok=True)
            ref.write_text(want, encoding="utf-8")
    cref, cwant = SKILL / "references" / "commands.md", commands_reference()
    if cwant is None:
        print("agents: no stored command catalogue yet; skipping references/commands.md")
    elif not cref.exists() or cref.read_text(encoding="utf-8") != cwant:
        drift.append(str(cref.relative_to(ROOT)))
        if not check:
            cref.write_text(cwant, encoding="utf-8")
    if not MIRROR.exists() or _files(MIRROR) != _files(SKILL):
        drift.append(str(MIRROR.relative_to(ROOT)))
        if not check:
            shutil.rmtree(MIRROR, ignore_errors=True)
            shutil.copytree(SKILL, MIRROR)
    if check:
        print("agents: in step" if not drift else "agents: drifted: " + ", ".join(drift) + " (run ./formpth agents sync)")
        return 1 if drift else 0
    print("agents: " + ("updated " + ", ".join(drift) if drift else "already in step"))
    return 0


def _backup(path: Path, dry: bool) -> None:
    if path.exists() and not dry:
        shutil.copy2(path, path.with_name(path.name + f".bak-{time.strftime('%Y%m%d-%H%M%S')}"))


def _copy_skill(to: Path, dry: bool, said: list) -> None:
    if to.exists() and _files(to) == _files(SKILL):
        said.append(f"  skill already at {to}")
        return
    said.append(f"  skill -> {to}")
    if not dry:
        shutil.rmtree(to, ignore_errors=True)
        to.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(SKILL, to)


def install_claude(home: Path, dry: bool, said: list) -> None:
    said.append("Claude Code:")
    claude = shutil.which("claude")
    if claude:
        have = subprocess.run([claude, "mcp", "get", "formpth"], capture_output=True, text=True)
        if have.returncode == 0 and LAUNCH in have.stdout:
            said.append("  MCP server formpth already set (user scope)")
        else:
            said.append(f"  claude mcp add --scope user formpth -- {LAUNCH} mcp")
            if not dry:
                if have.returncode == 0:
                    subprocess.run([claude, "mcp", "remove", "formpth", "--scope", "user"], capture_output=True)
                subprocess.run([claude, "mcp", "add", "--scope", "user", "formpth", "--", LAUNCH, "mcp"], check=True, capture_output=True)
    else:
        said.append(f"  the claude command is not installed here; once it is, run: claude mcp add --scope user formpth -- {LAUNCH} mcp")
    _copy_skill(home / ".claude" / "skills" / NAME, dry, said)


def install_codex(home: Path, dry: bool, said: list) -> None:
    said.append("Codex:")
    cfg = Path(os.environ.get("CODEX_HOME", home / ".codex")) / "config.toml"
    launch = LAUNCH.replace("\\", "\\\\")
    block = f'[mcp_servers.formpth]\ncommand = "{launch}"\nargs = ["mcp"]\nstartup_timeout_sec = 90\ntool_timeout_sec = 600\n'
    text = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
    found = re.search(r"(?ms)^\[mcp_servers\.formpth\]\n.*?(?=^\[|\Z)", text)
    if found and found.group(0).strip() == block.strip():
        said.append(f"  MCP server formpth already in {cfg}")
    else:
        said.append(f"  MCP server formpth -> {cfg}")
        if not dry:
            _backup(cfg, dry)
            cfg.parent.mkdir(parents=True, exist_ok=True)
            new = text[:found.start()] + block + "\n" + text[found.end():] if found else (text.rstrip("\n") + "\n\n" if text.strip() else "") + block
            cfg.write_text(new, encoding="utf-8")
    _copy_skill(home / ".agents" / "skills" / NAME, dry, said)


def install_cursor(home: Path, dry: bool, said: list) -> None:
    said.append("Cursor:")
    cfg = home / ".cursor" / "mcp.json"
    data = json.loads(cfg.read_text(encoding="utf-8")) if cfg.exists() and cfg.read_text(encoding="utf-8").strip() else {}
    entry = {"command": LAUNCH, "args": ["mcp"]}
    if data.get("mcpServers", {}).get("formpth") == entry:
        said.append(f"  MCP server formpth already in {cfg}")
    else:
        said.append(f"  MCP server formpth -> {cfg}")
        if not dry:
            _backup(cfg, dry)
            data.setdefault("mcpServers", {})["formpth"] = entry
            cfg.parent.mkdir(parents=True, exist_ok=True)
            cfg.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    _copy_skill(home / ".agents" / "skills" / NAME, dry, said)


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "install"
    rest = argv[1:]
    if cmd == "sync":
        return sync("--check" in rest)
    if cmd == "install":
        dry = "--dry-run" in rest
        which = [a for a in rest if not a.startswith("--")] or ["claude", "codex", "cursor"]
        bad = [w for w in which if w not in ("claude", "codex", "cursor")]
        if bad:
            print(f"agents: unknown client {', '.join(bad)} (claude, codex or cursor)", file=sys.stderr)
            return 2
        home, said = Path(os.environ.get("HOME", str(Path.home()))), []
        for w in which:
            {"claude": install_claude, "codex": install_codex, "cursor": install_cursor}[w](home, dry, said)
        print(("Would do (dry run):\n" if dry else "") + "\n".join(said))
        if not dry:
            print("\nRestart the clients. The first drawing asks you once, in the formpth window, to allow outside agents.")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
