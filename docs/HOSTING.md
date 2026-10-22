# Hosting and storage notes

Prices, limits and free tiers change often. Everything below is from research done in October 2026 and must be **verified on the provider's page before deploying**.

## SQLite

- SQLite is free and public domain. There is no licence cost.
- It is a file-based database. The theoretical size limit is about 281 TB; the real limit is the disk or the provider's cap.
- For this project the data is small: a review is around 1 KB, so 10,000 reviews is on the order of 10 to 20 MB with tags and drafts.
- The catch is **where the file lives**. Hosts with no persistent disk (for example free web-service tiers that reset their disk) lose a plain SQLite file on restart. So either use a host with a persistent volume, or use a hosted SQLite service.

## Hosted SQLite-compatible options

| Option | Notes (verify) |
| --- | --- |
| Cloudflare D1 | SQLite-compatible, works with Workers; free tier has a per-database size cap and daily read/write limits |
| Turso | Hosted SQLite (libSQL); free tier with a storage cap |
| Local file on a persistent volume | Works on hosts that offer a volume, often paid |

## Where the MCP server can run

| Option | Language fit | Always on? | Notes (verify) |
| --- | --- | --- | --- |
| Cloudflare Workers + D1 | TypeScript | Yes | Strongest free, always-on fit; remote MCP supported |
| Render free web service | Python or Node | Sleeps when idle; slow first request | No persistent disk on free tier; pair with Turso |
| Fly.io | Python or Node | Yes with a small machine | Usually needs a card; volumes available |
| Railway | Python or Node | Yes | Trial credit, then paid |
| Small VPS | Anything | Yes | Paid, most control |
| Your own laptop + tunnel | Anything | Only while on | Fine for demos only |

## Where the process page can run

The page in `site/` is one static HTML file. Free options: GitHub Pages, Cloudflare Pages, Netlify, Vercel. GitHub Pages is the simplest because the page lives in the same repository.

## Decision pending

The recommended base is Cloudflare Workers + D1 (TypeScript). The alternative is Python on Render + Turso. See the project discussion; the choice affects the language in the product requirements.
