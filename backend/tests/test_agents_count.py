import sys

from conftest import REPO, tool_catalogue


def agents_module():
    sys.path.insert(0, str(REPO / "setup"))
    import agents

    return agents


def test_a_stale_count_in_the_skill_description_is_found_and_corrected():
    agents = agents_module()
    total = len(tool_catalogue())
    stale = "description: Covers a, b, c and 79 more tools. Not for code."
    assert agents.description_wanted(stale) == f"description: Covers a, b, c and {total - 3} more tools. Not for code."
    assert agents.description_wanted("a description with no count") == "a description with no count"


def test_the_checked_in_skill_description_matches_the_catalogue():
    agents = agents_module()
    for root in (".claude", ".agents"):
        text = (REPO / root / "skills" / "formpath-harness" / "SKILL.md").read_text(encoding="utf-8")
        assert agents.description_wanted(text) == text, root
