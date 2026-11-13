# Terminal

The window has a terminal dock at its foot: shell tabs, Claude Code tabs and a Chat tab, with an ask bar below them, as in formvis and formlit. The engine owns every process; the window draws output and sends keys. Window > Terminal (Alt+Shift+Mod+T), Window > New Terminal, Window > Claude Code (Alt+Shift+Mod+C) and Window > Chat with Claude (Alt+Shift+Mod+H) open it, and so do the Claude Code and Terminal buttons in the title bar, which light while the dock shows that kind of tab and hide it when clicked again.

| Source path | What lives there |
| --- | --- |
| `backend/app/services/terminal.py` | PTY sessions: `ptyprocess` on macOS and Linux, `pywinpty` (ConPTY) on Windows; a 256 KiB scrollback per session; resize, restart and close; every child gets `FORMPATH_TERMINAL=1` and the engine's address (`FORMPATH_ENGINE_URL`, `FORMPATH_MCP_URL`) |
| `backend/app/routers/terminal.py` | `/api/terminal`: list, open, resize, write, read, restart and close, and a WebSocket at `/api/terminal/{id}/stream` (text frames are output, binary frames are control messages). `origin_ok` refuses any Host that is not a loopback name and any Origin that is not a configured CORS origin, a loopback or Tauri one, because WebSockets are not covered by CORS |
| `backend/app/services/claude_code.py`, `routers/claude_code.py` | Finds `claude` (`FORMPATH_CLAUDE_BIN`, the path, then the login shell) and reports whether it is installed; a Claude Code tab runs it with formpath's own `/mcp` attached (`--mcp-config`, `--allowedTools mcp__formpath`) and an in-app token that lives only in the tab's environment, in the folder chosen in Preferences > Agents; the Chat tab runs it in stream-JSON mode and streams its messages on `/api/claude/chat/stream` |
| `frontend/src/ui/terminal-dock.ts` | The dock: xterm.js 6 with the fit addon, a tab per session (the `terminal` icon for a shell, the `agent` icon for Claude Code, the Chat tab first with `agentChat`), the head buttons New Terminal, Chat, Claude Code, Restart and Hide, the ask bar (it sends the document name and the selected node ids with the prompt), a grip to resize; `onTab` tells the title bar which kind of tab is showing |
| `frontend/src/ui/titlebar-tools.ts` | The Claude Code and Terminal buttons (`syncDock` lights them) |
| `frontend/src/ui/chat-pane.ts` | The Chat tab: status, usage, messages, tool chips, Stop, From Claude Code..., Open in Claude Code (the conversation continues in a terminal tab with `--resume`) and New Chat |
| `frontend/src/styles/terminal.css`, `frontend/index.html` | Layout, and the boot script that writes `data-ft-dock` and `data-ft-dock-h` on the root element from `formpath.terminal` before first paint, so a dock left open opens in place without moving anything |

## Rules

- Process control belongs to the engine or the Tauri shell, never to page code; the page reaches the engine only through `frontend/src/io/api.ts`.
- A terminal is remote code execution, so every route and socket passes `origin_ok`, and the terminal, Claude Code and chat commands are window-only: `run_command` refuses them to agents (`WINDOW_ONLY` in `frontend/src/automation/catalogue.ts`).
- Claude Code is the person's own install: formpath never bundles it and never reads or stores a credential.
- Terminal output is appended to xterm's own nodes, never rebuilt, and xterm's scrollbar elements are hidden by `terminal.css`.
- Every child ends when its tab closes or the engine exits.
