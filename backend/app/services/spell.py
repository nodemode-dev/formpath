import json
import threading
from functools import lru_cache

from spellchecker import SpellChecker

from app.core import config

_LANGS = {"en", "es", "fr", "pt", "de", "it", "ru", "ar", "nl", "eu", "lv", "fa"}
_lock = threading.Lock()


def _code(lang: str) -> str:
    base = (lang or "en").replace("_", "-").split("-")[0].lower()
    return base if base in _LANGS else "en"


@lru_cache(maxsize=8)
def _checker(code: str) -> SpellChecker:
    return SpellChecker(language=code)


def _file():
    return config.data_dir() / "spell-dictionary.json"


def dictionary() -> list[str]:
    try:
        raw = json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    words = raw.get("words", []) if isinstance(raw, dict) else []
    return sorted({w for w in words if isinstance(w, str) and w})


def _save(words: set[str]) -> None:
    path = _file()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"words": sorted(words)}, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def edit_dictionary(add: list[str], remove: list[str]) -> list[str]:
    with _lock:
        words = set(dictionary())
        words.update(w.strip().lower() for w in add if w.strip())
        words.difference_update(w.strip().lower() for w in remove)
        _save(words)
        return sorted(words)


def _worth_checking(word: str) -> bool:
    if len(word) < 2 or any(ch.isdigit() for ch in word):
        return False
    if not any(ch.isalpha() for ch in word):
        return False
    return not (word.isupper() and len(word) <= 5)


def check(words: list[str], lang: str) -> list[dict[str, object]]:
    spell = _checker(_code(lang))
    known = set(dictionary())
    out: list[dict[str, object]] = []
    seen: set[str] = set()
    for word in words:
        if word in seen or not _worth_checking(word):
            continue
        seen.add(word)
        low = word.lower().strip("'")
        if low in known or not spell.unknown([low]):
            continue
        found = spell.candidates(low) or set()
        ranked = sorted((c for c in found if c != low), key=lambda c: (-spell.word_usage_frequency(c), c))[:6]
        if word[:1].isupper():
            ranked = [c[:1].upper() + c[1:] for c in ranked]
        out.append({"word": word, "suggestions": ranked})
    return out
