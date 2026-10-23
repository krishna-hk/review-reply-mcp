// Shows the engine working with no AI: imports the sample CSV, reads the tags from the answer key
// (standing in for the AI), and prints the digest data.
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/engine/csv.js";
import { importReviews } from "../src/engine/importer.js";
import { buildDigest, type TaggedReview } from "../src/engine/analytics.js";
import type { Sentiment, Theme } from "../src/engine/themes.js";

const result = await importReviews(readFileSync("data/sample/reviews.csv", "utf8"), { source: "demo" });
console.log("IMPORT:", result.summary);
for (const w of result.warnings) console.log("  warning:", w);

const [head, ...rows] = parseCsv(readFileSync("data/sample/answer_key.csv", "utf8"));
const key = new Map(rows.map((r) => [r[0]!, Object.fromEntries(head!.map((h, i) => [h, r[i] ?? ""]))]));
const tagged: TaggedReview[] = result.reviews
  .filter((r) => key.has(r.review_id))
  .map((r) => {
    const k = key.get(r.review_id)!;
    const spam = /spam|injection/.test(k.notes!);
    return {
      review_id: r.review_id,
      rating: r.rating,
      text: r.text,
      review_date: r.review_date,
      tags: k.themes!.split("|").filter(Boolean).map((t) => ({ theme: t.split(":")[0] as Theme, sentiment: t.split(":")[1] as Sentiment })),
      lane: spam ? "spam" : k.escalate === "yes" ? "restricted" : "normal",
    };
  });

const d = buildDigest(tagged);
console.log("\nDIGEST (first 60 reviews, tags from the answer key)");
console.log(`  reviews: ${d.total_reviews}, average stars: ${d.average_rating}, waiting for owner: ${d.waiting_for_owner}, spam ignored: ${d.spam_ignored}`);
console.log("  by group (positive / negative):");
for (const [g, c] of Object.entries(d.groups)) console.log(`    ${g}: ${c.positive} / ${c.negative}`);
for (const [label, list] of [["Top praised", d.top_praised], ["Top criticised", d.top_criticised]] as const) {
  console.log(`  ${label}:`);
  for (const t of list) {
    console.log(`    ${t.theme} (${t.mentions}, ${t.trend})`);
    for (const q of t.quotes) console.log(`      "${q.quote}" (${q.review_id})`);
  }
}
