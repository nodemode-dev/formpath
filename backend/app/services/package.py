import io
import json
import re
import shutil
import zipfile
from pathlib import Path

from app.services import fonts as fonts_service
from app.services import project_format as pf

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".svg", ".psd", ".pdf", ".ai", ".eps"}
MAX_LINK_BYTES = 1024 * 1024 * 1024
SAFE = re.compile(r"[\\/:*?\"<>|\x00-\x1f]+")


def clean(name: str, fallback: str = "Untitled") -> str:
    out = SAFE.sub("-", name).strip(" .")
    return out[:120] or fallback


def unique(taken: set[str], name: str) -> str:
    stem, suffix, n = Path(name).stem, Path(name).suffix, 1
    out = name
    while out.lower() in taken:
        n += 1
        out = f"{stem} {n}{suffix}"
    taken.add(out.lower())
    return out


def resolve_links(paths: list[str]) -> tuple[list[tuple[str, Path]], list[str]]:
    found: list[tuple[str, Path]] = []
    missing: list[str] = []
    seen: set[str] = set()
    for raw in paths:
        if not raw or raw in seen:
            continue
        seen.add(raw)
        p = Path(raw).expanduser()
        ok = p.is_absolute() and p.suffix.lower() in IMAGE_EXTS
        try:
            ok = ok and p.is_file() and p.stat().st_size <= MAX_LINK_BYTES
        except OSError:
            ok = False
        if ok:
            found.append((raw, p))
        else:
            missing.append(raw)
    return found, missing


def resolve_fonts(wanted: list[dict]) -> tuple[list[tuple[str, str, Path]], list[str]]:
    found: list[tuple[str, str, Path]] = []
    missing: list[str] = []
    seen: set[str] = set()
    for w in wanted:
        family, style = str(w.get("family", "")).strip(), str(w.get("style", "Regular")) or "Regular"
        if not family or f"{family}|{style}" in seen:
            continue
        seen.add(f"{family}|{style}")
        hit = fonts_service.find(family, style)
        if hit and Path(hit["path"]).is_file():
            found.append((family, style, Path(hit["path"])))
        else:
            missing.append(f"{family} {style}")
    return found, missing


def relink(node: object, mapping: dict[str, str]) -> None:
    if isinstance(node, dict):
        linked = node.get("linked")
        if isinstance(linked, dict) and linked.get("path") in mapping:
            linked["path"] = mapping[linked["path"]]
        for value in node.values():
            relink(value, mapping)
    elif isinstance(node, list):
        for value in node:
            relink(value, mapping)


class Plan:
    def __init__(self) -> None:
        self.entries: list[tuple[str, bytes | Path]] = []
        self.taken: dict[str, set[str]] = {}

    def add(self, folder: str, name: str, data: bytes | Path) -> str:
        rel = f"{folder}/{unique(self.taken.setdefault(folder, set()), name)}" if folder else unique(self.taken.setdefault("", set()), name)
        self.entries.append((rel, data))
        return rel


def build(
    name: str,
    manifest: dict,
    assets: dict[str, bytes],
    link_paths: list[str],
    font_wanted: list[dict],
    report: str,
    copy_links: bool,
    copy_fonts: bool,
    separate_links: bool,
    relink_copies: bool,
    destination: Path | None,
) -> tuple[bytes | None, dict]:
    stem = clean(name)
    plan = Plan()
    links, missing_links = resolve_links(link_paths) if copy_links else ([], [])
    mapping: dict[str, str] = {}
    link_folder = "Links" if separate_links else ""
    for raw, src in links:
        rel = plan.add(link_folder, clean(src.name), src)
        mapping[raw] = rel
    fonts, missing_fonts = resolve_fonts(font_wanted) if copy_fonts else ([], [])
    for _, _, src in fonts:
        plan.add("Fonts", clean(src.name), src)
    doc = json.loads(json.dumps(manifest))
    if relink_copies and destination is not None and mapping:
        relink(doc, {raw: str(destination / rel) for raw, rel in mapping.items()})
    project = pf.write_zip(doc, assets)
    plan.entries.insert(0, (f"{stem}.fpth", project))
    if report:
        plan.add("", f"{stem} report.txt", report.encode("utf-8"))
    summary = {
        "links": len(links), "fonts": len(fonts), "missingLinks": missing_links, "missingFonts": missing_fonts,
        "files": [rel for rel, _ in plan.entries],
    }
    if destination is None:
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for rel, data in plan.entries:
                if isinstance(data, Path):
                    archive.write(data, f"{stem}/{rel}")
                else:
                    archive.writestr(f"{stem}/{rel}", data)
        return out.getvalue(), summary
    for rel, data in plan.entries:
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, Path):
            shutil.copy2(data, target)
        else:
            target.write_bytes(data)
    summary["folder"] = str(destination)
    return None, summary
