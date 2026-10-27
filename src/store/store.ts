import type { Row, SqlDb, SqlValue, Stmt } from "./sql.js";
import type { Review } from "../engine/importer.js";
import type { BusinessProfile } from "../engine/profile.js";
import type { TaggedReview } from "../engine/analytics.js";
import type { TagResult } from "../engine/tags.js";
import type { EscalationCategory, Lane } from "../engine/safety.js";
import { laneFor } from "../engine/safety.js";
import type { Sentiment, Theme } from "../engine/themes.js";

export interface StoredReview {
  review_id: string;
  source: string;
  rating: number | null;
  text: string;
  review_date: string | null;
  author_name: string;
  existing_owner_reply: string;
}

export interface FlagRow {
  review_id: string;
  lane: "normal" | "restricted" | "spam";
  category: string | null;
  reason: string | null;
  flagged_at: string;
  closed_at: string | null;
}

export interface DraftRow {
  review_id: string;
  draft_text: string;
  restricted: boolean;
  status: "pending" | "approved" | "edited" | "rejected";
  edited_text: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface FixRow {
  fix_id: string;
  theme: string;
  description: string;
  date_done: string;
}

/** Every method is scoped to one owner. There is no way to read another owner's rows through this class. */
export class Store {
  constructor(
    private readonly db: SqlDb,
    readonly ownerId: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** Creates the owner record if it does not exist. Call once after constructing. */
  async init(): Promise<this> {
    await this.run("INSERT OR IGNORE INTO owners (owner_id, created_at) VALUES (?, ?)", this.ownerId, this.now());
    return this;
  }

  private all(sql: string, ...params: SqlValue[]): Promise<Row[]> {
    return this.db.all(sql, params);
  }
  private async one(sql: string, ...params: SqlValue[]): Promise<Row | undefined> {
    return (await this.db.all(sql, params))[0];
  }
  private run(sql: string, ...params: SqlValue[]) {
    return this.db.run(sql, params);
  }
  private batch(stmts: Stmt[]) {
    return this.db.batch(stmts);
  }

  // ---- profile
  async getProfile(): Promise<BusinessProfile | null> {
    const r = await this.one("SELECT * FROM business_profiles WHERE owner_id = ?", this.ownerId);
    if (!r) return null;
    return {
      business_name: String(r.business_name),
      ...(r.business_type ? { business_type: String(r.business_type) } : {}),
      ...(r.tone ? { tone: String(r.tone) } : {}),
      ...(r.signature ? { signature: String(r.signature) } : {}),
      ...(r.contact ? { contact: String(r.contact) } : {}),
      policies: JSON.parse(String(r.policies)),
      never_say: JSON.parse(String(r.never_say)),
      languages: JSON.parse(String(r.languages)),
    };
  }
  async saveProfile(p: BusinessProfile) {
    await this.run(
      `INSERT INTO business_profiles (owner_id, business_name, business_type, tone, signature, contact, policies, never_say, languages, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_id) DO UPDATE SET business_name = excluded.business_name, business_type = excluded.business_type, tone = excluded.tone,
         signature = excluded.signature, contact = excluded.contact, policies = excluded.policies, never_say = excluded.never_say,
         languages = excluded.languages, updated_at = excluded.updated_at`,
      this.ownerId, p.business_name, p.business_type ?? null, p.tone ?? null, p.signature ?? null, p.contact ?? null,
      JSON.stringify(p.policies), JSON.stringify(p.never_say), JSON.stringify(p.languages), this.now(),
    );
  }

  // ---- reviews
  async reviewCount(): Promise<number> {
    return Number((await this.one("SELECT COUNT(*) AS n FROM reviews WHERE owner_id = ?", this.ownerId))!.n);
  }
  async realReviewCount(): Promise<number> {
    return Number((await this.one("SELECT COUNT(*) AS n FROM reviews WHERE owner_id = ? AND source != 'demo'", this.ownerId))!.n);
  }
  async fingerprints(): Promise<Set<string>> {
    return new Set((await this.all("SELECT fingerprint FROM reviews WHERE owner_id = ?", this.ownerId)).map((r) => String(r.fingerprint)));
  }
  /** Adds reviews all together, skipping repeats. Returns how many were new. */
  async addReviews(reviews: Review[]): Promise<number> {
    const before = await this.reviewCount();
    const at = this.now();
    await this.batch(
      reviews.map((r) => ({
        sql: `INSERT OR IGNORE INTO reviews (owner_id, review_id, source, rating, text, review_date, language, author_name, existing_owner_reply, fingerprint, imported_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [this.ownerId, r.review_id, r.source, r.rating, r.text, r.review_date, r.language, r.author_name, r.existing_owner_reply, r.fingerprint, at],
      })),
    );
    return (await this.reviewCount()) - before;
  }
  private toReview(r: Row): StoredReview {
    return {
      review_id: String(r.review_id),
      source: String(r.source),
      rating: r.rating === null ? null : Number(r.rating),
      text: String(r.text),
      review_date: r.review_date === null ? null : String(r.review_date),
      author_name: String(r.author_name),
      existing_owner_reply: String(r.existing_owner_reply),
    };
  }
  async getReview(id: string): Promise<StoredReview | null> {
    const r = await this.one("SELECT * FROM reviews WHERE owner_id = ? AND review_id = ?", this.ownerId, id);
    return r ? this.toReview(r) : null;
  }
  /** Reviews with text that have not been through save_tags yet. */
  async untagged(limit: number): Promise<StoredReview[]> {
    return (
      await this.all(
        `SELECT * FROM reviews r WHERE owner_id = ? AND TRIM(text) != '' AND NOT EXISTS
           (SELECT 1 FROM review_flags f WHERE f.owner_id = r.owner_id AND f.review_id = r.review_id) ORDER BY review_date, review_id LIMIT ?`,
        this.ownerId, limit,
      )
    ).map((r) => this.toReview(r));
  }
  async untaggedCount(): Promise<number> {
    return Number(
      (
        await this.one(
          `SELECT COUNT(*) AS n FROM reviews r WHERE owner_id = ? AND TRIM(text) != '' AND NOT EXISTS
             (SELECT 1 FROM review_flags f WHERE f.owner_id = r.owner_id AND f.review_id = r.review_id)`,
          this.ownerId,
        )
      )!.n,
    );
  }

  // ---- tags and flags
  async saveTags(results: TagResult[]) {
    const at = this.now();
    const stmts: Stmt[] = [];
    for (const t of results) {
      stmts.push({ sql: "DELETE FROM tags WHERE owner_id = ? AND review_id = ?", params: [this.ownerId, t.review_id] });
      for (const g of t.tags) stmts.push({ sql: "INSERT INTO tags VALUES (?, ?, ?, ?, ?)", params: [this.ownerId, t.review_id, g.theme, g.sentiment, at] });
      const lane = t.spam ? "spam" : t.escalate ? "restricted" : "normal";
      const category = t.spam ? (t.injection_attempt ? "injection_attempt" : "spam") : t.escalate;
      stmts.push({
        sql: `INSERT INTO review_flags (owner_id, review_id, lane, category, reason, flagged_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, NULL)
              ON CONFLICT(owner_id, review_id) DO UPDATE SET lane = excluded.lane, category = excluded.category, reason = excluded.reason`,
        params: [this.ownerId, t.review_id, lane, category ?? null, t.escalation_reason || null, at],
      });
    }
    await this.batch(stmts);
  }
  private toFlag(r: Row): FlagRow {
    return { review_id: String(r.review_id), lane: r.lane as FlagRow["lane"], category: (r.category as string | null) ?? null, reason: (r.reason as string | null) ?? null, flagged_at: String(r.flagged_at), closed_at: (r.closed_at as string | null) ?? null };
  }
  async getFlag(id: string): Promise<FlagRow | null> {
    const r = await this.one("SELECT * FROM review_flags WHERE owner_id = ? AND review_id = ?", this.ownerId, id);
    return r ? this.toFlag(r) : null;
  }
  async flags(lane: FlagRow["lane"], openOnly = false): Promise<FlagRow[]> {
    return (await this.all(`SELECT * FROM review_flags WHERE owner_id = ? AND lane = ? ${openOnly ? "AND closed_at IS NULL" : ""} ORDER BY flagged_at`, this.ownerId, lane)).map((r) => this.toFlag(r));
  }
  async closeFlag(id: string) {
    await this.run("UPDATE review_flags SET closed_at = ? WHERE owner_id = ? AND review_id = ?", this.now(), this.ownerId, id);
  }
  async tagsFor(id: string): Promise<{ theme: Theme; sentiment: Sentiment }[]> {
    return (await this.all("SELECT theme, sentiment FROM tags WHERE owner_id = ? AND review_id = ?", this.ownerId, id)).map((r) => ({ theme: r.theme as Theme, sentiment: r.sentiment as Sentiment }));
  }

  /** Reviews with their tags and lanes, for counts. A date window is optional; undated reviews are only included without one. */
  async taggedReviews(from?: string, to?: string): Promise<TaggedReview[]> {
    const dated = from && to ? "AND r.review_date >= ? AND r.review_date <= ?" : "";
    const params: SqlValue[] = from && to ? [this.ownerId, from, to] : [this.ownerId];
    const rows = await this.all(
      `SELECT r.review_id, r.rating, r.text, r.review_date, f.lane FROM reviews r
         LEFT JOIN review_flags f ON f.owner_id = r.owner_id AND f.review_id = r.review_id
        WHERE r.owner_id = ? ${dated} AND (f.review_id IS NOT NULL OR TRIM(r.text) = '') ORDER BY r.review_date, r.review_id`,
      ...params,
    );
    const tags = await this.all("SELECT review_id, theme, sentiment FROM tags WHERE owner_id = ?", this.ownerId);
    const byId = new Map<string, TaggedReview["tags"]>();
    for (const t of tags) {
      const id = String(t.review_id);
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id)!.push({ theme: t.theme as Theme, sentiment: t.sentiment as Sentiment });
    }
    return rows.map((r) => ({
      review_id: String(r.review_id),
      rating: r.rating === null ? null : Number(r.rating),
      text: String(r.text),
      review_date: r.review_date === null ? null : String(r.review_date),
      tags: byId.get(String(r.review_id)) ?? [],
      lane: (r.lane as TaggedReview["lane"]) ?? "normal",
    }));
  }

  /** Reviews that could be replied to and have no draft yet, in the order they should be written. */
  async needingDraft(limit = 50): Promise<{ review: StoredReview; lane: Lane }[]> {
    const out: { review: StoredReview; lane: Lane }[] = [];
    const rows = await this.all(
      `SELECT r.*, f.lane AS flag_lane FROM reviews r
         LEFT JOIN review_flags f ON f.owner_id = r.owner_id AND f.review_id = r.review_id
        WHERE r.owner_id = ? AND r.existing_owner_reply = ''
          AND NOT EXISTS (SELECT 1 FROM drafts d WHERE d.owner_id = r.owner_id AND d.review_id = r.review_id)
        ORDER BY CASE f.lane WHEN 'restricted' THEN 0 ELSE 1 END, COALESCE(r.review_date, '') DESC, r.review_id`,
      this.ownerId,
    );
    for (const r of rows) {
      const review = this.toReview(r);
      if (r.flag_lane === "spam") continue;
      const empty = review.text.trim() === "";
      if (empty && review.rating === null) continue;
      if (!empty && (r.flag_lane === null || r.flag_lane === undefined)) continue; // needs tagging first
      out.push({ review, lane: laneFor({ text: review.text, rating: review.rating, escalation: r.flag_lane === "restricted" ? ("other_serious" as EscalationCategory) : null }) });
      if (out.length >= limit) break;
    }
    return out;
  }

  // ---- drafts
  async saveDraft(id: string, text: string, restricted: boolean) {
    await this.run(
      `INSERT INTO drafts (owner_id, review_id, draft_text, restricted, status, edited_text, created_at, decided_at) VALUES (?, ?, ?, ?, 'pending', NULL, ?, NULL)
       ON CONFLICT(owner_id, review_id) DO UPDATE SET draft_text = excluded.draft_text, restricted = excluded.restricted, status = 'pending', edited_text = NULL, created_at = excluded.created_at, decided_at = NULL`,
      this.ownerId, id, text, restricted ? 1 : 0, this.now(),
    );
    await this.bumpUsage("drafts_written");
  }
  private toDraft(r: Row): DraftRow {
    return { review_id: String(r.review_id), draft_text: String(r.draft_text), restricted: Number(r.restricted) === 1, status: r.status as DraftRow["status"], edited_text: (r.edited_text as string | null) ?? null, created_at: String(r.created_at), decided_at: (r.decided_at as string | null) ?? null };
  }
  async getDraft(id: string): Promise<DraftRow | null> {
    const r = await this.one("SELECT * FROM drafts WHERE owner_id = ? AND review_id = ?", this.ownerId, id);
    return r ? this.toDraft(r) : null;
  }
  async drafts(status?: string): Promise<DraftRow[]> {
    const rows = status
      ? await this.all("SELECT * FROM drafts WHERE owner_id = ? AND status = ? ORDER BY restricted DESC, created_at", this.ownerId, status)
      : await this.all("SELECT * FROM drafts WHERE owner_id = ? ORDER BY restricted DESC, created_at", this.ownerId);
    return rows.map((r) => this.toDraft(r));
  }
  async decideDraft(id: string, status: "approved" | "edited" | "rejected", editedText?: string) {
    await this.run("UPDATE drafts SET status = ?, edited_text = ?, decided_at = ? WHERE owner_id = ? AND review_id = ?", status, editedText ?? null, this.now(), this.ownerId, id);
  }

  // ---- fixes
  async addFix(f: FixRow) {
    await this.run("INSERT INTO fixes VALUES (?, ?, ?, ?, ?)", this.ownerId, f.fix_id, f.theme, f.description, f.date_done);
  }
  private toFix(r: Row): FixRow {
    return { fix_id: String(r.fix_id), theme: String(r.theme), description: String(r.description), date_done: String(r.date_done) };
  }
  async getFix(id: string): Promise<FixRow | null> {
    const r = await this.one("SELECT * FROM fixes WHERE owner_id = ? AND fix_id = ?", this.ownerId, id);
    return r ? this.toFix(r) : null;
  }
  async fixes(): Promise<FixRow[]> {
    return (await this.all("SELECT * FROM fixes WHERE owner_id = ? ORDER BY date_done", this.ownerId)).map((r) => this.toFix(r));
  }

  // ---- usage and deletion
  private async bumpUsage(col: "reviews_tagged" | "drafts_written", by = 1) {
    const month = this.now().slice(0, 7);
    await this.run(`INSERT INTO usage (owner_id, month, ${col}) VALUES (?, ?, ?) ON CONFLICT(owner_id, month) DO UPDATE SET ${col} = ${col} + excluded.${col}`, this.ownerId, month, by);
  }
  async countTagged(n: number) {
    await this.bumpUsage("reviews_tagged", n);
  }
  async summaryCounts() {
    const n = async (sql: string) => Number((await this.one(sql, this.ownerId))!.n);
    return {
      reviews: await n("SELECT COUNT(*) AS n FROM reviews WHERE owner_id = ?"),
      tags: await n("SELECT COUNT(*) AS n FROM tags WHERE owner_id = ?"),
      flags: await n("SELECT COUNT(*) AS n FROM review_flags WHERE owner_id = ?"),
      drafts: await n("SELECT COUNT(*) AS n FROM drafts WHERE owner_id = ?"),
      fixes: await n("SELECT COUNT(*) AS n FROM fixes WHERE owner_id = ?"),
      profile: await n("SELECT COUNT(*) AS n FROM business_profiles WHERE owner_id = ?"),
    };
  }
  /** Removes every row this owner has, then re-creates the empty owner record. */
  async deleteEverything() {
    await this.batch([
      { sql: "DELETE FROM owners WHERE owner_id = ?", params: [this.ownerId] },
      { sql: "INSERT OR IGNORE INTO owners (owner_id, created_at) VALUES (?, ?)", params: [this.ownerId, this.now()] },
    ]);
  }
}
