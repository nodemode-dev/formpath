# Security policy

## Supported versions

Security fixes go into the newest release. Please update before reporting, and
check whether the problem is still there.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Anything older | No |

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Use GitHub's private
reporting instead: on the repository's **Security** tab, choose **Report a
vulnerability**. Include what you found, the steps to reproduce it, the version and
platform, and what an attacker could do with it.

You can expect an acknowledgement within a week. We will keep you informed while it
is fixed and credit you in the release notes, unless you would rather not be named.

## What counts

FormPath runs on your own machine, so the things that matter most are the ways
something outside it could get in:

- **The engine** listens on loopback (port 8230 in development, a free loopback
  port in the desktop app). Anything that makes it reachable from another machine,
  or lets a web page on another origin drive it or the window's side of the agent
  bridge.
- **Agents and the MCP server**: an agent changing anything before the person has
  allowed it. FormPath asks in its window before an outside agent changes anything;
  the choices are Ask each time, Allowed and Blocked (Preferences > Plugins, Outside
  agents), and only the FormPath window can change the choice or answer a question.
  The saved choice is sealed: changed outside FormPath, it reads as Ask again. The
  command line is an outside agent like any other. Anything that changes the choice,
  answers for the person or acts while the choice is Blocked counts.
- **The terminal dock and Chat**: anything other than FormPath's own window on this
  computer reaching a shell or Claude Code through them. The window holds a key
  from the engine; the terminal, Claude Code and chat routes and sockets are
  refused without it, and their commands are refused to agents.
- **Plugins**: a plugin reaching the window's key, files or the engine beyond the
  tools FormPath gives it.
- **Keys** kept by the engine for the assistant's language model (in the system
  keyring): anything that leaks them.
- **Files**: opening a project, a package or any other file in a way that writes
  outside where it should or runs something, or an export for an agent landing
  anywhere but the path that agent named.

Bugs that need someone to already control your machine, or to run a modified build
of FormPath, are ordinary bugs: please open an issue for those.
