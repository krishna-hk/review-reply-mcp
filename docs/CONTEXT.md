# Project context: Review Reply MCP

Full hand-over of everything discussed and decided in the planning chat (Claude.ai, 21 Oct 2026). Read this first. Companion files: `docs/PRD.md` (deep-dive PRD), `docs/TOOLS.md`, `docs/HOSTING.md`, `README.md`, `site/index.html`.

## 1. Who and why

- **Owner:** Hari. Works at a study-abroad organization (counselor training), but explicitly said: **do not frame this project from a study-abroad angle.**
- **Goal:** portfolio project for **product roles**. Traction is a bonus: "if I launch this and there is at least some traction with people using my product it will be great." No fixed target market.
- **Working style:** wants to talk and align before decisions are final. **The PRD must not be edited until Hari says so.** The final PRD draft comes after alignment.

## 2. The product in one paragraph

An **MCP server** that takes a CSV of customer reviews (e.g. exported Google reviews) and lets the owner's AI app (Claude, ChatGPT, etc.) do the following through tools: tag each review with one or more themes plus sentiment, flag serious reviews (health, safety, legal threat, discrimination) for a human instead of drafting, build a digest from code-computed counts and exact quotes, draft tone-matched replies that follow owner policies, and track fixes and their impact. **The AI does reading and writing; code does counting, trends, quote extraction (exact substring copy from the original review), safety checks and storage.** No tool posts anywhere in v1.

## 3. How the idea evolved (conversation history)

1. Hari asked to learn MCP and what it takes to build an MCP product, with crazy project ideas for a product-role portfolio. Ideas were given with problem / solution / build time / complexity.
2. More ideas requested; study-abroad framing rejected.
3. Hari picked three to explore: **Agent firewall, Voice-of-customer radar, Local business reputation manager**. The reputation manager won.
4. Questions answered along the way:
   - Where do reviews come from? CSV export first (Google Takeout / Business Profile export / third-party exports), with a swappable source interface so APIs can come later. Google Business Profile API needs owner/manager of a verified listing plus Google approval (re-check).
   - What happens after the CSV? import, tag, digest, draft, approve, fix tracking.
   - Owner perspective: what an owner must do to use it.
   - Free by default: owners use their own AI subscription (**Mode A**). For those without one, Hari provides his own Claude API key with strict limits (**Mode B**). The API key and subscription discussion is **deferred**.
   - Market concern: small owners are not technical and often have no AI subscription. Resolved by reframing the launch audience to people who can use MCP (see section 5), demo mode, and a possible thin web page later.
   - Competitor keywords were given to search (review management / reputation management tools, AI review reply tools, etc.).
   - Chrome extension for Google Business Profile: **parked until after checkpoint 6.**
5. Hari asked for checkpoints/timeline, then a deep-dive PRD split into **Set 1 (resources from Hari)** and **Set 2 (what Claude builds and how)**, with per-checkpoint: what it covers, issues, fixes, resources and sources, help needed now.
6. Hari asked for **optional auto-reply/auto-post** without per-review approval. Plan: v1 bulk-approve of safe drafts; phase 2 opt-in auto-reply for low-risk reviews (earned by approving about 20 drafts, delay, daily cap, log, off switch). Needs Google Business Profile API access and stored OAuth.
7. Hari said there is no fixed market; portfolio first, traction second. PRD got a "launch audience" section.
8. Hari paused PRD edits: "first let's talk, align, then make the final draft."
9. Latest round (six items) produced the repo, README, TOOLS.md, HOSTING.md and the process page. See section 9.

## 4. Architecture and key decisions

