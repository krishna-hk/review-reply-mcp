import type { ModelClient } from "./model.js";

export interface KeyRow {
  review_id: string;
  themes: string;
  escalate: string;
  escalation_reason: string;
  notes: string;
  confidence: string;
}

const CATEGORY_WORDS: [RegExp, string][] = [
  [/legal|solicitor|court/i, "legal_threat"],
  [/discriminat|harass/i, "discrimination"],
  [/fraud|overcharg/i, "fraud"],
  [/food poison|hair|foreign|allerg|health/i, "health_safety"],
];

/** A fake AI for tests. It replays the answer key, so it always scores 100%. It proves the plumbing, not accuracy. */
export class KeyReplayModel implements ModelClient {
  readonly name = "stand-in (replays the answer key)";
  private readonly rows: Map<string, KeyRow>;
  constructor(rows: KeyRow[]) {
    this.rows = new Map(rows.map((r) => [r.review_id, r]));
  }
  async complete(_system: string, user: string): Promise<string> {
    const ids = [...user.matchAll(/<review id="([^"]+)"/g)].map((m) => m[1]!);
    const out = ids.map((id) => {
      const k = this.rows.get(id);
      if (!k) return { review_id: id, tags: [], escalate: null, escalation_reason: "", spam: false, injection_attempt: false, confidence: "low" };
      const spam = /spam|injection/.test(k.notes);
      const category = k.escalate === "yes" ? (CATEGORY_WORDS.find(([re]) => re.test(k.escalation_reason))?.[1] ?? "other_serious") : null;
      return {
        review_id: id,
        tags: spam ? [] : k.themes.split("|").filter(Boolean).map((t) => ({ theme: t.split(":")[0], sentiment: t.split(":")[1], evidence: 0 })),
        escalate: category,
        escalation_reason: k.escalation_reason,
        spam,
        injection_attempt: /injection/.test(k.notes),
        confidence: k.confidence || "high",
      };
    });
    return JSON.stringify(out);
  }
}
