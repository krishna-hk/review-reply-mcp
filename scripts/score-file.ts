// Scores a JSON file of AI answers (for example from a Claude sub-agent) against the answer key.
//   npx tsx scripts/score-file.ts <answers.json> [tuning|test] [--final] [--dir data/sample/set2]
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "../src/engine/csv.js";
import { validateTagOutput } from "../src/engine/tags.js";
import { parseJson } from "../src/ai/tagger.js";
import { scoreTags, type Expected } from "../src/ai/score.js";

const file = process.argv[2];
const set = process.argv[3] ?? "tuning";
const dirIdx = process.argv.indexOf("--dir");
const dir = dirIdx > 0 ? process.argv[dirIdx + 1]! : "data/sample";
if (!file) throw new Error("Usage: score-file.ts <answers.json> [tuning|test]");
if (set === "test" && !process.argv.includes("--final")) throw new Error("The test set is sealed. Add --final only for the final measurement.");
const table = (p: string) => {
  const [h, ...r] = parseCsv(readFileSync(p, "utf8"));
  return r.map((x) => Object.fromEntries(h!.map((k, i) => [k, x[i] ?? ""])) as Record<string, string>);
};
const reviews = new Map(table(`${dir}/reviews.csv`).map((r) => [r.review_id!, r]));
const key = table(`${dir}/answer_key.csv`).filter((k) => k.set === set);
const batch = key.map((k) => ({ review_id: k.review_id!, text: reviews.get(k.review_id!)!.text! }));
const { accepted, rejected } = validateTagOutput(parseJson(readFileSync(file, "utf8")), batch);
for (const r of rejected) console.log(`rejected by code: ${r.review_id}: ${r.problem}`);
const expected: Expected[] = key.map((k) => ({
  review_id: k.review_id!,
  tags: new Set(/spam|injection/.test(k.notes!) ? [] : k.themes!.split("|").filter(Boolean)),
  escalate: k.escalate === "yes",
  spam: /spam|injection/.test(k.notes!),
}));
const s = scoreTags(expected, accepted);
const { misses, ...summary } = s;
console.log(summary);
for (const m of misses) console.log(`${m.review_id}: ${m.note ?? ""} missing=${JSON.stringify(m.missing)} extra=${JSON.stringify(m.extra)}`);
writeFileSync(`data/eval/${file.split("/").pop()!.replace(/\.json$/, "")}-${set}-score.json`, JSON.stringify({ rejected_by_code: rejected.length, ...s }, null, 2));
