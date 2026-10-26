// Scores the AI against the answer key.
//   npm run eval                      tuning set (R001 to R040), Gemini
//   npm run eval -- --model stub      stand-in that replays the key (proves the plumbing)
//   npm run eval -- --set test --final   the SEALED test set. Run only when the instructions are final.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "../src/engine/csv.js";
import { GeminiClient } from "../src/ai/gemini.js";
import { KeyReplayModel, type KeyRow } from "../src/ai/stub.js";
import { tagBatch, type BatchReview } from "../src/ai/tagger.js";
import { scoreTags, type Expected } from "../src/ai/score.js";
import type { TagResult } from "../src/engine/tags.js";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1]! : dflt);
const set = opt("set", "tuning");
const modelName = opt("model", "gemini");
if (set === "test" && !args.includes("--final")) {
  console.error("The test set is sealed. It is only for the final measurement. Add --final if the instructions are done.");
  process.exit(1);
}

function table(path: string) {
  const [head, ...rows] = parseCsv(readFileSync(path, "utf8"));
  return rows.map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i] ?? ""])) as Record<string, string>);
}
const reviews = new Map(table("data/sample/reviews.csv").map((r) => [r.review_id!, r]));
const key = table("data/sample/answer_key.csv").filter((k) => k.set === set);

let model;
if (modelName === "stub") model = new KeyReplayModel(key as unknown as KeyRow[]);
else {
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in .env");
  model = new GeminiClient(process.env.GEMINI_API_KEY, opt("gemini-model", "gemini-2.5-flash"));
}

const expected: Expected[] = key.map((k) => ({
  review_id: k.review_id!,
  tags: new Set(/spam|injection/.test(k.notes!) ? [] : k.themes!.split("|").filter(Boolean)),
  escalate: k.escalate === "yes",
  spam: /spam|injection/.test(k.notes!),
}));

const got: TagResult[] = [];
let rejected = 0;
for (let i = 0; i < key.length; i += 20) {
  const batch: BatchReview[] = key.slice(i, i + 20).map((k) => ({ review_id: k.review_id!, rating: Number(reviews.get(k.review_id!)!.rating) || null, text: reviews.get(k.review_id!)!.text! }));
  console.log(`Tagging ${batch[0]!.review_id} to ${batch[batch.length - 1]!.review_id} with ${model.name}...`);
  const r = await tagBatch(model, batch);
  got.push(...r.accepted);
  rejected += r.rejected.length;
  for (const x of r.rejected) console.log(`  rejected by code: ${x.review_id}: ${x.problem}`);
}

const score = scoreTags(expected, got);
const { misses, ...summary } = score;
console.log("\nRESULT", model.name, `(${set} set)`);
console.log(summary);
for (const m of misses) console.log(`  ${m.review_id}: ${m.note ?? ""} missing=${JSON.stringify(m.missing)} extra=${JSON.stringify(m.extra)}`);
const out = `data/eval/${modelName}-${set}-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(out, JSON.stringify({ model: model.name, set, rejected_by_code: rejected, ...score }, null, 2));
console.log(`Saved ${out}`);
