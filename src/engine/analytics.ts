import { groupOf, type Sentiment, type Theme, UMBRELLA_GROUPS } from "./themes.js";
import { isExactQuote, pickQuote } from "./quotes.js";

export interface TaggedReview {
  review_id: string;
  rating: number | null;
  text: string;
  review_date: string | null;
  tags: { theme: Theme; sentiment: Sentiment }[];
  lane?: "normal" | "restricted" | "spam";
}

export interface Counts {
  positive: number;
  negative: number;
}

/** Minimum mentions in a period before we call anything a trend. */
export const MIN_MENTIONS_FOR_TREND = 5;

export function countByTheme(reviews: TaggedReview[]): Map<Theme, Counts> {
  const out = new Map<Theme, Counts>();
  for (const r of reviews) {
    if (r.lane === "spam") continue;
    for (const t of r.tags) {
      const c = out.get(t.theme) ?? { positive: 0, negative: 0 };
      c[t.sentiment]++;
      out.set(t.theme, c);
    }
  }
  return out;
}

export function countByGroup(reviews: TaggedReview[]): Record<string, Counts> {
  const out: Record<string, Counts> = Object.fromEntries(Object.keys(UMBRELLA_GROUPS).map((g) => [g, { positive: 0, negative: 0 }]));
  for (const [theme, c] of countByTheme(reviews)) {
    const g = groupOf(theme);
    if (!g) continue;
    out[g]!.positive += c.positive;
    out[g]!.negative += c.negative;
  }
  return out;
}

export type Direction = "rising" | "falling" | "steady" | "not enough data";

/** Compares negative mentions of one theme between two periods. */
export function trend(current: number, previous: number): Direction {
  if (Math.max(current, previous) < MIN_MENTIONS_FOR_TREND) return "not enough data";
  const diff = current - previous;
  const threshold = Math.max(2, Math.ceil(previous * 0.25));
  if (diff >= threshold) return "rising";
  if (-diff >= threshold) return "falling";
  return "steady";
}

export interface Period {
  from: string; // inclusive, YYYY-MM-DD
  to: string; // inclusive
}

export function inPeriod(r: { review_date: string | null }, p: Period): boolean {
  return r.review_date !== null && r.review_date >= p.from && r.review_date <= p.to;
}

export interface DigestTheme {
  theme: Theme;
  mentions: number;
  quotes: { review_id: string; quote: string }[];
  trend: Direction;
}

export interface DigestData {
  total_reviews: number;
  rated_reviews: number;
  average_rating: number | null;
  top_praised: DigestTheme[];
  top_criticised: DigestTheme[];
  groups: Record<string, Counts>;
  waiting_for_owner: number;
  spam_ignored: number;
}

function topThemes(reviews: TaggedReview[], previous: TaggedReview[], sentiment: Sentiment, limit: number): DigestTheme[] {
  const now = countByTheme(reviews);
  const before = countByTheme(previous);
  return [...now.entries()]
    .filter(([, c]) => c[sentiment] > 0)
    .sort((a, b) => b[1][sentiment] - a[1][sentiment] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([theme, c]) => {
      const quotes: DigestTheme["quotes"] = [];
      for (const r of reviews) {
        if (quotes.length >= 2) break;
        if (r.lane === "spam" || !r.tags.some((t) => t.theme === theme && t.sentiment === sentiment)) continue;
        const quote = pickQuote(r.text);
        if (quote && isExactQuote(r.text, quote)) quotes.push({ review_id: r.review_id, quote });
      }
      return { theme, mentions: c[sentiment], quotes, trend: previous.length === 0 ? "not enough data" : trend(c[sentiment], before.get(theme)?.[sentiment] ?? 0) };
    });
}

export function buildDigest(reviews: TaggedReview[], previous: TaggedReview[] = [], limit = 3): DigestData {
  const real = reviews.filter((r) => r.lane !== "spam");
  const rated = real.filter((r) => r.rating !== null);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null;
  return {
    total_reviews: real.length,
    rated_reviews: rated.length,
    average_rating: avg === null ? null : Math.round(avg * 100) / 100,
    top_praised: topThemes(real, previous, "positive", limit),
    top_criticised: topThemes(real, previous, "negative", limit),
    groups: countByGroup(real),
    waiting_for_owner: reviews.filter((r) => r.lane === "restricted").length,
    spam_ignored: reviews.filter((r) => r.lane === "spam").length,
  };
}
