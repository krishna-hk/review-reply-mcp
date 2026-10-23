import { parseCsv } from "./csv.js";

export interface Review {
  review_id: string;
  source: string;
  rating: number | null;
  text: string;
  review_date: string | null;
  language: "en" | "other";
  author_name: string;
  existing_owner_reply: string;
  fingerprint: string;
}

export interface ImportOptions {
  source?: string;
  /** Maps our field name to the file's column header, for unusual files. */
  columnMap?: Partial<Record<FieldName, string>>;
  maxRows?: number;
  maxReviewsPerOwner?: number;
  existingReviewCount?: number;
  existingFingerprints?: ReadonlySet<string>;
  /** How to read dates like 03/04/2026. Defaults to month first and warns. */
  dateOrder?: "dmy" | "mdy";
}

export interface RowProblem {
  /** Line number in the file; the header is line 1. */
  row: number;
  reason: "empty" | "over-row-limit" | "over-owner-limit" | "duplicate";
  message: string;
}

export interface ImportResult {
  reviews: Review[];
  skipped: RowProblem[];
  rejected: RowProblem[];
  warnings: string[];
  summary: string;
}

export type FieldName = "review_id" | "source" | "rating" | "text" | "review_date" | "author_name" | "existing_owner_reply";

const ALIASES: Record<FieldName, string[]> = {
  review_id: ["review_id", "id", "reviewid"],
  source: ["source", "platform"],
  rating: ["rating", "stars", "star_rating", "score"],
  text: ["text", "review", "comment", "review_text", "content", "body", "feedback"],
  review_date: ["review_date", "date", "time", "created", "created_at", "posted", "timestamp"],
  author_name: ["author_name", "author", "reviewer", "name", "user"],
  existing_owner_reply: ["existing_owner_reply", "owner_reply", "response", "reply", "owner_response"],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");

export class ImportError extends Error {}

function mapColumns(header: string[], columnMap: ImportOptions["columnMap"]): Partial<Record<FieldName, number>> {
  const normalised = header.map(norm);
  const found: Partial<Record<FieldName, number>> = {};
  for (const field of Object.keys(ALIASES) as FieldName[]) {
    const wanted = columnMap?.[field];
    const idx = wanted !== undefined ? normalised.indexOf(norm(wanted)) : normalised.findIndex((h) => ALIASES[field].includes(h));
    if (idx >= 0) found[field] = idx;
  }
  return found;
}

function parseRating(raw: string): number | null | "bad" {
  const t = raw.trim();
  if (t === "") return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(?:\/\s*5|stars?)?$/i);
  if (!m) return "bad";
  const n = Math.round(Number(m[1]));
  return n >= 1 && n <= 5 ? n : "bad";
}

function parseDate(raw: string, order: "dmy" | "mdy", state: { ambiguous: boolean }): string | null {
  const t = raw.trim();
  if (t === "") return null;
  let y: number, mo: number, d: number;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s.*)?$/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    y = Number(m[3]);
    if (a <= 12 && b <= 12 && a !== b) state.ambiguous = true;
    [d, mo] = order === "dmy" ? [a, b] : [b, a];
  } else return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

const collapse = (s: string) => s.trim().replace(/\s+/g, " ");

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function looksEnglish(text: string): boolean {
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (letters.length === 0) return true;
  const nonLatin = letters.filter((c) => c.charCodeAt(0) > 0x24f).length;
  return nonLatin / letters.length < 0.3;
}

export async function importReviews(csvText: string, opts: ImportOptions = {}): Promise<ImportResult> {
  const maxRows = opts.maxRows ?? 200;
  const maxPerOwner = opts.maxReviewsPerOwner ?? 2000;
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new ImportError("The file is empty. Add a header row and at least one review.");
  const header = rows[0]!;
  const cols = mapColumns(header, opts.columnMap);
  if (cols.text === undefined && cols.rating === undefined) {
    throw new ImportError(
      "I could not find a column with the review text or the star rating. Rename a column to 'text' or 'rating', or tell me which column to use.",
    );
  }
  const get = (r: string[], f: FieldName) => (cols[f] === undefined ? "" : (r[cols[f]!] ?? ""));

  const reviews: Review[] = [];
  const skipped: RowProblem[] = [];
  const rejected: RowProblem[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>(opts.existingFingerprints ?? []);
  const dateState = { ambiguous: false };
  const dateOrder = opts.dateOrder ?? "mdy";
  let badRatings = 0;
  let badDates = 0;
  let nonEnglish = 0;
  let owned = opts.existingReviewCount ?? 0;

  const body = rows.slice(1);
  for (let i = 0; i < body.length; i++) {
    const r = body[i]!;
    const row = i + 2;
    if (i >= maxRows) {
      rejected.push({ row, reason: "over-row-limit", message: `Only the first ${maxRows} rows can be added per import.` });
      continue;
    }
    const text = get(r, "text").trim();
    const ratingParsed = parseRating(get(r, "rating"));
    const rating = ratingParsed === "bad" ? null : ratingParsed;
    if (ratingParsed === "bad") badRatings++;
    if (text === "" && rating === null) {
      rejected.push({ row, reason: "empty", message: "No review text and no star rating, so there is nothing to reply to." });
      continue;
    }
    if (owned >= maxPerOwner) {
      rejected.push({ row, reason: "over-owner-limit", message: `The limit of ${maxPerOwner} reviews is reached.` });
      continue;
    }
    const dateRaw = get(r, "review_date");
    const review_date = parseDate(dateRaw, dateOrder, dateState);
    if (dateRaw.trim() !== "" && review_date === null) badDates++;
    const author_name = get(r, "author_name").trim();
    const fingerprint = await sha256(
      [collapse(text).toLowerCase(), review_date ?? "", author_name.toLowerCase(), text === "" ? String(rating) : ""].join("|"),
    );
    if (seen.has(fingerprint)) {
      skipped.push({ row, reason: "duplicate", message: "Same text, date and author as a review already added." });
      continue;
    }
    seen.add(fingerprint);
    const english = looksEnglish(text);
    if (!english) nonEnglish++;
    owned++;
    reviews.push({
      review_id: get(r, "review_id").trim() || `rv_${fingerprint.slice(0, 12)}`,
      source: get(r, "source").trim() || opts.source || "csv-upload",
      rating,
      text,
      review_date,
      language: english ? "en" : "other",
      author_name,
      existing_owner_reply: get(r, "existing_owner_reply").trim(),
      fingerprint,
    });
  }

  if (dateState.ambiguous && opts.dateOrder === undefined)
    warnings.push("Some dates like 03/04/2026 could be read two ways. I read them month first. Tell me if your file is day first.");
  if (badRatings > 0) warnings.push(`${badRatings} rating(s) were not a number from 1 to 5 and were left blank.`);
  if (badDates > 0) warnings.push(`${badDates} date(s) could not be read and were left blank.`);
  if (nonEnglish > 0) warnings.push(`${nonEnglish} review(s) do not look like English. Version 1 supports English only.`);

  const summary =
    `Added ${reviews.length}, skipped ${skipped.length} duplicate(s), rejected ${rejected.length}.` +
    (rejected.length ? ` Reasons: ${[...new Set(rejected.map((p) => p.reason))].join(", ")}.` : "");
  return { reviews, skipped, rejected, warnings, summary };
}
