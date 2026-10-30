# The hosted server

Live at `https://review-reply-mcp.hk-reviews-mcp.workers.dev` (Cloudflare Workers with a D1 database, free plan; verify limits at deploy time). The front page shows one line of text. Everything else needs a personal link.

## How people connect

Each tester gets a personal link of the form `https://review-reply-mcp.hk-reviews-mcp.workers.dev/mcp/<secret>`. The link is the key: anyone who has it can use that tester's data, so send it privately and tell them not to post it. Only a hash of the secret is stored on the server.

**Claude (web or desktop app):** Settings, Connectors, Add custom connector. Name it "Review Reply", paste the link as the URL, leave any sign-in fields empty. Menu names change; check them in the app. In a new chat: "Load the app demo data, then run my weekly review check." (Say "restaurant demo" for the restaurant one.)

**Tested 29 Oct 2026 in Claude on the web:** the connector connected with "No sign-in", showed all 15 tools, and a new chat loaded the app demo, tagged 60 reviews in 3 batches, found the 5 serious ones, built the digest and saved 7 drafts. Claude asks permission for each tool call (Allow once). If Connect says "404" or "asked for sign-in", the link was probably mistyped: paste it, do not type it.

**ChatGPT:** tested 30 Oct 2026 on a ChatGPT Go account (no Developer Mode switch was needed). Path: Plugins, Add, Add custom MCP server; name it, paste the link, choose No authentication, tick the risk box, Create, then Connect. In a new chat start with @Review Reply. It loaded the app demo, tagged 60 reviews, found the 5 serious ones, built the digest and saved 2 drafts without approving. Plan names and menus change, so check them in the app. Without a hint, ChatGPT picked a 7-day digest window; the weekly prompt now says to keep the default 90 days.

Each person's data is separate. "Delete all my data" in the chat wipes their reviews and keeps their link working.

## Limits (set in `src/worker.ts`)

- 120 requests per minute per link, 1 MB per request, 200 rows per import, 2,000 reviews per person.
- Cloudflare's free plan has its own daily request and database limits. Verify them on Cloudflare's pages before inviting many people.

## Admin (Hari only)

The admin password is saved in `data/private/admin-token.txt` on Hari's Mac and as a secret on the server. Never paste it into a chat.

Create a link (prints it once):

```bash
curl -s -X POST https://review-reply-mcp.hk-reviews-mcp.workers.dev/admin/invites -H "authorization: Bearer $(cat data/private/admin-token.txt)" -H "content-type: application/json" -d '{"label":"name of tester"}'
```

List links (no secrets shown):

```bash
curl -s https://review-reply-mcp.hk-reviews-mcp.workers.dev/admin/invites -H "authorization: Bearer $(cat data/private/admin-token.txt)"
```

Switch a link off (use the owner_id from the list):

```bash
curl -s -X DELETE https://review-reply-mcp.hk-reviews-mcp.workers.dev/admin/invites/OWNER_ID -H "authorization: Bearer $(cat data/private/admin-token.txt)"
```

## Updating the server

```bash
npm test && npx wrangler deploy
```

New database changes go in `src/db/migrations/` and are applied with `npx wrangler d1 migrations apply review-reply --remote`.

## Not built (by decision)

No hosted AI (Mode B): testers use their own Claude or ChatGPT subscription. No sign-in system: personal links are enough for a small pilot.
