import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importReviews, ImportError } from "../src/engine/importer.js";

const sample = readFileSync("data/sample/reviews.csv", "utf8");

describe("importReviews on the sample file", () => {
  it("adds 117 reviews, skips 3 duplicates and rejects 0 rows", async () => {
    const r = await importReviews(sample);
    expect(r.skipped.map((p) => p.reason)).toEqual(["duplicate", "duplicate", "duplicate"]);
    expect(r.rejected).toEqual([]);
    expect(r.reviews).toHaveLength(117);
  });

  it("keeps rating-only rows (R094, R095) and rows with no rating (R096, R097)", async () => {
    const r = await importReviews(sample);
    const byId = new Map(r.reviews.map((x) => [x.review_id, x]));
    expect(byId.get("R094")).toMatchObject({ text: "", rating: 1 });
    expect(byId.get("R095")).toMatchObject({ text: "", rating: 5 });
    expect(byId.get("R096")).toMatchObject({ rating: null });
    expect(byId.get("R097")?.text).toContain("AC");
  });

  it("keeps owner replies and ISO dates", async () => {
    const r = await importReviews(sample);
    const r62 = r.reviews.find((x) => x.review_id === "R062")!;
    expect(r62.existing_owner_reply).toContain("sorry");
    expect(r62.review_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is idempotent: importing the same file again adds nothing", async () => {
    const first = await importReviews(sample);
    const again = await importReviews(sample, { existingFingerprints: new Set(first.reviews.map((x) => x.fingerprint)) });
    expect(again.reviews).toHaveLength(0);
    expect(again.skipped).toHaveLength(120);
  });
});

describe("importReviews on messy files", () => {
  it("rejects rows with neither text nor rating", async () => {
    const r = await importReviews("text,rating\n,\n  ,\nGood,5\n\n");
    expect(r.rejected.map((p) => [p.row, p.reason])).toEqual([[2, "empty"], [3, "empty"]]);
    expect(r.reviews).toHaveLength(1);
  });

  it("recognises other column names and quoted commas and newlines", async () => {
    const r = await importReviews('Review,Stars,Date\n"Great, really\nnice",4 stars,2026-03-01\n');
    expect(r.reviews[0]).toMatchObject({ text: "Great, really\nnice", rating: 4, review_date: "2026-03-01" });
  });

  it("explains when no usable column exists", async () => {
    await expect(importReviews("foo,bar\n1,2\n")).rejects.toThrow(ImportError);
  });

  it("warns about ambiguous dates and honours dateOrder", async () => {
    const csv = "text,date\nGood,03/04/2026\n";
    const a = await importReviews(csv);
    expect(a.reviews[0]!.review_date).toBe("2026-03-04");
    expect(a.warnings.join()).toContain("two ways");
    const b = await importReviews(csv, { dateOrder: "dmy" });
    expect(b.reviews[0]!.review_date).toBe("2026-04-03");
    expect(b.warnings).toEqual([]);
  });

  it("enforces row and owner limits with plain messages", async () => {
    const csv = "text\na\nb\nc\nd\n";
    const r = await importReviews(csv, { maxRows: 2 });
    expect(r.reviews).toHaveLength(2);
    expect(r.rejected.map((p) => p.reason)).toEqual(["over-row-limit", "over-row-limit"]);
    const o = await importReviews(csv, { existingReviewCount: 1999, maxReviewsPerOwner: 2000 });
    expect(o.reviews).toHaveLength(1);
    expect(o.rejected[0]!.reason).toBe("over-owner-limit");
  });

  it("treats two rating-only rows with different stars as different reviews", async () => {
    const r = await importReviews("text,rating,date\n,5,2026-01-01\n,4,2026-01-01\n");
    expect(r.reviews).toHaveLength(2);
  });

  it("flags non-English text and bad ratings", async () => {
    const r = await importReviews("text,rating\nこれは日本語のレビューです,9\n");
    expect(r.reviews[0]).toMatchObject({ language: "other", rating: null });
    expect(r.warnings.length).toBe(2);
  });
});
