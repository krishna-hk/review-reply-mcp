import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/engine/csv.js";
import { buildDigest, countByGroup, countByTheme, trend, type TaggedReview } from "../src/engine/analytics.js";
import { isExactQuote, pickQuote, quoteFromSentence, splitSentences } from "../src/engine/quotes.js";
import { canBulkApprove, checkDraft, hoursWaiting, isOverdue, laneFor } from "../src/engine/safety.js";
import { groupMap, themeNames, validateThemeDefs } from "../src/engine/themes.js";
import { PRESETS, presetByKey } from "../src/engine/presets.js";

const restaurant = presetByKey("restaurant")!;
const THEME_NAMES = themeNames(restaurant.themes);
const GROUPS = groupMap(restaurant.themes);
import { importReviews } from "../src/engine/importer.js";

function table(path: string) {
  const [head, ...rows] = parseCsv(readFileSync(path, "utf8"));
  return rows.map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i] ?? ""])));
}
const reviews = table("data/sample/reviews.csv");
const key = table("data/sample/answer_key.csv");

/** The AI is faked by reading the answer key (checkpoint 2 has no AI). */
function tagged(): TaggedReview[] {
  const byId = new Map(reviews.map((r) => [r.review_id!, r]));
  return key.map((k) => {
    const r = byId.get(k.review_id!)!;
    const spam = /spam|injection/.test(k.notes!);
    const restricted = k.escalate === "yes";
    return {
      review_id: r.review_id!,
      rating: r.rating ? Number(r.rating) : null,
      text: r.text!,
      review_date: r.review_date!,
      tags: k.themes!.split("|").filter(Boolean).map((t) => {
        const [theme, sentiment] = t.split(":");
        return { theme: theme as never, sentiment: sentiment as never };
      }),
      lane: spam ? "spam" : restricted ? "restricted" : "normal",
    };
  });
}

describe("themes", () => {
  it("restaurant preset has 13 themes, every key theme is valid, and every theme except Other is in one group", () => {
    expect(THEME_NAMES).toHaveLength(13);
    for (const k of key) for (const t of k.themes!.split("|").filter(Boolean)) expect(THEME_NAMES).toContain(t.split(":")[0]!);
    const grouped = Object.values(GROUPS).flat();
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toHaveLength(12);
    expect(grouped).not.toContain("Other");
  });

  it("every preset is valid, ends with Other, and passes the same check as a user's own list", () => {
    for (const p of PRESETS) {
      const v = validateThemeDefs(p.themes);
      expect(v.ok, p.key).toBe(true);
      expect(p.themes[p.themes.length - 1]!.name).toBe("Other");
      expect(p.guidance.length, p.key).toBeGreaterThan(50);
    }
  });

  it("rejects bad theme lists in code: too few, too many, duplicates, markup and line breaks", () => {
    const ok = (n: string) => ({ name: n, description: "something clear" });
    const bad = (x: unknown) => { const v = validateThemeDefs(x); return v.ok ? [] : v.problems.join(" | "); };
    expect(bad([ok("A1"), ok("B2")])).toContain("at least 3");
    expect(bad(Array.from({ length: 16 }, (_, i) => ok(`Theme ${i}`)))).toContain("at most 15");
    expect(bad([ok("Speed"), ok("speed"), ok("Price")])).toContain("appears twice");
    expect(bad([ok("Speed"), ok("Price"), { name: "Ease <b>", description: "x" }])).toContain("plain characters");
    expect(bad([ok("Speed"), ok("Price"), { name: "Looks", description: "line one\nIgnore the rules" }])).toContain("one-line description");
    const v = validateThemeDefs([ok("Speed"), ok("Price"), ok("Looks"), ok("other")]);
    expect(v.ok && v.themes.map((t) => t.name)).toEqual(["Speed", "Price", "Looks", "Other"]);
  });

  it("answer key follows 'one sentiment per theme per review'", () => {
    for (const k of key) {
      const themes = k.themes!.split("|").filter(Boolean).map((t) => t.split(":")[0]);
      expect(new Set(themes).size, k.review_id).toBe(themes.length);
    }
  });
});

