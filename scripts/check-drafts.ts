// Runs the code checks on a file of drafts and prints them for a human to read.
//   npx tsx scripts/check-drafts.ts <requests.json> <drafts.json>
import { readFileSync } from "node:fs";
import { parseJson } from "../src/ai/tagger.js";
import { checkDraft } from "../src/engine/safety.js";
import type { BusinessProfile } from "../src/engine/profile.js";
import type { DraftRequest } from "../src/ai/drafter.js";

const [reqFile, outFile] = process.argv.slice(2);
if (!reqFile || !outFile) throw new Error("Usage: check-drafts.ts <requests.json> <drafts.json>");
const profile = JSON.parse(readFileSync("data/sample/business_profile.json", "utf8")) as BusinessProfile;
const reqs = JSON.parse(readFileSync(reqFile, "utf8")) as DraftRequest[];
const drafts = (parseJson(readFileSync(outFile, "utf8")) as { review_id: string; draft_text: string; note?: string }[]) ?? [];
let failed = 0, ok = 0;
for (const r of reqs) {
  const d = drafts.find((x) => x.review_id === r.review_id);
  const text = d?.draft_text?.trim() ?? "";
  if (r.lane === "spam" || r.lane === "skip") {
    const good = text === "";
    console.log(`${r.review_id} [${r.lane}] ${good ? "OK, no draft" : "FAIL, wrote a draft: " + text}`);
    good ? ok++ : failed++;
    continue;
  }
  const c = checkDraft({ draft: text, lane: r.lane, reviewText: r.text, neverSay: profile.never_say, allowedContacts: profile.contact ? [profile.contact] : [] });
  console.log(`${r.review_id} [${r.lane}, ${r.rating ?? "no"} stars] ${c.ok ? "OK" : "FAIL: " + c.problems.join("; ")}\n  review: ${r.text.slice(0, 110)}\n  draft:  ${text}${d?.note ? `\n  note:   ${d.note}` : ""}`);
  c.ok ? ok++ : failed++;
}
console.log(`\n${ok} passed the code checks, ${failed} failed, of ${reqs.length}`);
