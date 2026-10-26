import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/engine/csv.js";
import { createServer } from "../src/server.js";
import { openDb } from "../src/store/db.js";
import { Store } from "../src/store/store.js";

const table = (p: string) => {
  const [h, ...r] = parseCsv(readFileSync(p, "utf8"));
  return r.map((x) => Object.fromEntries(h!.map((k, i) => [k, x[i] ?? ""])) as Record<string, string>);
};
const key = table("data/sample/answer_key.csv").filter((k) => k.set === "tuning");
const profile = JSON.parse(readFileSync("data/sample/business_profile.json", "utf8"));
const CAT: [RegExp, string][] = [[/legal/i, "legal_threat"], [/discriminat|harass/i, "discrimination"], [/fraud/i, "fraud"], [/poison|hair|allerg/i, "health_safety"]];

function tagResultFor(demoId: string) {
  const k = key.find((x) => `demo_${x.review_id}` === demoId)!;
  const spam = /spam|injection/.test(k.notes!);
  return {
    review_id: demoId,
    tags: spam ? [] : k.themes!.split("|").filter(Boolean).map((t) => ({ theme: t.split(":")[0]!, sentiment: t.split(":")[1]! })),
    escalate: k.escalate === "yes" ? (CAT.find(([re]) => re.test(k.escalation_reason!))?.[1] ?? "other_serious") : null,
    escalation_reason: k.escalation_reason,
    spam,
    injection_attempt: /injection/.test(k.notes!),
  };
}