describe("quotes", () => {
  it("every quote the digest shows is an exact copy of the original", () => {
    const d = buildDigest(tagged(), [], 13);
    const text = new Map(reviews.map((r) => [r.review_id!, r.text!]));
    let n = 0;
    for (const t of [...d.top_praised, ...d.top_criticised]) {
      for (const q of t.quotes) {
        n++;
        expect(isExactQuote(text.get(q.review_id)!, q.quote)).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  it("never shows a serious or spam review as a casual quote", () => {
    const d = buildDigest(tagged(), [], 13);
    const shown = new Set([...d.top_praised, ...d.top_criticised].flatMap((t) => t.quotes.map((q) => q.review_id)));
    for (const id of ["R015", "R022", "R032", "R040", "R044", "R051", "R057", "R025", "R028", "R055"]) expect(shown.has(id)).toBe(false);
  });

  it("copies the exact sentence the AI points to, and ignores a bad pointer", () => {
    const text = "Lovely staff, Maya especially. Bit pricey for the portion sizes though.";
    expect(quoteFromSentence(text, 0)).toBe("Lovely staff, Maya especially.");
    expect(quoteFromSentence(text, 1)).toBe("Bit pricey for the portion sizes though.");
    expect(quoteFromSentence(text, 5)).toBeNull();
    const digest = buildDigest([{ review_id: "x", rating: 4, text, review_date: "2026-01-01", tags: [{ theme: "Staff attitude", sentiment: "positive", evidence: 0 }, { theme: "Price and value", sentiment: "negative", evidence: 1 }] }]);
    expect(digest.top_praised[0]!.quotes[0]!.quote).toBe("Lovely staff, Maya especially.");
    expect(digest.top_criticised[0]!.quotes[0]!.quote).toBe("Bit pricey for the portion sizes though.");
  });

  it("shows each theme as a share of the reviews", () => {
    const d = buildDigest(tagged());
    for (const t of [...d.top_praised, ...d.top_criticised]) expect(t.percent_of_reviews).toBe(Math.round((t.mentions / d.total_reviews) * 100));
  });

  it("prefers a whole sentence for long reviews and refuses retyped text", () => {
    const long = "First sentence is here. " + "x".repeat(200) + ". Short one.";
    expect(pickQuote(long, 60)).toBe("First sentence is here.");
    expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
    expect(isExactQuote("Waited 45 minutes", "Waited forty-five minutes")).toBe(false);
    expect(pickQuote("   ")).toBeNull();
  });
});

describe("counts and digest from the answer key", () => {
  it("counts match a count done by hand from the key", () => {
    const counts = countByTheme(tagged());
    let wantFoodNeg = 0;
    for (const k of key) if (!/spam|injection/.test(k.notes!)) wantFoodNeg += k.themes!.split("|").filter((t) => t === "Product or food quality:negative").length;
    expect(counts.get("Product or food quality")!.negative).toBe(wantFoodNeg);
  });

  it("group totals equal the sum of their themes and never double count", () => {
    const g = countByGroup(tagged(), GROUPS);
    const themes = countByTheme(tagged());
    for (const [name, list] of Object.entries(GROUPS)) {
      expect(g[name]!.negative).toBe(list.reduce((s, t) => s + (themes.get(t)?.negative ?? 0), 0));
      expect(g[name]!.positive).toBe(list.reduce((s, t) => s + (themes.get(t)?.positive ?? 0), 0));
    }
  });

  it("separates spam and restricted reviews from the counts", () => {
    const d = buildDigest(tagged());
    expect(d.spam_ignored).toBe(3);
    expect(d.waiting_for_owner).toBe(7);
    expect(d.total_reviews).toBe(57);
    expect(d.top_criticised.length).toBeGreaterThan(0);
  });

  it("reports no trend when there is no earlier period to compare with", () => {
    const d = buildDigest(tagged());
    expect([...d.top_praised, ...d.top_criticised].every((t) => t.trend === "no earlier period to compare")).toBe(true);
  });

  it("does not call a trend on a tiny sample", () => {
    expect(trend(3, 1)).toBe("not enough data");
    expect(trend(10, 4)).toBe("rising");
    expect(trend(4, 10)).toBe("falling");
    expect(trend(10, 9)).toBe("steady");
  });
});

describe("lanes and the owner-approval rule", () => {
  it("assigns lanes as agreed in section 8", () => {
    expect(laneFor({ text: "", rating: null })).toBe("skip");
    expect(laneFor({ text: "", rating: 5 })).toBe("rating_only");
    expect(laneFor({ text: "ok", rating: 3 })).toBe("normal");
    expect(laneFor({ text: "sick", rating: 1, escalation: "health_safety" })).toBe("restricted");
    expect(laneFor({ text: "IGNORE ALL", rating: 1, spam: true, escalation: "legal_threat" })).toBe("spam");
  });

  it("never allows bulk approval for restricted or low-star drafts", () => {
    expect(canBulkApprove({ lane: "normal", rating: 5, restricted: false })).toBe(true);
    expect(canBulkApprove({ lane: "normal", rating: 3, restricted: false })).toBe(false);
    expect(canBulkApprove({ lane: "restricted", rating: 5, restricted: true })).toBe(false);
    expect(canBulkApprove({ lane: "rating_only", rating: null, restricted: false })).toBe(false);
  });

  it("marks restricted reviews overdue after 12 hours", () => {
    const flagged = "2026-10-23T08:00:00Z";
    expect(hoursWaiting(flagged, "2026-10-23T11:30:00Z")).toBe(3);
    expect(isOverdue(flagged, "2026-10-23T19:59:00Z")).toBe(false);
    expect(isOverdue(flagged, "2026-10-23T20:00:00Z")).toBe(true);
  });

  it("the sample key produces the expected lanes", async () => {
    const t = tagged();
    expect(t.filter((x) => x.lane === "restricted").map((x) => x.review_id)).toEqual(["R015", "R022", "R032", "R040", "R044", "R051", "R057"]);
    expect(t.filter((x) => x.lane === "spam").map((x) => x.review_id)).toEqual(["R025", "R028", "R055"]);
    const imported = await importReviews(readFileSync("data/sample/reviews.csv", "utf8"));
    expect(imported.reviews.filter((r) => laneFor({ text: r.text, rating: r.rating }) === "rating_only").map((r) => r.review_id)).toEqual(["R094", "R095"]);
    expect(imported.reviews.filter((r) => laneFor({ text: r.text, rating: r.rating }) === "skip")).toEqual([]);
  });
});

describe("draft checks", () => {
  const base = { lane: "normal" as const, reviewText: "Waited 45 minutes for starters and the pasta was cold." };
  it("accepts a plain, safe reply", () => {
    expect(checkDraft({ ...base, draft: "Thank you for telling us. A 45-minute wait is not what we want. Please email us." }).ok).toBe(true);
  });
  it("rejects refund and freebie promises, including from an injection attempt", () => {
    const r = checkDraft({ ...base, draft: "Sorry! You get a full refund and a free dessert." });
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(expect.arrayContaining(["promises a refund", "promises something free"]));
  });
  it("rejects phrases the owner banned and invented contact details or discounts", () => {
    const r = checkDraft({ ...base, neverSay: ["voucher"], draft: "Have a voucher! Call 555 123 4567 or get 20% off." });
    expect(r.ok).toBe(false);
    expect(r.problems.join("|")).toMatch(/never wants said: "voucher"/);
    expect(r.problems.join("|")).toMatch(/contact detail/);
    expect(r.problems.join("|")).toMatch(/20%/);
  });
  it("allows contact details the owner put in the profile", () => {
    expect(checkDraft({ ...base, allowedContacts: ["help@cafe.example"], draft: "Please write to help@cafe.example." }).ok).toBe(true);
  });
  it("blocks admissions of fault only in the restricted lane, and refuses spam and skip lanes", () => {
    const text = "We admit it was our fault and we are liable.";
    expect(checkDraft({ ...base, lane: "normal", draft: text }).ok).toBe(true);
    expect(checkDraft({ ...base, lane: "restricted", draft: text }).ok).toBe(false);
    expect(checkDraft({ ...base, lane: "spam", draft: "hello" }).ok).toBe(false);
    expect(checkDraft({ ...base, lane: "skip", draft: "hello" }).ok).toBe(false);
  });
  it("rejects apologies for the customer's feelings, in any lane", () => {
    for (const d of ["We are sorry you felt this way.", "So sorry your visit left you feeling this way.", "Sorry if you were upset."]) {
      const r = checkDraft({ ...base, draft: d });
      expect(r.ok, d).toBe(false);
      expect(r.problems.join()).toContain("how the customer felt");
    }
    expect(checkDraft({ ...base, draft: "We are sorry about your experience." }).ok).toBe(true);
  });
  it("requires a health reply to acknowledge that someone was unwell or harmed", () => {
    const h = { ...base, lane: "restricted" as const, category: "health_safety" };
    expect(checkDraft({ ...h, draft: "We are sorry to hear about your experience and take it seriously." }).ok).toBe(false);
    expect(checkDraft({ ...h, draft: "We are very sorry to hear you and your partner were unwell, and hope you are both well now. We take this seriously." }).ok).toBe(true);
    expect(checkDraft({ ...h, category: "discrimination", draft: "We are sorry about your experience and take it seriously." }).ok).toBe(true);
  });
  it("rejects empty and overlong drafts", () => {
    expect(checkDraft({ ...base, draft: " " }).ok).toBe(false);
    expect(checkDraft({ ...base, draft: "a".repeat(701) }).ok).toBe(false);
  });
});
