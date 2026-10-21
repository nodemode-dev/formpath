# Getting Started

Requirements: Node 20.19 or newer (22 recommended), Python 3.12 or newer, git. The desktop build also needs Rust stable and the Tauri 2 system packages for your OS.

## macOS and Linux

```bash
git clone git@github.com:nodemode-ai/formpath.git
cd formpath
./formpath install
./formpath boot
```

## Windows

```bat
git clone git@github.com:nodemode-ai/formpath.git
cd formpath
formpath.bat install
formpath.bat boot
```

Open http://localhost:5230. The engine listens on http://127.0.0.1:8230; `./formpath serve` serves the built app from the engine alone.

## Commands

`./formpath help` lists them: `boot`, `install`, `install-desktop`, `backend`, `frontend`, `build`, `serve`, `freeze`, `desktop dev|build`, `doctor`, `check`, `counts`, `mcp`, `agents install|sync`, `clean`.

`./formpath doctor` checks Node, Python, Rust, the installs and the ports when something does not start.
