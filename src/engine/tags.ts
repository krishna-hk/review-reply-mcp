import { isTheme, type Sentiment, type Theme } from "./themes.js";
import type { EscalationCategory } from "./safety.js";
import { splitSentences } from "./quotes.js";

export const ESCALATION_CATEGORIES: readonly EscalationCategory[] = ["health_safety", "legal_threat", "discrimination", "fraud", "other_serious"];

export interface TagResult {
  review_id: string;
  tags: { theme: Theme; sentiment: Sentiment; evidence?: number }[];
  escalate: EscalationCategory | null;
  escalation_reason: string;
  spam: boolean;
  injection_attempt: boolean;
  confidence: "high" | "medium" | "low";
}

export interface Rejected {
  review_id: string;
  problem: string;
}

/**
 * Checks what the AI returned for a batch, in code. Anything invalid is rejected with the exact rule broken,
 * so the AI can fix it. Nothing from the AI is trusted until it passes here.
 */
export function validateTagOutput(raw: unknown, batch: { review_id: string; text: string }[]): { accepted: TagResult[]; rejected: Rejected[] } {
  const accepted: TagResult[] = [];
  const rejected: Rejected[] = [];
  const texts = new Map(batch.map((b) => [b.review_id, b.text]));
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  for (const item of list) {
    const o = (item ?? {}) as Record<string, unknown>;
    const id = typeof o.review_id === "string" ? o.review_id : "";
    if (!texts.has(id)) {
      rejected.push({ review_id: id || "(missing)", problem: "review_id is not in this batch" });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ review_id: id, problem: "review appears twice" });
      continue;
    }
    seen.add(id);
    const problems: string[] = [];
    const spam = o.spam === true;
    const tags: TagResult["tags"] = [];
    const used = new Set<string>();
    for (const t of Array.isArray(o.tags) ? o.tags : []) {
      const tt = (t ?? {}) as Record<string, unknown>;
      const theme = String(tt.theme ?? "");
      const sentiment = String(tt.sentiment ?? "");
      if (!isTheme(theme)) {
        problems.push(`unknown theme "${theme}"`);
        continue;
      }
      if (sentiment !== "positive" && sentiment !== "negative") {
        problems.push(`sentiment for ${theme} must be positive or negative, not "${sentiment}"`);
        continue;
      }
      if (used.has(theme)) {
        problems.push(`theme "${theme}" is used twice; use one overall sentiment`);
        continue;
      }
      used.add(theme);
      const count = splitSentences(texts.get(id)!).length;
      const ev = typeof tt.evidence === "number" && Number.isInteger(tt.evidence) && tt.evidence >= 0 && tt.evidence < Math.max(1, count) ? tt.evidence : undefined;
      tags.push({ theme, sentiment, ...(ev !== undefined ? { evidence: ev } : {}) });
    }
    const escalate = o.escalate === null || o.escalate === undefined || o.escalate === "" ? null : String(o.escalate);
    if (escalate !== null && !(ESCALATION_CATEGORIES as readonly string[]).includes(escalate)) problems.push(`unknown escalation category "${escalate}"`);
    if (problems.length) {
      rejected.push({ review_id: id, problem: problems.join("; ") });
      continue;
    }
    // Spam is automatically Other negative and never escalated (labelling guide rule 17).
    const finalTags: TagResult["tags"] = spam ? [{ theme: "Other", sentiment: "negative" }] : tags;
    const confidence = o.confidence === "low" || o.confidence === "medium" ? o.confidence : "high";
    accepted.push({
      review_id: id,
      tags: finalTags,
      escalate: spam ? null : (escalate as EscalationCategory | null),
      escalation_reason: spam || escalate === null ? "" : String(o.escalation_reason ?? ""),
      spam,
      injection_attempt: spam && o.injection_attempt === true,
      confidence,
    });
  }
  for (const b of batch) if (!seen.has(b.review_id)) rejected.push({ review_id: b.review_id, problem: "no result returned for this review" });
  return { accepted, rejected };
}
