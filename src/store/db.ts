import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { Row, SqlDb, SqlValue, Stmt } from "./sql.js";

/** Local SQLite (Node.js built in). Used by tests and the desktop server. */
export class NodeDb implements SqlDb {
  constructor(readonly raw: DatabaseSync) {}
  async all(sql: string, params: SqlValue[] = []) {
    return this.raw.prepare(sql).all(...params) as Row[];
  }
  async run(sql: string, params: SqlValue[] = []) {
    return { changes: Number(this.raw.prepare(sql).run(...params).changes) };
  }
  async batch(stmts: Stmt[]) {
    this.raw.exec("BEGIN");
    try {
      for (const s of stmts) this.raw.prepare(s.sql).run(...s.params);
      this.raw.exec("COMMIT");
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    }
  }
}

/** Opens a local SQLite file (or ":memory:") and applies the migrations in order. */
export function openDb(path: string): NodeDb {
  const raw = new DatabaseSync(path);
  raw.exec("PRAGMA foreign_keys = ON");
  raw.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)");
  const dir = new URL("../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (raw.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(file)) continue;
    raw.exec(readFileSync(new URL(file, dir), "utf8"));
    raw.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
  }
  return new NodeDb(raw);
}
