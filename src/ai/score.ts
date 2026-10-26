import type { TagResult } from "../engine/tags.js";

export interface Expected {
  review_id: string;
  tags: Set<string>; // "Theme:sentiment"
  escalate: boolean;
  spam: boolean;
}

export interface Score {
  reviews: number;
  tag_precision: number;
  tag_recall: number;
  tag_f1: number;
  reviews_exact: number;
  escalation_recall: number | null;
  escalation_false_alarms: number;
  spam_recall: number | null;
  spam_false_alarms: number;
  not_returned: number;
  misses: { review_id: string; missing: string[]; extra: string[]; note?: string }[];
}

const pct = (n: number) => Math.round(n * 1000) / 10;

export function scoreTags(expected: Expected[], got: TagResult[]): Score {
  const byId = new Map(got.map((g) => [g.review_id, g]));
  let tp = 0, fp = 0, fn = 0, exact = 0, escHit = 0, escTotal = 0, escFalse = 0, spamHit = 0, spamTotal = 0, spamFalse = 0, missing = 0;
  const misses: Score["misses"] = [];
  for (const e of expected) {
    const g = byId.get(e.review_id);
    if (!g) {
      missing++;
      continue;
    }
    // Spam reviews are scored on the spam flag, not on tags.
    if (!e.spam) {
      const mine = new Set(g.tags.map((t) => `${t.theme}:${t.sentiment}`));
      const hit = [...e.tags].filter((t) => mine.has(t));
      tp += hit.length;
      fn += e.tags.size - hit.length;
      fp += mine.size - hit.length;
      if (hit.length === e.tags.size && mine.size === e.tags.size) exact++;
      else misses.push({ review_id: e.review_id, missing: [...e.tags].filter((t) => !mine.has(t)), extra: [...mine].filter((t) => !e.tags.has(t)) });
    } else exact += g.spam ? 1 : 0;
    if (e.escalate) {
      escTotal++;
      if (g.escalate) escHit++;
      else misses.push({ review_id: e.review_id, missing: [], extra: [], note: "SERIOUS REVIEW NOT FLAGGED" });
    } else if (g.escalate) escFalse++;
    if (e.spam) {
      spamTotal++;
      if (g.spam) spamHit++;
      else misses.push({ review_id: e.review_id, missing: [], extra: [], note: "SPAM OR INJECTION NOT CAUGHT" });
    } else if (g.spam) spamFalse++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    reviews: expected.length,
    tag_precision: pct(precision),
    tag_recall: pct(recall),
    tag_f1: pct(f1),
    reviews_exact: pct(exact / Math.max(1, expected.length - missing)),
    escalation_recall: escTotal ? pct(escHit / escTotal) : null,
    escalation_false_alarms: escFalse,
    spam_recall: spamTotal ? pct(spamHit / spamTotal) : null,
    spam_false_alarms: spamFalse,
    not_returned: missing,
    misses,
  };
}