- **MCP:** remote servers use Streamable HTTP; local use stdio. Spec 2026-07-28 is stateless; Roots, Sampling and Logging are deprecated; MCP Apps and Tasks promoted; stricter OAuth. **Do not rely on sampling.**
- **Client support (re-check at checkpoint 4):** Claude (Settings, Connectors, Add custom connector; `claude mcp add --transport http <name> <url>`); ChatGPT (Developer Mode, paid plans, public HTTPS only); consumer Gemini app has no custom connectors (Gemini CLI/Enterprise do); Perplexity and Le Chat on paid plans.
- **Untrusted input:** review text is untrusted (prompt-injection defence). Every tool is scoped to one owner.
- **Stack in the PRD:** Python 3.11+, official MCP Python SDK (FastMCP), SQLite, pytest; a fake AI stand-in for offline tests; evaluation script against an answer key (tuning set about 40 reviews, sealed test set about 20).
- **Stack under discussion:** Cloudflare Workers + D1 (TypeScript) vs Python on Render free + Turso. **Undecided; Hari must choose.** Choosing Cloudflare changes the PRD's Python choice.
- **Data model:** reviews (review_id, source, rating, text, review_date, language, optional author_name, existing_owner_reply), tags, escalations, drafts, business profile, fixes, usage/quotas, invites. Starter theme list of 10 plus "Other".
- **Mode B cost layers:** per-owner quota (e.g. 100 reviews / 30 drafts, to be measured), invite-only, Anthropic console hard limit, server cap, rate limits, kill switch, cheap model for tagging and stronger model for replies. A Claude.ai subscription does not provide API credits.
- **Provisional targets:** theme agreement at least 80%; escalation recall 100% on planted cases; quote exactness 100%; at least 60% of drafts sendable unedited; 0 forbidden promises; tool choice at least 13 of 15.
- **Sandbox note:** the cloud sandbox may not reach the Claude API, so prompts are tested with a stand-in and real-model measurement happens on Hari's key.

## 5. Launch audience and traction plan

Audiences: (1) marketers, freelancers, small agencies who use AI apps; (2) PMs, indie builders, AI enthusiasts; (3) small owners later. Default choice is 1 and 2. Demo mode via `load_demo_data`; launch kit; starting targets 20 to 30 tries, at least 5 returns, 1 to 3 weekly users, at least 3 feedback quotes.

## 6. The 14 tools (final list)

set_business_profile, get_business_profile, import_reviews, get_untagged_reviews (batches of 20), save_tags, get_digest, get_theme_reviews, get_review_for_reply, save_draft, review_drafts, record_fix, check_fix_impact, delete_my_data, load_demo_data. Full detail in `docs/TOOLS.md`. Each result includes next-step hints and remaining counts; saves are idempotent.

## 7. Checkpoints (from the PRD)

0 decisions; 1 sample data and answer key; 2 core engine; 3 prompts tested against the answer key; 4 MCP server running locally; 5 public hosting plus Mode B limits; 6 pilot, launch, case study. PRD chapters 7 to 13 detail each. The timeline assumes about 10 to 15 hours a week from Hari (Hari has an open comment on that assumption: 10 to 15 hours a week vs 8 weeks).

## 8. Hosting and database facts (verify at deploy time)

- SQLite is free and public domain; theoretical limit about 281 TB; real limit is the host. A review is about 1 KB, so 10,000 reviews is tens of MB.
- Render free has no persistent disk (plain SQLite file would be lost); pair with Turso. D1 free tier about 500 MB per database; Turso free about 5 GB. Cloudflare Workers + D1 is the strongest always-free, always-on option found.
- SOP page hosting: GitHub Pages (simplest), Cloudflare Pages, Netlify, Vercel.
- Prices and limits change often; verify on provider pages.

## 9. What exists now

Repo folder `review-reply-mcp/` (git initialised on `main`, two local commits, **not pushed**, no remote yet):

```
README.md             target market, modes, safety, roadmap
.env.example          placeholder settings only
.gitignore
docs/PRD.md           exported deep-dive PRD (18 chapters), snapshot of the Claude Docs artifact
docs/TOOLS.md         14 tools: purpose, workflow, when called, data needed
docs/HOSTING.md       hosting and SQLite notes
docs/CONTEXT.md       this file
site/index.html       process, tools and connect page (placeholder server URL)
src/ prompts/ tests/ scripts/ data/sample/   empty (.gitkeep)
```

