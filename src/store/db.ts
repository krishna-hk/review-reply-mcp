import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/** Opens a local SQLite file (or ":memory:") and applies the migrations in order. */
export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)");
  const dir = new URL("./migrations/", new URL("../db/", import.meta.url));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const done = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(file);
    if (done) continue;
    db.exec(readFileSync(new URL(file, dir), "utf8"));
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
  }
  return db;
}
