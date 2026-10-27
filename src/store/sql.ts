// A tiny database interface that both local SQLite (tests, desktop) and Cloudflare D1 (hosted) can fill.
export type SqlValue = string | number | null;
export type Row = Record<string, unknown>;
export interface Stmt {
  sql: string;
  params: SqlValue[];
}

export interface SqlDb {
  all(sql: string, params?: SqlValue[]): Promise<Row[]>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  /** Runs all statements together: all happen or none do. */
  batch(stmts: Stmt[]): Promise<void>;
}

/** Cloudflare D1 adapter. `D1Database` comes from the Workers runtime, so it is typed loosely here. */
interface D1Like {
  prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<{ results: Row[] }>; run(): Promise<{ meta: { changes: number } }> } };
  batch(stmts: unknown[]): Promise<unknown>;
}

export class D1Db implements SqlDb {
  constructor(private readonly d1: D1Like) {}
  async all(sql: string, params: SqlValue[] = []) {
    return (await this.d1.prepare(sql).bind(...params).all()).results;
  }
  async run(sql: string, params: SqlValue[] = []) {
    return { changes: (await this.d1.prepare(sql).bind(...params).run()).meta.changes };
  }
  async batch(stmts: Stmt[]) {
    if (stmts.length) await this.d1.batch(stmts.map((s) => this.d1.prepare(s.sql).bind(...s.params)));
  }
}
