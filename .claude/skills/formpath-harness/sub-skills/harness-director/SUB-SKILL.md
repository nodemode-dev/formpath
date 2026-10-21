---
name: harness-director
description: Entry point for any formpath drawing request. Owns intake of the brief, the session ledger, the phase order look, plan, build, check, deliver, and the gates that close each phase. Route here first for anything unscoped, then load the specialists it names.
---

# harness-director

## Purpose

Turn a request into finished, checked art in formpath and hand back the files and a one-line description of what was made. The director decides which specialists to load and refuses to call a phase done without its evidence.

## Preconditions

The formpath MCP server is reachable (the tools are listed). If no formpath tool is available, load `troubleshooting` before anything else.

## Procedure

1. **Intake.** Restate the brief as: purpose, artboard size and units, the elements, the palette, the type, the deliverables with formats and folders. Ask one question only if a deliverable's size or destination is genuinely unknown; otherwise choose a sensible default from `references/coordinates-and-paint.md` at the pack root and say which.
2. **Look.** `get_document`. If no document is open or the open one is unrelated, `new_document` with the planned size. `get_image` of the artboard.
3. **Plan.** Write the layout as numbers: the margins, the positions and sizes of every element, the colours as hex, the font sizes. Load the recipe from `illustration-workflows` when the brief matches one.
4. **Build.** Back to front. Load the specialist for each kind of work. Record each returned id in the ledger (`checklists/session-ledger.md`).
5. **Check.** `get_image` after each group of two to five changes and at the end; compare with the plan; fix with `undo`, `transform` or the paint tools.
6. **Deliver.** Load `files-and-export`. Save an editable `.fpth` beside any export unless told not to.

## Gate

The session is done when the ledger's final row has a `get_image` checked against the plan and every requested file path was reported by a tool.

## Hands back

The files written, one sentence describing the art, and anything not done with its reason.

## Owned resources

- `checklists/session-ledger.md` the running record of plan, ids and checks for one session.
