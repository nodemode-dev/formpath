# Contributing to FormPath

Thank you for helping. FormPath aims to be a free vector illustration editor that runs
in a browser or on the desktop and keeps your artwork on your own computer, and it gets
there through real use and real contributions.

## Where to start

- **Use it and report what goes wrong.** A clear bug report, with steps, the version
  and your platform, is one of the most useful things you can give. For a file that
  opens wrongly, attach the file if you can.
- **Look at the open issues.** Comment on one before starting larger work, so nobody
  builds the same thing twice.
- **Translations** are welcome: FormPath ships in 26 interface languages, with the
  tables in `frontend/src/i18n`, and `./formpath i18n check` says whether every
  language is complete.

## Setting up

Clone the repository and run `./formpath install`, then `./formpath boot` (or
`formpath.bat install` and `formpath.bat boot` on Windows). The first installs what the
engine and the interface need; the second starts both. `./formpath help` lists every
command, and the README's "Run it from source" section has the details and the requirements.

The code lives in:

| Folder | What is there |
| --- | --- |
| `backend/app` | the engine service (Python, FastAPI): projects, fonts, file import and export, MCP |
| `frontend/src` | the interface (TypeScript, Vite): the document engine, tools, file formats and UI |
| `src-tauri` | the desktop shell (Rust, Tauri) |
| `setup` | install, build, packaging and agent scripts |
| `backend/tests`, `frontend/tests` | the engine tests, the document engine tests and the window smoke test |
| `.docs/wiki` | the wiki's source, published on push |
| `docs` | the manual and the parity table |

## Before you open a pull request

`./formpath check` runs the typecheck, the build and the engine's self-check in one go.
CI runs these, and all of them must pass:

```sh
(cd frontend && npm ci && npm audit --audit-level=low && npm test && npm run build)
python -m compileall -q backend/app backend/formpath_engine.py
(cd backend && python formpath_engine.py --selfcheck)
(cd backend && python -m pytest tests -q -p no:cacheprovider)
python -m pytest frontend/tests/window -q -p no:cacheprovider
python3 setup/agents.py sync --check
python3 setup/mcpb.py check
python3 -B setup/icon_rules.py
```

The engine tests need `backend/requirements.txt` and `backend/requirements-test.txt`;
the window smoke test needs the built window and Playwright's Chromium. CI also checks
the shell scripts with `bash -n` and refuses an em dash in tracked Markdown or an
emoji in any tracked text.

- Keep each pull request to one change, and say in it how you checked the change.
  The test suites follow a plan the maintainers keep, so describe the test you would
  add and a maintainer will say whether it goes in.
- Write commit subjects the way the history does, in Conventional Commits:
  `feat(frontend): ...`, `fix(backend): ...`, `docs(...)` (see
  [.docs/BRANCHING.md](.docs/BRANCHING.md)). Leave the version alone; a maintainer
  bumps it when releasing.
- Interface text goes through the translation tables, and a new or renamed English
  sentence gets its translation in every language; `./formpath i18n check` says
  whether each language is complete.
- After changing the MCP tools or adding or renaming commands, run
  `./formpath agents sync`; `./formpath agents sync --check` fails while the skills
  drift.
- `./formpath counts --check` keeps the README's sizes honest, and fails on the
  banned sparkle icon.
- The files in `frontend/src/dock` are shared with the other apps of the family and
  are copied in whole. Do not edit them here; `./formpath agents sync --check` fails
  when one differs from its listed checksum.
- Every new dependency, font or data file gets a row in `NOTICE.md` before it is
  used.
- Other vendors' product names appear only to name a file format or compatibility.
  Never copy vendor help text, icons, brushes, symbols, presets or swatch libraries.

## Maintainers

FormPath is maintained by:

- the [nodemode-dev](https://github.com/nodemode-dev) organisation on GitHub
- [@nodemode-ai](https://github.com/nodemode-ai)
- [@gbarnai](https://github.com/gbarnai)

Reach them through issues and pull requests.

## How changes land

Only a maintainer pushes to `main`. Everyone else forks the repository and opens a pull
request into `main`. A pull request merges when every CI check passes and a maintainer
has approved it.

## Releases

A release is a version, and only a maintainer makes one: after the version is bumped on
`main`, a maintainer cuts a `compile_vX.Y.Z` branch, and formcompiler
(`nodemode-dev/formcompiler`) builds every platform and publishes them together. No
push from a contributor starts a release. See [.docs/BRANCHING.md](.docs/BRANCHING.md)
and the Releasing page of the wiki.

## Licensing

FormPath is licensed under the Apache License, Version 2.0 ([LICENSE](LICENSE), SPDX
`Apache-2.0`). By contributing, you agree that your contribution is licensed under
the same terms. Only add code you have the right to contribute, and name any
third-party code and its licence in the pull request.

## Patents and other people's IP

Some features are deliberately not built, or were changed, because they come too close
to someone else's patent, trademark, copyright or design. The maintainers hold that
line with counsel; contributors do not decide it, and nobody here redesigns a feature
on their own reading of a patent. This is engineering diligence, not legal advice.

### Features this project will not implement

- A Shaper or Shape Crafter operation inferred from where or how a stroke lands. The
  operation (merge, punch, delete or erase) always comes from the mode or the key the
  person holds, or from the `operation` argument of the agent tools. A stroke only
  picks which regions or shapes are affected; when the chosen operation does not fit
  what was touched, nothing happens and FormPath says so.
- A Trace Image mode that traces between two clicked points on an image.
- Changes to how the live, re-tracing Trace Image object works. It stays as it is.

A pull request that adds one of these, under any name, through any dependency,
plug-in, agent tool or plain code, is closed with a link to this section. Lifting a
decline needs the maintainers' written decision after a review, recorded here first.

### Rules for every contribution

- Patents: do not add a feature, or a dependency that provides one, that reproduces a
  method you know to be patented. If you are unsure, open an issue that describes what
  the feature does, not which patent it resembles. Patent numbers stay out of code,
  commits, comments, logs and changelogs.
- Trademarks: other vendors' product and feature names appear only to name a file
  format or compatibility (`.ai`, `.eps`) and in `docs/PARITY.md`. No command, menu,
  panel, tool, preset or agent tool takes another product's feature name, and no text
  says "like X" or "the way X does it". Describe what the feature does. Translations
  follow FormPath's own English, never another product's localized menu names.
- Copyright: never copy another product's help, tooltip, dialog or documentation text
  (link to it instead); never trace or import vendor icons or interface art; never
  bundle vendor presets, brushes, symbols, swatch libraries, sample files or fonts.
- Icons: the three-star sparkle icon is not used anywhere, in any form.
  `./formpath check` fails if it returns.
- Licences: every new dependency, font or data file gets a row in `NOTICE.md` before
  it is used. GPL stays outside the distributed bundle, AGPL nowhere, LGPL dynamically
  linked and replaceable, MPL files unedited. CC BY credited, CC BY-SA only
  unmodified, CC NC and ND never.
- Notices: the trademark notice in `README.md` and `NOTICE.md` stays.

## Conduct

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Security
problems go through [SECURITY.md](SECURITY.md), never a public issue.
