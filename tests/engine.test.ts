import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/engine/csv.js";
import { buildDigest, countByGroup, countByTheme, trend, type TaggedReview } from "../src/engine/analytics.js";
import { isExactQuote, pickQuote, splitSentences } from "../src/engine/quotes.js";
import { canBulkApprove, checkDraft, hoursWaiting, isOverdue, laneFor } from "../src/engine/safety.js";
import { isTheme, THEMES, UMBRELLA_GROUPS, groupOf } from "../src/engine/themes.js";
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
  it("has 13 themes, every key theme is valid, and every theme except Other is in one group", () => {
    expect(THEMES).toHaveLength(13);
    for (const k of key) for (const t of k.themes!.split("|").filter(Boolean)) expect(isTheme(t.split(":")[0]!)).toBe(true);
    const grouped = Object.values(UMBRELLA_GROUPS).flat();
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).toHaveLength(12);
    expect(groupOf("Other")).toBeNull();
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
    const g = countByGroup(tagged());
    const themes = countByTheme(tagged());
    for (const [name, list] of Object.entries(UMBRELLA_GROUPS)) {
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
    expect([...d.top_praised, ...d.top_criticised].every((t) => t.trend === "not enough data")).toBe(true);
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
  it("rejects empty and overlong drafts", () => {
    expect(checkDraft({ ...base, draft: " " }).ok).toBe(false);
    expect(checkDraft({ ...base, draft: "a".repeat(701) }).ok).toBe(false);
  });
});
