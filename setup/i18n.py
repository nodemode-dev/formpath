#!/usr/bin/env python3
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "src"
I18N = SRC / "i18n"
KEYS = I18N / "keys.json"
LOCALES = I18N / "locales"
LANGS = ["es", "es-MX", "pt-BR", "fr", "fr-CA", "de", "it", "nl", "da", "fi", "nb", "sv", "ru", "pl", "cs", "hu", "uk", "tr",
         "zh-Hans", "zh-Hant", "ja", "ko", "id", "th", "vi"]
USAGE = """./formpath i18n <command>

  extract              harvest the interface's English strings from frontend/src into frontend/src/i18n/keys.json
  check [LANG]         every language has every key, with the same {0} placeholders; exit 1 otherwise
  missing LANG         print the keys LANG has not translated, as a JSON list
  untranslated LANG    print sentences LANG holds in English unchanged, as a JSON list
  prune                drop table rows whose English key is no longer in keys.json
  export LANG FILE.csv write English and LANG side by side for a reviewer
  import LANG FILE.csv read a reviewed CSV back into frontend/src/i18n/locales/LANG.json"""

SKIP_DIRS = {"i18n", "automation", "demos"}
AGENT_TEXT = re.compile(r"\b(description|when)\s*:\s*(?:'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`)")
SINGLE = re.compile(r"'((?:[^'\\\n]|\\.)*)'")
TEMPLATE = re.compile(r"`((?:[^`\\]|\\.)*)`", re.S)
DOUBLE = re.compile(r'"((?:[^"\\\n]|\\.)*)"')
IDENT = re.compile(r"^[a-z0-9_.:/#@%+=\-\[\]()*,|<>!?$&^~ ]*$")
CODEISH = re.compile(r"(^[A-Z_][A-Z0-9_]+$)|(^\w+\(.*\)$)|(^[.#][\w-]+)|(=>)|(\bfunction\b)|(^\s*[{[])|(\b(px|em|rem|deg|vh|vw)\b\s*[;)]?$)|(^https?://)|(^[\w-]+\.(ts|js|json|css|svg|png|fpth|pdf)$)|(\\n)|(\\x)|(\\u)")
ATTR = re.compile(r'\b(title|placeholder|aria-label|alt)="([^"]*)"')
TAGTEXT = re.compile(r">([^<>]+)<")


def unescape(s: str) -> str:
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\`", "`").replace("\\\\", "\\")


def numbered(s: str) -> tuple[str, int]:
    out, n, i, depth, start = [], 0, 0, 0, -1
    while i < len(s):
        if s.startswith("${", i) and depth == 0:
            depth, start, i = 1, i, i + 2
            continue
        if depth:
            if s[i] == "{":
                depth += 1
            elif s[i] == "}":
                depth -= 1
                if depth == 0:
                    out.append(f"\x00{n}\x00")
                    n += 1
            i += 1
            continue
        out.append(s[i])
        i += 1
    return "".join(out), n


def renumber(text: str) -> str:
    seen: dict[str, int] = {}

    def sub(m: re.Match) -> str:
        k = m.group(1)
        if k not in seen:
            seen[k] = len(seen)
        return "{" + str(seen[k]) + "}"
    return re.sub(r"\x00(\d+)\x00", sub, text)


def wanted(s: str) -> bool:
    s = s.strip()
    if len(s) < 2 or len(s) > 400 or not re.search(r"[A-Za-z]{2}", s):
        return False
    if re.fullmatch(r"(\{\d+\}\s*)+", s) or s.startswith("/"):
        return False
    if re.fullmatch(r"((Alt|Shift|Mod|Ctrl|Cmd)\+)+\S{1,9}", s):
        return False
    if re.match(r"[a-z]", s) and " " not in s:
        return False
    if not re.match(r"[A-Za-z0-9{(]", s) or re.search(r"%%|<<|/Type|/Filter|\bcm$|sans-serif|monospace|\|\||&&|\?\.|'\}|\}\.join", s):
        return False
    if IDENT.match(s) and not re.search(r"[A-Z]", s):
        return False
    if CODEISH.search(s):
        return False
    if re.search(r"[;{}]", s.replace("{0}", "").replace("{1}", "").replace("{2}", "").replace("{3}", "")) and not re.search(r"[a-z] [a-z]", s):
        return False
    if re.fullmatch(r"[\w-]+", s) and not re.match(r"[A-Z]", s):
        return False
    if re.search(r"\b(var|const|let|return|import|export|class|new)\b\s", s) and re.search(r"[=(){};]", s):
        return False
    return True


def harvest_html(body: str, keys: set[str]) -> None:
    for m in ATTR.finditer(body):
        v = renumber(m.group(2)).strip()
        if wanted(v):
            keys.add(v)
    for m in TAGTEXT.finditer(body):
        v = renumber(m.group(1))
        v = re.sub(r"\s+", " ", v).strip()
        if wanted(v):
            keys.add(v)


