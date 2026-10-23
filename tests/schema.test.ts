import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync("src/db/migrations/0001_init.sql", "utf8"));
  db.prepare("INSERT INTO owners VALUES ('o1', '2026-01-01')").run();
  db.prepare("INSERT INTO owners VALUES ('o2', '2026-01-01')").run();
  return db;
}
const addReview = (db: DatabaseSync, owner: string, id: string, fp: string) =>
  db.prepare("INSERT INTO reviews (owner_id, review_id, source, rating, text, fingerprint, imported_at) VALUES (?, ?, 'google', 5, 'ok', ?, '2026-01-01')").run(owner, id, fp);

describe("schema", () => {
  it("loads and rejects a duplicate fingerprint for the same owner only", () => {
    const db = freshDb();
    addReview(db, "o1", "R1", "fp");
    expect(() => addReview(db, "o1", "R2", "fp")).toThrow();
    expect(() => addReview(db, "o2", "R1", "fp")).not.toThrow();
  });

  it("allows only one sentiment per theme per review, and only positive or negative", () => {
    const db = freshDb();
    addReview(db, "o1", "R1", "a");
    const tag = (theme: string, s: string) => db.prepare("INSERT INTO tags VALUES ('o1', 'R1', ?, ?, '2026-01-01')").run(theme, s);
    tag("Staff attitude", "positive");
    expect(() => tag("Staff attitude", "negative")).toThrow();
    expect(() => tag("Cleanliness", "neutral")).toThrow();
  });

  it("deleting an owner removes everything they have", () => {
    const db = freshDb();
    addReview(db, "o1", "R1", "a");
    db.prepare("INSERT INTO tags VALUES ('o1', 'R1', 'Staff attitude', 'positive', '2026-01-01')").run();
    db.prepare("DELETE FROM owners WHERE owner_id = 'o1'").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM reviews").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM tags").get()).toEqual({ n: 0 });
  });

  it("rejects ratings outside 1 to 5 and unknown lanes", () => {
    const db = freshDb();
    expect(() => db.prepare("INSERT INTO reviews (owner_id, review_id, source, rating, fingerprint, imported_at) VALUES ('o1', 'X', 's', 6, 'f', 'd')").run()).toThrow();
    addReview(db, "o1", "R1", "a");
    expect(() => db.prepare("INSERT INTO review_flags (owner_id, review_id, lane, flagged_at) VALUES ('o1', 'R1', 'weird', 'd')").run()).toThrow();
  });
});
