import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vitest";
import { handleRequest, type AppDeps } from "../src/worker.js";
import { openDb } from "../src/store/db.js";

const ORIGIN = "https://reviews.example.test";
function deps(over: Partial<AppDeps> = {}): AppDeps {
  return { db: openDb(":memory:"), adminToken: "admin-secret", now: () => "2026-10-27T10:00:00.000Z", ...over };
}
const admin = (d: AppDeps, path: string, method = "POST", body?: unknown, token = "admin-secret") =>
  handleRequest(new Request(`${ORIGIN}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), d);
async function invite(d: AppDeps, label = "tester") {
  const r = await admin(d, "/admin/invites", "POST", { label });
  return (await r.json()) as { owner_id: string; connect_url: string };
}
async function connect(d: AppDeps, url: string) {
  const transport = new StreamableHTTPClientTransport(new URL(url), { fetch: (u, init) => handleRequest(new Request(u as string, init), d) });
  const client = new Client({ name: "t", version: "0" });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    JSON.parse(((await client.callTool({ name, arguments: args })).content as { text: string }[])[0]!.text) as Record<string, any>;
  return { client, call };
}

describe("hosted server over HTTP", () => {
  it("serves the 14 tools at a personal link and works end to end", async () => {
    const d = deps();
    const { connect_url } = await invite(d);
    const { client, call } = await connect(d, connect_url);
    expect((await client.listTools()).tools).toHaveLength(14);
    expect(await call("load_demo_data")).toMatchObject({ loaded: true, added: 40 });
    expect((await call("get_untagged_reviews")).reviews).toHaveLength(20);
  });

  it("admin endpoints need the admin token; a wrong link or a revoked link looks like nothing is there", async () => {
    const d = deps();
    expect((await admin(d, "/admin/invites", "POST", {}, "wrong")).status).toBe(401);
    expect((await handleRequest(new Request(`${ORIGIN}/admin/invites`, { method: "POST" }), d)).status).toBe(401);
    expect((await handleRequest(new Request(`${ORIGIN}/mcp/not-a-real-token`, { method: "POST", body: "{}" }), d)).status).toBe(404);
    const { owner_id, connect_url } = await invite(d);
    expect((await (await admin(d, `/admin/invites/${owner_id}`, "DELETE")).json())).toEqual({ revoked: 1 });
    expect((await handleRequest(new Request(connect_url, { method: "POST", body: "{}" }), d)).status).toBe(404);
  });

  it("stores only a hash of the link, never the link itself", async () => {
    const d = deps();
    const { connect_url } = await invite(d);
    const token = connect_url.split("/").pop()!;
    const rows = await d.db.all("SELECT * FROM invites");
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("keeps two owners' data apart", async () => {
    const d = deps();
    const a = await connect(d, (await invite(d, "a")).connect_url);
    const b = await connect(d, (await invite(d, "b")).connect_url);
    await a.call("load_demo_data");
    expect((await b.call("get_untagged_reviews")).reviews).toEqual([]);
    expect((await a.call("get_untagged_reviews")).reviews).toHaveLength(20);
  });

  it("delete_my_data wipes the owner's reviews but the personal link keeps working", async () => {
    const d = deps();
    const { connect_url } = await invite(d);
    const { call } = await connect(d, connect_url);
    await call("load_demo_data");
    expect((await call("delete_my_data", { confirm: true })).deleted).toBe(true);
    expect((await call("get_untagged_reviews")).reviews).toEqual([]);
    expect((await call("load_demo_data")).loaded).toBe(true);
  });

  it("refuses oversized requests and too many requests per minute", async () => {
    const d = deps({ maxBodyBytes: 100, requestsPerMinute: 2 });
    const { connect_url } = await invite(d);
    const big = await handleRequest(new Request(connect_url, { method: "POST", headers: { "content-length": "5000", "content-type": "application/json" }, body: "{}" }), d);
    expect(big.status).toBe(413);
    const post = () => handleRequest(new Request(connect_url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), d);
    const codes = [(await post()).status, (await post()).status, (await post()).status];
    expect(codes[2]).toBe(429);
  });

  it("rejects GET on the MCP link", async () => {
    const d = deps();
    const { connect_url } = await invite(d);
    expect((await handleRequest(new Request(connect_url, { method: "GET" }), d)).status).toBe(405);
  });
});
