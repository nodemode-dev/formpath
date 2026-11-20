import json

import keyring
import pytest
from keyring.backend import KeyringBackend


class StandIn(KeyringBackend):
    priority = 1

    def __init__(self):
        self.rows = {}

    def get_password(self, service, username):
        return self.rows.get((service, username))

    def set_password(self, service, username, password):
        self.rows[(service, username)] = password

    def delete_password(self, service, username):
        self.rows.pop((service, username), None)


class NoKeychain(KeyringBackend):
    priority = 1

    def get_password(self, *args):
        raise keyring.errors.NoKeyringError("no keychain")

    def set_password(self, *args):
        raise keyring.errors.NoKeyringError("no keychain")

    def delete_password(self, *args):
        return None


@pytest.fixture
def sealed():
    from app.core import seal
    from app.services import claude_code

    before = keyring.get_keyring()
    stand = StandIn()
    keyring.set_keyring(stand)
    seal.reset()
    claude_code.prefs_file().unlink(missing_ok=True)
    yield claude_code, stand
    claude_code.prefs_file().unlink(missing_ok=True)
    keyring.set_keyring(before)
    seal.reset()


def edit_file(claude_code, **values):
    stored = json.loads(claude_code.prefs_file().read_text(encoding="utf-8"))
    stored.update(values)
    claude_code.prefs_file().write_text(json.dumps(stored), encoding="utf-8")


def test_a_window_write_is_sealed_and_read_back(sealed):
    claude_code, stand = sealed
    saved = claude_code.save_prefs({"claudeBin": "/bin/sh", "claudeFolder": "/tmp"})
    assert saved["seal"] == "ok" and saved["sealBroken"] is False and saved["claudeBin"] == "/bin/sh"
    assert ("FormPath", "settings-seal") in stand.rows
    assert "seal" in json.loads(claude_code.prefs_file().read_text(encoding="utf-8"))


def test_a_hand_edit_of_the_program_is_caught(sealed):
    claude_code, _ = sealed
    claude_code.save_prefs({"claudeBin": "/bin/sh"})
    edit_file(claude_code, claudeBin="/tmp/other-program")
    checked = claude_code.prefs()
    assert checked["seal"] == "broken" and checked["sealBroken"] is True
    assert checked["claudeBin"] == "" and claude_code._pref("claudeBin") == ""
    assert claude_code.status()["sealBroken"] is True


def test_a_hand_edit_of_the_folder_is_caught(sealed):
    claude_code, _ = sealed
    claude_code.save_prefs({"claudeFolder": ""})
    edit_file(claude_code, claudeFolder="/tmp/somewhere-else")
    assert claude_code.prefs()["sealBroken"] is True and claude_code.prefs()["claudeFolder"] == ""


def test_a_hand_edit_that_only_tightens_is_not_a_break(sealed):
    claude_code, _ = sealed
    claude_code.save_prefs({"claudeBin": "/bin/sh"})
    edit_file(claude_code, claudeBin="")
    assert claude_code.prefs()["sealBroken"] is False


def test_a_settings_file_with_a_program_and_no_seal_asks_to_be_confirmed(sealed):
    claude_code, _ = sealed
    claude_code.prefs_file().write_text(json.dumps({"claudeBin": "/bin/sh"}), encoding="utf-8")
    checked = claude_code.prefs()
    assert checked["sealBroken"] is True and checked["claudeBin"] == ""


def test_the_next_window_write_confirms_and_reseals(sealed):
    claude_code, _ = sealed
    claude_code.save_prefs({"claudeBin": "/bin/sh"})
    edit_file(claude_code, claudeBin="/tmp/other-program")
    saved = claude_code.save_prefs({"claudeFirstMessage": "hello"})
    assert saved["seal"] == "ok" and saved["sealBroken"] is False and saved["claudeBin"] == ""


def test_the_first_message_is_not_part_of_the_seal(sealed):
    claude_code, _ = sealed
    claude_code.save_prefs({"claudeBin": "/bin/sh"})
    edit_file(claude_code, claudeFirstMessage="changed by hand")
    assert claude_code.prefs()["sealBroken"] is False


def test_without_a_keychain_the_engine_runs_and_the_values_stand(sealed):
    from app.core import seal

    claude_code, _ = sealed
    keyring.set_keyring(NoKeychain())
    seal.reset()
    saved = claude_code.save_prefs({"claudeBin": "/bin/sh"})
    assert saved["seal"] == "unavailable" and saved["sealBroken"] is False and saved["claudeBin"] == "/bin/sh"
    assert "seal" not in json.loads(claude_code.prefs_file().read_text(encoding="utf-8"))
    assert claude_code.status()["seal"] == "unavailable"


def test_a_keyring_package_that_cannot_be_imported_degrades_to_unavailable(sealed, monkeypatch):
    from app.core import seal

    claude_code, _ = sealed
    monkeypatch.setitem(__import__("sys").modules, "keyring", None)
    seal.reset()
    assert claude_code.prefs()["seal"] == "unavailable"


def test_a_file_sealed_by_0_58_0_reads_whole_and_keeps_the_claude_code_place(sealed, tmp_path):
    import hashlib
    import hmac

    from app.core import seal

    claude_code, _ = sealed
    program = tmp_path / "claude"
    program.write_text("#!/bin/sh\nexit 0\n")
    program.chmod(0o755)
    key = seal._load(True)
    old = {"claudeBin": str(program), "claudeFolder": "", "claudeFirstMessage": "hello"}
    body = json.dumps({k: old[k] for k in ("claudeBin", "claudeFolder")}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    claude_code.prefs_file().write_text(json.dumps({**old, "seal": hmac.new(key, body.encode("utf-8"), hashlib.sha256).hexdigest()}, indent=2), encoding="utf-8")
    seen = claude_code.prefs()
    assert seen["seal"] == "ok" and seen["sealBroken"] is False
    assert seen["claudeBin"] == str(program) and claude_code.setting("claude") == str(program)
    assert [claude_code.setting(k) for k in ("codex", "cursor", "antigravity")] == ["", "", ""]
    claude_code.save_prefs({"claudeFirstMessage": "again"})
    saved = claude_code.save_prefs({"codexBin": str(program)})
    assert saved["seal"] == "ok" and saved["claudeBin"] == str(program) and saved["codexBin"] == str(program)


@pytest.mark.parametrize("kind", ["codex", "cursor", "antigravity"])
def test_the_other_programs_places_are_sealed_and_given_to_the_finder_first(sealed, tmp_path, kind):
    from app.services import agent_lookup

    claude_code, _ = sealed
    program = tmp_path / kind
    program.write_text("#!/bin/sh\nexit 0\n")
    program.chmod(0o755)
    saved = claude_code.save_prefs({f"{kind}Bin": str(program)})
    assert saved["seal"] == "ok" and saved[f"{kind}Bin"] == str(program)
    found = agent_lookup.find(kind, setting=claude_code.setting(kind), override_vars=(), env={"PATH": ""})
    assert found.how == "setting" and found.path == str(program)
    edit_file(claude_code, **{f"{kind}Bin": "/tmp/other-program"})
    checked = claude_code.prefs()
    assert checked["sealBroken"] is True and checked[f"{kind}Bin"] == "" and claude_code.setting(kind) == ""
    assert checked["claudeBin"] == ""
