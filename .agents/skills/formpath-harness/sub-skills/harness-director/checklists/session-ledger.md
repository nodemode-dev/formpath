# Session ledger

Keep this in working memory, updated after every call. It is what lets a long drawing session recover from a failed call or a stale id.

| Field | Content |
| --- | --- |
| Brief | purpose, audience, deliverables |
| Document | name, units, artboards (index, x, y, width, height) |
| Plan | margins, element positions and sizes in points, palette hex values, type sizes |
| Objects | name to id, updated after every call that returns ids; replaced after Pathfinder, expand, outlines and undo |
| Checks | each `get_image`: what matched the plan, what was fixed |
| Files | every path a tool reported writing |

Before calling the work done, confirm: the last check row is after the last change; every deliverable has a file row; nothing in Objects points at an id that a later call replaced.
