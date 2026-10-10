
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from app.core import config
from app.services import secrets

RULE = "Reply with the rewritten prompt only: no preamble, no quotes, no explanation."


class LlmError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _path() -> Path:
    return config.data_dir() / "llm.json"


def _settings() -> dict:
    try:
        s = json.loads(_path().read_text())
        return s if isinstance(s, dict) else {}
    except (OSError, ValueError):
        return {}


def _write(s: dict) -> None:
    path = _path()
    temp = path.with_suffix(".tmp")
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(s, f)
    os.replace(temp, path)
    os.chmod(path, 0o600)


def _file_key() -> str | None:
    return _settings().get("key") or None


def _file_clear() -> None:
    s = _settings()
    if "key" in s:
        s.pop("key")
        _write(s)


def _file_write(key: str) -> None:
    s = _settings()
    s["key"] = key
    _write(s)


def _key() -> str | None:
    return secrets.get("llm", _file_key, _file_clear)


def status() -> dict:
    s = _settings()
    return {"configured": bool(s.get("baseUrl") and s.get("model")), "baseUrl": s.get("baseUrl", ""), "model": s.get("model", ""), "hasKey": bool(_key()), "store": secrets.where()["store"], "vision": bool(s.get("vision"))}


def save(base_url: str, model: str, key: str | None = None, forget_key: bool = False, vision: bool | None = None) -> dict:
    parsed = urllib.parse.urlparse(base_url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise LlmError("The address must be an http:// or https:// address, such as http://localhost:11434/v1 for Ollama.", 422)
    model = model.strip()
    if not model or len(model) > 200:
        raise LlmError("Name the model to use.", 422)
    s = _settings()
    s["baseUrl"], s["model"] = base_url.strip().rstrip("/"), model
    if vision is not None:
        s["vision"] = bool(vision)
    if key is not None and key.strip() and not forget_key and (len(key.strip()) > 512 or any(c.isspace() for c in key.strip())):
        raise LlmError("That does not look like an API key.", 422)
    _write(s)
    if forget_key:
        secrets.delete("llm", _file_clear)
    elif key is not None and key.strip():
        secrets.put("llm", key.strip(), _file_write, _file_clear)
    return status()


def _call(path: str, body: dict | None = None, timeout: float = 120) -> dict:
    s = _settings()
    if not s.get("baseUrl") or not s.get("model"):
        raise LlmError("Set a language model first, in Preferences > Plugins.", 428)
    key = _key()
    headers = {"Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key else {})}
    req = urllib.request.Request(s["baseUrl"] + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise LlmError("The model's service refused the key.", 502)
        if exc.code == 404:
            raise LlmError(f"The service at {s['baseUrl']} has no such model or path.", 502)
        raise LlmError(f"The model's service answered with an error ({exc.code}).", 502)
    except (urllib.error.URLError, OSError) as exc:
        raise LlmError(f"Nothing answers at {s['baseUrl']}. Start the service, or check its address. ({exc.__class__.__name__})", 502)
    except ValueError:
        raise LlmError("The model's service did not answer in the expected form.", 502)


def chat(messages: list, tools: list) -> dict:
    if not isinstance(messages, list) or not 0 < len(messages) <= 200:
        raise LlmError("The conversation is empty or too long.", 400)
    body = {"model": _settings().get("model"), "messages": messages, "temperature": 0.3, "max_tokens": 4000,
            **({"tools": tools, "tool_choice": "auto"} if tools else {})}
    choices = _call("/chat/completions", body, timeout=180).get("choices") or []
    message = (choices[0] if choices else {}).get("message") or {}
    calls = [c for c in (message.get("tool_calls") or []) if isinstance(c, dict) and isinstance(c.get("function"), dict)]
    return {"content": message.get("content") or "", "tool_calls": [{"id": str(c.get("id") or f"call_{i}"), "name": str(c["function"].get("name") or ""),
            "arguments": str(c["function"].get("arguments") or "{}")} for i, c in enumerate(calls)]}


def generate(system: str, prompt: str, image: str | None = None, temperature: float = 0.8, max_tokens: int = 6000) -> dict:
    s = _settings()
    prompt, system = (prompt or "").strip(), (system or "").strip()
    if not prompt:
        raise LlmError("Nothing to ask the model.", 400)
    if image is not None:
        if not s.get("vision"):
            raise LlmError("The configured model is not marked as reading images. Turn on 'The model reads images' in Preferences > Plugins if it does.", 428)
        if not isinstance(image, str) or not image.startswith("data:image/") or len(image) > 8_000_000:
            raise LlmError("The image must be a PNG or JPEG data URL under 6 MB.", 400)
    content = [{"type": "text", "text": prompt[:12000]}, {"type": "image_url", "image_url": {"url": image}}] if image else prompt[:12000]
    temperature = float(temperature) if isinstance(temperature, (int, float)) else 0.8
    max_tokens = int(max_tokens) if isinstance(max_tokens, (int, float)) else 6000
    body = {"model": s.get("model"), "temperature": max(0.0, min(1.5, temperature)), "max_tokens": max(64, min(16000, max_tokens)),
            "messages": [*([{"role": "system", "content": system[:12000]}] if system else []), {"role": "user", "content": content}]}
    choices = _call("/chat/completions", body, timeout=240).get("choices") or []
    text = str(((choices[0] if choices else {}).get("message") or {}).get("content") or "")
    if not text.strip():
        raise LlmError("The model answered with nothing.", 502)
    return {"text": text[:400000], "model": s.get("model", "")}


def models() -> list[str]:
    data = _call("/models", timeout=10).get("data", [])
    return [str(m.get("id")) for m in data if isinstance(m, dict) and m.get("id")][:200]


def improve(prompt: str, instructions: str) -> str:
    prompt, instructions = prompt.strip(), instructions.strip()
    if not prompt:
        raise LlmError("Write a prompt to improve first.", 400)
    body = {"model": _settings().get("model"), "temperature": 0.7, "max_tokens": 600,
            "messages": [{"role": "system", "content": f"{instructions[:8000]}\n\n{RULE}"}, {"role": "user", "content": prompt[:4000]}]}
    choices = _call("/chat/completions", body).get("choices") or []
    text = str(((choices[0] if choices else {}).get("message") or {}).get("content") or "").strip()
    for prefix in ("prompt:", "rewritten prompt:", "improved prompt:"):
        if text.lower().startswith(prefix):
            text = text[len(prefix):].strip()
    text = text.strip().strip('"').strip("\u201c\u201d").strip()
    if not text:
        raise LlmError("The model answered with nothing.", 502)
    return text[:4000]
