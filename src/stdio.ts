// Local entry point: runs the server over stdio so an AI app on this computer can connect to it.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { openDb } from "./store/db.js";
import { Store } from "./store/store.js";

const dbPath = resolve(process.env.REVIEW_REPLY_DB ?? "data/private/local.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDb(dbPath);
const store = new Store(db, "local");
const server = createServer({
  store,
  now: () => new Date().toISOString(),
  maxRowsPerImport: Number(process.env.MAX_ROWS_PER_IMPORT ?? 200),
  maxReviewsPerOwner: Number(process.env.MAX_REVIEWS_PER_OWNER ?? 2000),
});
await server.connect(new StdioServerTransport());
// Logs go to stderr only; stdout is the protocol channel.
console.error(`review-reply MCP server running (data: ${dbPath})`);
