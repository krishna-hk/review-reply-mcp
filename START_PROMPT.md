Paste everything below the line into Claude Code, run from inside this folder.

---

You are continuing a project that was planned in a long Claude.ai chat. This folder is the project repo. Before doing anything:

1. Read `docs/CONTEXT.md` fully. It is the hand-over of the whole planning conversation: goal, decisions, open items and rules.
2. Skim `docs/PRD.md` (the deep-dive product requirements), `docs/TOOLS.md` (the 14 MCP tools), `docs/HOSTING.md`, `README.md` and `site/index.html`.
3. Run `git log --oneline` and `git status` to see the state.

Then tell me, in under 150 words, what the project is, what exists, and what is undecided. Do not start building yet.

Key facts to hold on to:
- I am Hari, building this as a portfolio project for product roles. Traction is a bonus. Do not frame it around study abroad.
- Product: an MCP server that tags themes in customer reviews from a CSV, flags serious ones, builds a digest from code-computed counts and exact quotes, drafts replies that follow owner policies, and tracks fixes. The AI reads and writes; code counts, checks and stores. No tool posts anywhere in v1.
- Open decisions I still owe you: hosting base (Cloudflare Workers + D1 in TypeScript, recommended, or Python on Render + Turso) and the GitHub repo. Ask me for these first. Do not edit `docs/PRD.md` until I approve changes; propose changes to me in chat.
- I am not a developer. Explain choices in plain words, give short options with a recommendation, and ask me one decision at a time.

Working rules: small commits, push each commit once a remote exists, no secrets or real reviews in the repo, label pricing and limits "verify at deploy time", and follow the checkpoint order in the PRD (0 decisions, 1 sample data and answer key, 2 core engine, 3 prompts, 4 local MCP server, 5 hosting and Mode B limits, 6 pilot).

After your summary, ask me for the hosting choice and the GitHub repo URL, then propose the first concrete step for checkpoint 1.