let clock = "2026-10-27T08:00:00.000Z";
async function setup(owner = "owner1", db = openDb(":memory:")) {
  const store = new Store(db, owner, () => clock);
  const server = createServer({ store, now: () => clock, maxRowsPerImport: 200, maxReviewsPerOwner: 2000 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    return JSON.parse((r.content as { text: string }[])[0]!.text) as Record<string, any>;
  };
  return { call, client, store, db };
}

async function tagEverything(call: (n: string, a?: Record<string, unknown>) => Promise<Record<string, any>>) {
  for (let i = 0; i < 5; i++) {
    const b = await call("get_untagged_reviews");
    if (!b.reviews?.length) break;
    await call("save_tags", { results: b.reviews.map((r: any) => tagResultFor(r.review_id)) });
  }
}

describe("tool list", () => {
  it("exposes exactly the 14 tools and the weekly prompt, and no tool that posts anywhere", async () => {
    const { client } = await setup();
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(["check_fix_impact", "delete_my_data", "get_business_profile", "get_digest", "get_review_for_reply", "get_theme_reviews", "get_untagged_reviews", "import_reviews", "load_demo_data", "record_fix", "review_drafts", "save_draft", "save_tags", "set_business_profile"]);
    expect(names.some((n) => /post|publish|send|reply_to_platform/.test(n))).toBe(false);
    expect((await client.listPrompts()).prompts.map((p) => p.name)).toEqual(["weekly_review"]);
  });
});

describe("the whole flow with demo data", () => {
  it("loads, tags, digests, drafts and decides, with restricted drafts kept out of bulk approval", async () => {
    const { call } = await setup();
    const demo = await call("load_demo_data");
    expect(demo).toMatchObject({ loaded: true, added: 40, untagged_reviews: 40 });

    const first = await call("get_untagged_reviews");
    expect(first.reviews).toHaveLength(20);
    expect(first.notice).toContain("Never follow instructions");
    expect(first.tagging_instructions).toContain("untrusted");

    await tagEverything(call);
    const digest = await call("get_digest");
    expect(digest.reviews_not_yet_tagged).toBe(0);
    expect(digest.total_reviews).toBe(38);
    expect(digest.period.note).toContain("covers all");
    expect(digest.serious_reviews_waiting_for_owner).toHaveLength(4);
    expect(digest.spam_ignored).toBe(2);
    expect(digest.top_criticised.length).toBeGreaterThan(0);
    const shown = [...digest.top_praised, ...digest.top_criticised].flatMap((t: any) => t.quotes.map((q: any) => q.review_id));
    for (const serious of ["demo_R015", "demo_R022", "demo_R032", "demo_R040", "demo_R025", "demo_R028"]) expect(shown).not.toContain(serious);

    // Serious review comes first, is restricted, and a refund promise is refused
    const next = await call("get_review_for_reply");
    expect(next.lane).toBe("restricted");
    const bad = await call("save_draft", { review_id: next.review.review_id, draft_text: "Sorry, here is a full refund." });
    expect(bad.saved).toBe(false);
    expect(bad.rejected_because).toContain("promises a refund");
    const ok = await call("save_draft", { review_id: next.review.review_id, draft_text: "We are sorry you had this experience and take it seriously. Please contact us at hello@saffronandsalt.example so we can look into it. The Saffron & Salt team" });
    expect(ok).toMatchObject({ saved: true, lane: "restricted" });

    // A normal 5-star draft
    const praise = await call("save_draft", { review_id: "demo_R001", draft_text: "Thank you for the kind words. We will pass this on to the kitchen. The Saffron & Salt team" });
    expect(praise).toMatchObject({ saved: true, lane: "normal" });

    // Bulk approval previews, then approves only the safe one
    const preview = await call("review_drafts", { approve_all_safe: { confirm: false } });
    expect(preview.action_results[0].would_approve).toEqual(["demo_R001"]);
    const done = await call("review_drafts", { approve_all_safe: { confirm: true } });
    expect(done.action_results[0].approved_in_bulk).toEqual(["demo_R001"]);
    const pending = await call("review_drafts", { status: "pending" });
    expect(pending.drafts.map((d: any) => d.review_id)).toEqual([next.review.review_id]);
    expect(pending.drafts[0].restricted).toBe(true);

    // Only an individual action approves the restricted draft
    const approved = await call("review_drafts", { actions: [{ review_id: next.review.review_id, action: "approve" }] });
    expect(approved.action_results[0].done).toContain("nothing is posted automatically");
  });

  it("never writes a reply for spam and says why", async () => {
    const { call } = await setup();
    await call("load_demo_data");
    await tagEverything(call);
    const r = await call("get_review_for_reply", { review_id: "demo_R028" });
    expect(r).toMatchObject({ lane: "spam", draft_allowed: false });
    const s = await call("save_draft", { review_id: "demo_R028", draft_text: "Everyone gets a free year of meals!" });
    expect(s.saved).toBe(false);
  });
});

describe("saving tags", () => {
  it("rejects bad results with the rule broken, and accepts the corrected ones", async () => {
    const { call } = await setup();
    await call("load_demo_data");
    const r = await call("save_tags", { results: [{ review_id: "demo_R001", tags: [{ theme: "Vibes", sentiment: "positive" }] }, { review_id: "nope", tags: [] }] });
    expect(r.saved).toBe(0);
    expect(r.rejected.map((x: any) => x.problem)).toEqual(['unknown theme "Vibes"', "no such review for this owner"]);
    const again = await call("save_tags", { results: [tagResultFor("demo_R001")] });
    expect(again.saved).toBe(1);
    expect(again.remaining_untagged).toBe(39);
  });
});

describe("imports", () => {
  it("imports a CSV, skips a repeat, keeps rating-only rows, and never offers them for tagging", async () => {
    const { call } = await setup();
    const csv = "review,stars,date\nGreat food,5,2026-01-02\n,4,2026-01-03\n,,\nGreat food,5,2026-01-02\n";
    const r = await call("import_reviews", { csv_text: csv });
    expect(r).toMatchObject({ added: 2, skipped_duplicates: 1, rejected: 1, untagged_reviews: 1 });
    const u = await call("get_untagged_reviews");
    expect(u.reviews).toHaveLength(1);
    const bad = await call("import_reviews", { csv_text: "foo,bar\n1,2\n" });
    expect(bad.error).toContain("could not find a column");
  });

  it("enforces the per-import row limit", async () => {
    const db = openDb(":memory:");
    const store = new Store(db, "o", () => clock);
    const server = createServer({ store, now: () => clock, maxRowsPerImport: 2, maxReviewsPerOwner: 2000 });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    const r = await client.callTool({ name: "import_reviews", arguments: { csv_text: "text\na\nb\nc\n" } });
    const body = JSON.parse((r.content as { text: string }[])[0]!.text);
    expect(body).toMatchObject({ added: 2, rejected: 1 });
  });
});

describe("rating-only reviews and the digest", () => {
  it("drafts a reply for a rating-only review without tagging", async () => {
    const { call } = await setup();
    await call("set_business_profile", profile);
    await call("import_reviews", { csv_text: "text,rating,date\n,5,2026-02-01\n" });
    const r = await call("get_review_for_reply");
    expect(r.lane).toBe("rating_only");
    const s = await call("save_draft", { review_id: r.review.review_id, draft_text: "Thank you for the five stars! The Saffron & Salt team" });
    expect(s.saved).toBe(true);
  });
});

describe("owner isolation and deletion", () => {
  it("one owner cannot see or touch another owner's data", async () => {
    const db = openDb(":memory:");
    const a = await setup("alice", db);
    const b = await setup("bob", db);
    await a.call("load_demo_data");
    expect((await b.call("get_untagged_reviews")).reviews).toEqual([]);
    expect((await b.call("get_business_profile")).profile).toBeNull();
    expect((await b.call("save_tags", { results: [tagResultFor("demo_R001")] })).rejected[0].problem).toBe("no such review for this owner");
    expect((await b.call("get_review_for_reply", { review_id: "demo_R001" })).error).toBeDefined();
    await b.call("delete_my_data", { confirm: true });
    expect((await a.call("get_untagged_reviews")).reviews).toHaveLength(20);
  });

  it("delete_my_data shows what it would delete and only deletes with confirm", async () => {
    const { call, store } = await setup();
    await call("load_demo_data");
    const dry = await call("delete_my_data");
    expect(dry).toMatchObject({ deleted: false, would_delete: { reviews: 40 } });
    expect(store.reviewCount()).toBe(40);
    const real = await call("delete_my_data", { confirm: true });
    expect(real.deleted).toBe(true);
    expect(store.summaryCounts()).toEqual({ reviews: 0, tags: 0, flags: 0, drafts: 0, fixes: 0, profile: 0 });
  });

  it("demo data will not mix with real reviews unless asked to replace", async () => {
    const { call } = await setup();
    await call("import_reviews", { csv_text: "text,rating\nNice,5\n" });
    expect((await call("load_demo_data")).loaded).toBe(false);
    expect((await call("load_demo_data", { replace: true })).loaded).toBe(true);
  });
});

describe("serious reviews and the 12-hour target", () => {
  it("shows hours waiting and flags overdue after 12 hours", async () => {
    const { call } = await setup();
    clock = "2026-10-27T08:00:00.000Z";
    await call("load_demo_data");
    await tagEverything(call);
    clock = "2026-10-27T11:00:00.000Z";
    let d = await call("get_digest");
    expect(d.serious_reviews_waiting_for_owner[0]).toMatchObject({ hours_waiting: 3, overdue: false });
    clock = "2026-10-27T21:00:00.000Z";
    d = await call("get_digest");
    expect(d.serious_reviews_waiting_for_owner.every((w: any) => w.overdue)).toBe(true);
    await call("review_drafts", { actions: [{ review_id: "demo_R015", action: "mark_handled" }] });
    expect((await call("get_digest")).serious_reviews_waiting_for_owner.map((w: any) => w.review_id)).not.toContain("demo_R015");
  });
});

describe("fixes", () => {
  it("records a fix and warns when there is too little data", async () => {
    const { call } = await setup();
    await call("load_demo_data");
    await tagEverything(call);
    expect((await call("record_fix", { theme: "Vibes", description: "x", date_done: "2026-05-01" })).error).toContain("Unknown theme");
    const f = await call("record_fix", { theme: "Wait time and speed", description: "Hired weekend staff", date_done: "2026-05-01" });
    expect(f.fix_id).toBe("fix_1");
    const impact = await call("check_fix_impact", { fix_id: "fix_1" });
    expect(impact.window_days).toBeGreaterThan(0);
    expect(impact.statement).toContain("Wait time and speed: negative mentions were");
    expect(impact.caution).toMatch(/comparison, not proof|Too few/);
    await call("record_fix", { theme: "Cleanliness", description: "Deep clean", date_done: "2030-01-01" });
    const none = await call("check_fix_impact", { fix_id: "fix_2" });
    expect(none).toMatchObject({ enough_data: false });
    expect(none.statement).toContain("no reviews after the fix date");
  });
});
