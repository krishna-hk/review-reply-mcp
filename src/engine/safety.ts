export type Lane = "skip" | "spam" | "restricted" | "rating_only" | "normal";

export type EscalationCategory = "health_safety" | "legal_threat" | "discrimination" | "fraud" | "other_serious";

export interface LaneInput {
  text: string;
  rating: number | null;
  escalation?: EscalationCategory | null;
  spam?: boolean;
}

/** Decides what happens to a review in v1 (see docs/ANALYTICS_AND_ESCALATION.md, section 8). */
export function laneFor(r: LaneInput): Lane {
  if (r.text.trim() === "" && r.rating === null) return "skip";
  if (r.spam) return "spam";
  if (r.escalation) return "restricted";
  if (r.text.trim() === "") return "rating_only";
  return "normal";
}

export const RESTRICTED_TARGET_HOURS = 12;

export function hoursWaiting(flaggedAt: string | Date, now: string | Date = new Date()): number {
  const ms = new Date(now).getTime() - new Date(flaggedAt).getTime();
  return Math.max(0, Math.floor(ms / 3_600_000));
}

export function isOverdue(flaggedAt: string | Date, now: string | Date = new Date(), targetHours = RESTRICTED_TARGET_HOURS): boolean {
  return hoursWaiting(flaggedAt, now) >= targetHours;
}

/** Bulk approve is for normal lane drafts on 4 and 5 star reviews only. */
export function canBulkApprove(d: { lane: Lane; rating: number | null; restricted: boolean }): boolean {
  return d.lane === "normal" && !d.restricted && d.rating !== null && d.rating >= 4;
}

export interface DraftCheckInput {
  draft: string;
  lane: Lane;
  reviewText: string;
  neverSay?: string[];
  /** Phone numbers, emails and links the owner has put in their profile. */
  allowedContacts?: string[];
  maxLength?: number;
}

export interface DraftCheck {
  ok: boolean;
  problems: string[];
}

const PROMISE_PATTERNS: [RegExp, string][] = [
  [/\b(full|complete|a)\s+refund\b|\brefund(ed)?\s+(you|your|in full)\b|\bwe(?:'ll| will)\s+refund\b/i, "promises a refund"],
  [/\b(free|complimentary)\s+(meal|dinner|lunch|dessert|drink|order|year)\b/i, "promises something free"],
  [/\b(compensat|reimburs)/i, "promises compensation"],
  [/\bguarantee/i, "makes a guarantee"],
];

const ADMISSION_PATTERNS: [RegExp, string][] = [
  [/\b(our|my) fault\b|\bwe (admit|accept (full )?(blame|responsibility|liability))\b|\bliable\b|\bnegligen/i, "admits fault or liability"],
];

const norm = (s: string) => s.toLowerCase();

function extractContacts(text: string): string[] {
  const phones = text.match(/\+?\d[\d\s().-]{6,}\d/g) ?? [];
  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
  const links = text.match(/https?:\/\/\S+|www\.\S+/gi) ?? [];
  return [...phones, ...emails, ...links].map((c) => c.trim().replace(/[.,;]+$/, ""));
}

function extractAmounts(text: string): string[] {
  return (text.match(/[$£€]\s?\d[\d,.]*|\d+(?:\.\d+)?\s?%|\b\d+\s?(?:dollars|pounds|euros)\b/gi) ?? []).map((a) => a.replace(/\s/g, "").toLowerCase());
}

/** Code-side checks run on every draft before it is saved. Returns the exact rules broken. */
export function checkDraft(input: DraftCheckInput): DraftCheck {
  const problems: string[] = [];
  const { draft, lane } = input;
  if (lane === "skip" || lane === "spam") return { ok: false, problems: [`no reply is written for the "${lane}" lane`] };
  if (draft.trim() === "") problems.push("draft is empty");
  if (draft.length > (input.maxLength ?? 700)) problems.push(`draft is longer than ${input.maxLength ?? 700} characters`);

  for (const phrase of input.neverSay ?? []) {
    if (phrase.trim() && norm(draft).includes(norm(phrase))) problems.push(`uses a phrase the owner never wants said: "${phrase}"`);
  }
  for (const [re, label] of PROMISE_PATTERNS) if (re.test(draft)) problems.push(label);
  if (lane === "restricted") for (const [re, label] of ADMISSION_PATTERNS) if (re.test(draft)) problems.push(label);

  const known = new Set([...(input.allowedContacts ?? []), ...extractContacts(input.reviewText)].map(norm));
  for (const c of extractContacts(draft)) if (!known.has(norm(c))) problems.push(`contains a contact detail that is not in the owner's profile or the review: "${c}"`);

  const knownAmounts = new Set(extractAmounts(input.reviewText));
  for (const a of extractAmounts(draft)) if (!knownAmounts.has(a)) problems.push(`mentions an amount or discount not in the review: "${a}"`);

  return { ok: problems.length === 0, problems };
}