def harvest_file(text: str, keys: set[str]) -> None:
    lines = [ln for ln in text.splitlines() if not ln.lstrip().startswith(("import ", "export * from", "//"))]
    text = AGENT_TEXT.sub("", "\n".join(lines))
    for m in TEMPLATE.finditer(text):
        body, _ = numbered(unescape(m.group(1)))
        if "<" in body and ">" in body:
            harvest_html(body, keys)
            continue
        v = renumber(body).strip()
        if "\n" not in v and wanted(v):
            keys.add(v)
    stripped = TEMPLATE.sub("``", text)
    for rx in (SINGLE, DOUBLE):
        for m in rx.finditer(stripped):
            raw = unescape(m.group(1))
            if "<" in raw and ">" in raw:
                harvest_html(raw, keys)
                continue
            if wanted(raw):
                keys.add(raw.strip())


def extract() -> int:
    keys: set[str] = set()
    for path in sorted(SRC.rglob("*.ts")):
        if SKIP_DIRS & set(path.relative_to(SRC).parts):
            continue
        harvest_file(path.read_text(encoding="utf-8"), keys)
    for path in [ROOT / "frontend" / "index.html"]:
        harvest_html(path.read_text(encoding="utf-8"), keys)
    I18N.mkdir(parents=True, exist_ok=True)
    out = sorted(keys, key=lambda s: (s.lower(), s))
    old = json.loads(KEYS.read_text(encoding="utf-8")) if KEYS.is_file() else []
    KEYS.write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"i18n: {len(out)} keys ({len(set(out) - set(old))} new, {len(set(old) - set(out))} gone) in {KEYS.relative_to(ROOT)}")
    return 0


def load(lang: str) -> dict[str, str]:
    path = LOCALES / f"{lang}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def holes(en: str) -> list[str]:
    return sorted(re.findall(r"\{\d+(?::[^{}]*)?\}", en), key=lambda h: h)


def check(only: str | None = None) -> int:
    keys = json.loads(KEYS.read_text(encoding="utf-8"))
    bad = 0
    for lang in [only] if only else LANGS:
        loc = load(lang)
        missing = [k for k in keys if not loc.get(k)]
        broken = [k for k in keys if loc.get(k) and sorted(re.findall(r"\{\d+", k)) != sorted(re.findall(r"\{\d+", loc[k]))]
        state = "ok" if not missing and not broken else "FAIL"
        print(f"{lang:8} {len(keys) - len(missing):5} of {len(keys)} translated, {len(broken)} with changed placeholders  {state}")
        bad += len(missing) + len(broken)
    return 1 if bad else 0


def missing(lang: str) -> int:
    keys = json.loads(KEYS.read_text(encoding="utf-8"))
    loc = load(lang)
    print(json.dumps([k for k in keys if not loc.get(k)], ensure_ascii=False, indent=0))
    return 0


def export(lang: str, file: str) -> int:
    keys = json.loads(KEYS.read_text(encoding="utf-8"))
    loc = load(lang)
    with open(file, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["english", lang])
        for k in keys:
            w.writerow([k, loc.get(k, "")])
    print(f"i18n: wrote {len(keys)} rows to {file}")
    return 0


def import_(lang: str, file: str) -> int:
    keys = set(json.loads(KEYS.read_text(encoding="utf-8")))
    loc = load(lang)
    n = 0
    with open(file, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r, None)
        for row in r:
            if len(row) >= 2 and row[0] in keys and row[1].strip():
                loc[row[0]] = row[1]
                n += 1
    LOCALES.mkdir(parents=True, exist_ok=True)
    (LOCALES / f"{lang}.json").write_text(json.dumps(dict(sorted(loc.items())), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"i18n: {n} rows read into {lang}")
    return 0


def untranslated(lang: str) -> int:
    keys = json.loads(KEYS.read_text(encoding="utf-8"))
    loc = load(lang)
    print(json.dumps([k for k in keys if loc.get(k) == k and re.search(r"[a-z]{3,} [a-z]{3,}", k)], ensure_ascii=False, indent=0))
    return 0


def prune() -> int:
    keys = set(json.loads(KEYS.read_text(encoding="utf-8")))
    for lang in LANGS:
        loc = load(lang)
        kept = {k: v for k, v in loc.items() if k in keys}
        if len(kept) != len(loc):
            (LOCALES / f"{lang}.json").write_text(json.dumps(dict(sorted(kept.items())), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
        print(f"{lang:8} {len(loc) - len(kept)} stale rows removed")
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(USAGE)
        return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == "extract":
        return extract()
    if cmd == "check":
        return check(rest[0] if rest else None)
    if cmd == "missing" and rest:
        return missing(rest[0])
    if cmd == "untranslated" and rest:
        return untranslated(rest[0])
    if cmd == "prune":
        return prune()
    if cmd == "export" and len(rest) == 2:
        return export(*rest)
    if cmd == "import" and len(rest) == 2:
        return import_(*rest)
    print(USAGE)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
