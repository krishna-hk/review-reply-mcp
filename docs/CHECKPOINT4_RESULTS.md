# Checkpoint 4 results: MCP server working locally (27 Oct 2026)

What exists: a local MCP server (`src/server.ts`, run with `src/stdio.ts`) with the 14 tools from `docs/TOOLS.md`, a "weekly_review" prompt, and an owner-scoped SQLite store. Set-up steps for the Claude desktop app are in `docs/CONNECT_CLAUDE_DESKTOP.md`.

| Check | Result |
| --- | --- |
| Automated tests (flow, isolation, lanes, limits, deletion, fixes) | 72 passing |
| Real stdio start-up from another folder, client lists 14 tools | Passed |
| Tool choice, 15 plain requests, Claude sub-agent (target at least 13) | 15 of 15 (requests written by the builder, so a first check) |
| Real run in the Claude desktop app on the demo data (Hari, 27 Oct 2026) | Loaded, tagged all 40, digest correct, 4 serious reviews listed first, spam and injection ignored, nothing posted |

## What the real run found and what changed

| Finding | Change |
| --- | --- |
| The digest covered only 11 of 40 demo reviews because the default 90-day window was thin | Digest widens to all reviews when the last 90 days have under 20, and says so |
| Claude said it had not drafted the serious reviews | Digest and weekly prompt now tell Claude to offer one holding draft for each (owner approves) |
| Twelve praise replies ended with the same sentence | Drafting instructions ask for varied wording |
| 2 to 3 star replies missed the invitation to email | Instructions require it; server warns when missing |
| Redrafts ignored wording rules ("feeling this way", no mention of illness) because instructions are advice and the AI may not re-read them | Those two rules are now code checks that block the draft; verified live: Claude's first R015 attempt was rejected and its rewrite acknowledged that they were unwell |

## Not covered yet

- ChatGPT and other apps need the public server (checkpoint 5) and re-checking of client support.
- No real exported CSV has been imported yet.
- The tool descriptions have only been tested by a sub-agent and one Claude desktop session.
