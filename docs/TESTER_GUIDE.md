# Review Reply: tester guide (one page)

Thank you for trying this. It takes about 30 minutes. Please read the privacy statement first (docs/PRIVACY.md, Hari will send it with your link).

**What it does:** you give your own AI (Claude or ChatGPT) a CSV of customer feedback. It tags themes, flags serious items for a human, builds a summary from counts and exact quotes, and drafts replies you approve. It never posts anything.

**You need:** a Claude or ChatGPT account (a paid plan may be needed for custom connectors; check your app), and a feedback export as CSV with a text column (and ideally rating and date). Remove names, emails and phone numbers if you can.

## Connect (about 5 minutes)
Your personal link looks like `https://review-reply-mcp.hk-reviews-mcp.workers.dev/mcp/<secret>`. Keep it private; anyone with it can open your data. Always paste it, never type it.
- **Claude:** Customize, Connectors, Add custom connector. Name: Review Reply. Paste the link. Leave sign-in off (No sign-in). Add, then Connect.
- **ChatGPT:** Plugins, Add, Add custom MCP server. Name it, paste the link, choose No authentication, tick the risk box, Create, Connect. Start chats with @Review Reply.
Menu names change; follow what you see. Your AI will ask permission for each tool; "Allow once" is fine.

## Try it (about 20 minutes)
1. "Using Review Reply, load the app demo data, then run my weekly review check." (Practice run, invented reviews.)
2. When happy: "Delete all my data", then paste your own CSV: "Import these reviews and run my weekly review check." The AI proposes a theme list; say yes or change it.
3. Ask: "Which reviews need me personally?" and "Draft replies for the worst three. Do not approve anything."

## Tell Hari afterwards (10 minutes)
- Did the themes match how you would label your feedback? Which were wrong?
- Was the summary useful or something you already knew?
- Anything that confused you or broke?
- Would you use it again? May Hari quote you (names removed)?

## When you are done
Say "Delete all my data" in the chat, or ask Hari to switch off your link.
