# Review Reply MCP

> Turn a pile of customer reviews into themes, a plain-language digest and reply drafts you approve, from inside the AI app you already use.

**Status: planning.** Nothing is live yet. This repository holds the plan, the tool specification and the build as it happens. Working name; it may change.

---

## Who this is for

This is built for people with **a bit of technical know-how** who deal with customer reviews and already use an AI app such as Claude or ChatGPT.

**Primary audience**

- **Marketing freelancers and small agencies** who manage Google reviews for several local clients and want one repeatable routine instead of copy-pasting into a chat window each time.
- **Owners and their "helpers"** (a manager, a relative, an assistant) who are comfortable exporting a CSV and pasting a connector link into an AI app.
- **Product managers, indie builders and AI-curious people** who want a real, small MCP tool to try, learn from, or build on, and who will tell us what is confusing.

**Not for, yet**

- Owners who do not use any AI app. A simple web page and a browser extension are planned for later, but they are not part of version 1.
- Large chains and enterprises that need integrations, single sign-on or audit contracts.
- Anyone who wants replies posted automatically. Version 1 never posts anything. An optional, opt-in auto-reply for low-risk reviews is on the roadmap, not in the first release.

**What you need**

- An AI app that accepts custom MCP connectors (see "Compatibility" below).
- Your reviews as a CSV file, or use the built-in demo reviews.
- About ten minutes for first setup.

## What it does

1. **Tags every review** with one or more themes (wait time, staff attitude, price and so on) and whether each is positive or negative.
2. **Flags serious reviews** (health, safety, legal threats, discrimination) for a human instead of drafting a casual reply.
3. **Writes a digest**: top praise, top complaints, what is rising, what is new, with exact quotes from real reviews.
4. **Drafts replies** in your tone and within your policies. You approve each one and post it yourself.
5. **Tracks fixes**: log a change you made, and later see whether mentions of that problem dropped.

## How it works

The AI app does the reading and writing. Our server does the counting, checking and storing.

1. You connect the server to your AI app with one link.
2. You tell the AI, in plain words, "analyse my new reviews and draft replies."
3. The AI calls the server's tools in a loop: fetch a batch of reviews, save the themes it found, ask for the digest, fetch one review with your tone and policies, save a draft.
4. You read the drafts, approve or edit them, and post them yourself.

Plain code, not the AI, does all counting and trend maths, and copies every quote word for word from the original review.

## Two ways to run it

| | Mode A: your own AI app | Mode B: hosted AI, by invite |
| --- | --- | --- |
| Who does the reading and writing | The AI app you already pay for | Our server, calling Claude on our key |
| Cost to you | Nothing extra beyond your AI plan | Free within a small quota |
| Limits | None from us | Per-person quota, spending cap, rate limits |
| Access | Personal connection link | Personal connection link plus a quota |

Mode B is added after the core works. Both modes use the same prompts and the same tools.

## Safety by design

- **No tool posts a reply anywhere.** The server has no posting capability in version 1.
- **Every reply is a draft** a human approves.
- **Serious reviews are escalated**, not drafted.
- **No promises.** Drafts are checked in code for refund promises, admissions of fault and other risky wording, using each owner's policy.
- **Quotes are exact.** Code copies quotes from the original review. The AI never retypes them.
- **Review text is treated as untrusted.** A review that says "ignore your instructions" is just text to analyse.

## Privacy

- We store only what the features need: review text, rating, date, language, and optional author name.
- Each person's data is kept separate from everyone else's.
- You can delete all your data with one tool.
- We never sell or share review data.
- Usage tracking records counts only, not review text.

## Compatibility

Support for custom connectors changes often, so check each app's current settings. As of the research behind this plan (July to October 2026):

- **Claude** (web, desktop, Claude Code): add a custom connector in Settings, or use `claude mcp add --transport http`.
- **ChatGPT**: custom connectors through Developer Mode on paid plans, public HTTPS servers only.
- **Gemini**: the consumer app has no custom-connector option. Gemini CLI and Gemini Enterprise do.
- **Others** (Perplexity, Mistral Le Chat, Cursor, VS Code): varies by plan.

## Quick start (once the server is live)

1. Ask for an invite. You receive a personal connection link. Treat it like a password.
2. Add the link as a custom connector in your AI app.
3. Say: "Load the demo reviews and show me the digest."
4. When you are ready, import your own CSV and run the same flow.

The step-by-step process page is in [`site/index.html`](site/index.html).

## Repository layout

```
review-reply-mcp/
  README.md
  .env.example         # names of settings only; never commit real values
  docs/
    TOOLS.md           # every tool: purpose, when it is called, inputs, workflow
    HOSTING.md         # where it runs, free-tier facts, SQLite limits
  site/
    index.html         # the process and connect page (static, self-contained)
  src/                 # the server code
  prompts/             # tagging, escalation, reply and digest instructions
  tests/               # automated tests and the evaluation script
  data/sample/         # synthetic sample reviews and the answer key
  scripts/             # admin and deployment helpers
```

## Roadmap

| Step | What | Status |
| --- | --- | --- |
| 0 | Decisions and product requirements | In progress |
| 1 | Sample reviews and answer key | Not started |
| 2 | Core engine (import, counts, trends) | Not started |
| 3 | AI prompts, tested against the answer key | Not started |
| 4 | MCP server working locally | Not started |
| 5 | Public hosting and Mode B limits | Not started |
| 6 | Pilot, launch and case study | Not started |

Later, only if the core works well: an opt-in auto-reply for low-risk reviews, a very small web page for people who do not use MCP, and a browser extension.

## Working with this repository

- Work happens on `main` while it is a solo build. Each meaningful change is one commit with a message that says what changed and why, and every commit is pushed.
- No secrets in the repository. Real keys live only in the host's secret settings or a local `.env` file that is ignored by git.
- Sample data is synthetic. Real reviews are never committed.

## Disclaimer

Drafts are suggestions. The owner is responsible for anything they post. This project is independent and is not affiliated with or endorsed by Google, Yelp, Anthropic, OpenAI or any review platform.

## License

To be decided before the first public release.
