# Branching and release model

- **main** is always releasable. CI (`.github/workflows/ci.yml`) must pass before anything lands. No force-push to main.
- **Work branches** are short-lived and named by intent: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`. Rebase on main before merging.
- **Commits** follow Conventional Commits with the version in the summary, for example `fix(frontend): keep dialog focus inside the scrim (0.9.1)`. The commit identity is `nodemode-ai <mackin@nodemode.ai>`.
- **Versions** are `v*.*.*` with dots, everywhere: `frontend/package.json`, `frontend/src/version.ts`, `backend/app/__init__.py`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, the README badge and the deliverable zip names. Bump all of them in the same commit.
- **Releases.** formpath builds nothing in this repository. After the version bump lands on main, push a branch `compile_vX.Y.Z` cut from that commit. CI runs on it, and formcompiler (`nodemode-ai/formcompiler`) picks it up on its next 8-hourly watch run, or at once when its watch is run by hand. It builds macOS, Linux and Windows bundles and opens a draft release `formpath-vX.Y.Z` on formcompiler's release page. Review the draft, then publish it there. Compile branches are kept as the record of what was built.
- **Wiki.** Edit pages in `.docs/wiki/`, never in the GitHub wiki UI. `.github/workflows/wiki.yml` publishes the folder when it changes on main. The wiki must have one page created by hand once before the first publish.
