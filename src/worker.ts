// Hosted entry point for Cloudflare Workers. Each person gets a private link: /mcp/<secret>.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";
import { sha256 } from "./engine/importer.js";
import { D1Db, type SqlDb } from "./store/sql.js";
import { Store } from "./store/store.js";

export interface Env {
  DB: ConstructorParameters<typeof D1Db>[0];
  ADMIN_TOKEN: string;
}

export interface AppDeps {
  db: SqlDb;
  adminToken: string;
  now?: () => string;
  maxBodyBytes?: number;
  requestsPerMinute?: number;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json" } });
const randomToken = (bytes: number) => {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/** Compares two strings in the same time however much of them matches. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function handleRequest(req: Request, deps: AppDeps): Promise<Response> {
  const now = deps.now ?? (() => new Date().toISOString());
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length === 0) return new Response("Review Reply MCP server. Connect with the personal link you were given.", { headers: { "content-type": "text/plain" } });

  // ---- admin: create and revoke invite links
  if (parts[0] === "admin") {
    const auth = req.headers.get("authorization") ?? "";
    if (!deps.adminToken || !safeEqual(auth, `Bearer ${deps.adminToken}`)) return json({ error: "not allowed" }, 401);
    if (parts[1] === "invites" && req.method === "POST" && parts.length === 2) {
      const body = (await req.json().catch(() => ({}))) as { label?: string };
      const token = randomToken(24);
      const owner = `o_${randomToken(6)}`;
      await deps.db.batch([
        { sql: "INSERT INTO owners (owner_id, created_at) VALUES (?, ?)", params: [owner, now()] },
        { sql: "INSERT INTO invites (token_hash, owner_id, label, created_at) VALUES (?, ?, ?, ?)", params: [await sha256(token), owner, body.label ?? null, now()] },
      ]);
      return json({ owner_id: owner, connect_url: `${url.origin}/mcp/${token}`, note: "Show this link once. Anyone with it can use this owner's data. Only its hash is stored." }, 201);
    }
    if (parts[1] === "invites" && parts[2] && req.method === "DELETE") {
      const r = await deps.db.run("UPDATE invites SET revoked_at = ? WHERE owner_id = ? AND revoked_at IS NULL", [now(), parts[2]]);
      return json({ revoked: r.changes });
    }
    if (parts[1] === "invites" && req.method === "GET") {
      const rows = await deps.db.all("SELECT owner_id, label, created_at, revoked_at FROM invites ORDER BY created_at");
      return json({ invites: rows });
    }
    return json({ error: "not found" }, 404);
  }

  // ---- the MCP endpoint
  if (parts[0] === "mcp" && parts.length === 2) {
    const token = parts[1]!;
    const row = (await deps.db.all("SELECT owner_id FROM invites WHERE token_hash = ? AND revoked_at IS NULL", [await sha256(token)]))[0];
    if (!row) return json({ error: "not found" }, 404); // same answer for a wrong or revoked link
    const owner = String(row.owner_id);

    if (req.method !== "POST") return json({ error: "Use POST. This server keeps no sessions." }, 405);
    const max = deps.maxBodyBytes ?? 1_000_000;
    if (Number(req.headers.get("content-length") ?? 0) > max) return json({ error: `Request is larger than ${max} bytes. Import fewer rows at a time.` }, 413);

    const minute = now().slice(0, 16);
    await deps.db.run("INSERT INTO rate_limits (owner_id, minute, n) VALUES (?, ?, 1) ON CONFLICT(owner_id, minute) DO UPDATE SET n = n + 1", [owner, minute]);
    const count = Number((await deps.db.all("SELECT n FROM rate_limits WHERE owner_id = ? AND minute = ?", [owner, minute]))[0]?.n ?? 0);
    if (count > (deps.requestsPerMinute ?? 120)) return json({ error: "Too many requests this minute. Wait a moment and try again." }, 429);

    const store = new Store(deps.db, owner, now);
    const server = createServer({ store, now, maxRowsPerImport: 200, maxReviewsPerOwner: 2000 });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  return json({ error: "not found" }, 404);
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handleRequest(req, { db: new D1Db(env.DB), adminToken: env.ADMIN_TOKEN });
  },
};