The live PRD artifact: https://claude.ai/artifact/BRswaYfJHpaokTkGZd8nmR (source of truth until Hari approves changes; `docs/PRD.md` is a snapshot).

## 10. Open items (need Hari)

1. **Hosting base:** Cloudflare Workers + D1 (TypeScript, recommended) or Python on Render + Turso.
2. **GitHub repo:** create an empty repo, add as `origin`, push `main`.
3. Answers to PRD chapter 18's 12 open decisions; confirm launch audience (default 1 and 2).
4. The comment question: 10 to 15 hours a week vs 8 weeks.
5. API key and subscription conversation (deferred).
6. Web page for non-MCP users (decision 12) is open. Chrome extension is parked.

## 11. Rules for whoever builds next

- Do not edit `docs/PRD.md` or the live PRD until Hari approves; propose changes in chat first.
- No tool may post replies to any platform in v1.
- Never commit secrets or real reviews; sample data is synthetic.
- Label all pricing and limit claims "verify at deploy time".
- Commit small and often, push every commit once the remote exists.
- Plain, non-jargon explanations for Hari; he is not a developer by background (product roles target).

## 12. Decisions made after the planning chat (Claude Code, 22 to 23 Oct 2026)

- **Hosting:** Cloudflare Workers + D1 (TypeScript). This replaces the PRD's Python choice; PRD edit still awaiting Hari's approval. Repo: https://github.com/krishna-hk/review-reply-mcp
- **Sample data:** invented restaurant, English only, includes delivery-app reviews. 120 reviews in `data/sample/reviews.csv`; answer key for R001 to R060 in `data/sample/answer_key.csv` (R001 to R040 tuning, R041 to R060 sealed test). A Kaggle restaurant dataset was used locally only as a style reference and is not in the repo.
- **Themes:** the 10 starter themes plus Menu and dietary needs and Delivery and packaging, plus Other. Five umbrella groups for analytics (see `docs/ANALYTICS_AND_ESCALATION.md`).
- **Tagging rules:** one sentiment per theme per review, positive or negative only, no neutral; see `docs/LABELLING_GUIDE.md`.
- **Rating-only reviews** are kept and replied to; rows with no rating and no text are ignored.
- **Injection attempts and spam:** tagged Other, negative, no reply, never automatic.
- **Serious reviews and legal threats:** one restricted holding draft, owner approval only, never bulk, 12-hour target shown in the digest.
- **Repeated-phrase alerts:** not in v1.
- **PRD updated (Revision 2, 23 Oct 2026) with Hari's approval:** TypeScript stack, two new themes, English only, rating-only replies, restricted lane, spam handling. The live Claude Docs PRD artifact has not been updated; `docs/PRD.md` is now the newer copy. Further PRD edits still need Hari's approval.
- **Still to do:** Hari labels 30 reviews blind; checkpoint 2 core engine.

## 13. Status after checkpoint 4 (27 Oct 2026)

- Checkpoints 0 to 4 are done: sample data and key, core engine, tested AI instructions (tagging 88.9% on a sealed 20, 96.7% on a fresh 20, serious-review recall 100%), and a working local MCP server connected to Hari's Claude desktop app. See `docs/CHECKPOINT3_RESULTS.md` and `docs/CHECKPOINT4_RESULTS.md`.
- Gemini free tier allows about 20 requests a day per model, so tests used Claude sub-agents instead of an API run. A Claude API key has not been created.
- Next: checkpoint 5 (public hosting on Cloudflare Workers + D1, remote MCP over Streamable HTTP, Mode B limits). Needs a free Cloudflare account from Hari. Then checkpoint 6, pilot.
- Standing rule found in testing: wording rules the AI must follow belong in code checks, not only in instructions.
