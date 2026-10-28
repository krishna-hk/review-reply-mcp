// Compares the AI's tags with a person's labels, strictly and leniently, and lists every disagreement.
//   npx tsx scripts/compare-labels.ts <ai-answers.json> --dir data/sample/app --preset app_feedback
// Strict: theme and sentiment must both match. Lenient: only the theme has to match.
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/engine/csv.js";
import { parseJson } from "../src/ai/tagger.js";
import { validateTagOutput } from "../src/engine/tags.js";
import { presetByKey } from "../src/engine/presets.js";
import { themeNames } from "../src/engine/themes.js";

const args = process.argv.slice(2);
const file = args[0];
const opt = (n: string, d: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1]! : d);
if (!file) throw new Error("Usage: compare-labels.ts <answers.json> [--dir data/sample/app] [--preset app_feedback]");
const dir = opt("dir", "data/sample/app");
const preset = presetByKey(opt("preset", "app_feedback"));
if (!preset) throw new Error("Unknown --preset");
const table = (p: string) => {
  const [h, ...r] = parseCsv(readFileSync(p, "utf8"));
  return r.map((x) => Object.fromEntries(h!.map((k, i) => [k, x[i] ?? ""])) as Record<string, string>);
};
const reviews = new Map(table(`${dir}/reviews.csv`).map((r) => [r.review_id!, r]));
const key = table(`${dir}/answer_key.csv`).filter((k) => (reviews.get(k.review_id!)?.text ?? "").trim() !== "");
const batch = key.map((k) => ({ review_id: k.review_id!, text: reviews.get(k.review_id!)!.text! }));
const { accepted, rejected } = validateTagOutput(parseJson(readFileSync(file, "utf8")), batch, themeNames(preset.themes));
for (const r of rejected) console.log(`rejected by code: ${r.review_id}: ${r.problem}`);
const got = new Map(accepted.map((g) => [g.review_id, g]));

const f1 = (tp: number, fp: number, fn: number) => {
  const p = tp + fp ? tp / (tp + fp) : 1, r = tp + fn ? tp / (tp + fn) : 1;
  return p + r ? Math.round((2 * p * r) / (p + r) * 1000) / 10 : 0;
};
let sTp = 0, sFp = 0, sFn = 0, lTp = 0, lFp = 0, lFn = 0;
let spamKey = 0, spamHit = 0, spamFalse = 0, serKey = 0, serHit = 0, serFalse = 0;
const lines: string[] = [];
for (const k of key) {
  const g = got.get(k.review_id!);
  if (!g) continue;
  const spamK = /spam|injection/.test(k.notes!);
  if (spamK) spamKey++;
  if (spamK && g.spam) spamHit++;
  if (!spamK && g.spam) spamFalse++;
  const serK = k.escalate === "yes";
  if (serK) serKey++;
  if (serK && g.escalate) serHit++;
  if (!serK && g.escalate) serFalse++;
  const hari = new Set(spamK ? [] : k.themes!.split("|").filter(Boolean));
  const ai = new Set(g.spam ? [] : g.tags.map((t) => `${t.theme}:${t.sentiment}`));
  const hit = [...hari].filter((t) => ai.has(t));
  sTp += hit.length; sFn += hari.size - hit.length; sFp += ai.size - hit.length;
  const th = (s: Set<string>) => new Set([...s].map((t) => t.split(":")[0]!));
  const [hT, aT] = [th(hari), th(ai)];
  const lHit = [...hT].filter((t) => aT.has(t)).length;
  lTp += lHit; lFn += hT.size - lHit; lFp += aT.size - lHit;
  const flags = [serK !== !!g.escalate ? `SERIOUS hari=${serK ? "yes" : "no"} ai=${g.escalate ?? "no"}` : "", spamK !== g.spam ? `SPAM hari=${spamK} ai=${g.spam}` : ""].filter(Boolean).join(" ");
  if (hit.length !== hari.size || ai.size !== hari.size || flags)
    lines.push(`${k.review_id} "${reviews.get(k.review_id!)!.text!.slice(0, 90)}"\n   hari: ${[...hari].join(", ") || "-"}\n   ai:   ${[...ai].join(", ") || "-"}${g.spam ? " (spam)" : ""}${flags ? `\n   ${flags}` : ""}`);
}
console.log(`reviews scored: ${key.length}`);
console.log(`tag F1 strict (theme + sentiment): ${f1(sTp, sFp, sFn)}%   lenient (theme only): ${f1(lTp, lFp, lFn)}%`);
console.log(`serious: hari flagged ${serKey}, ai caught ${serHit}, ai extra ${serFalse}`);
console.log(`spam/injection: hari flagged ${spamKey}, ai caught ${spamHit}, ai extra ${spamFalse}`);
console.log(`\n${lines.length} reviews differ:\n`);
console.log(lines.join("\n"));
