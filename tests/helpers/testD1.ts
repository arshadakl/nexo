import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// node:sqlite is loaded lazily via require so Vite does not try to bundle it.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

type Value = string | number | bigint | null | Uint8Array;

function normalize(args: unknown[]): Value[] {
  return args.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v as Value;
  });
}

/**
 * Minimal Cloudflare D1 binding backed by an in-memory SQLite database with every migration
 * applied, so repository/route/consumer code runs against the real schema in tests.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

export function applyMigration(sqlite: InstanceType<typeof DatabaseSync>, file: string) {
  sqlite.exec(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
}

/** @param options.before apply only migrations whose file name sorts before this prefix */
export function createTestD1(options: { before?: string } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of migrationFiles()) {
    if (options.before && file >= options.before) break;
    applyMigration(sqlite, file);
  }
  sqlite.exec('PRAGMA foreign_keys = ON');

  const statement = (sql: string, args: unknown[] = []): any => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async (column?: string) => {
      const row = sqlite.prepare(sql).get(...normalize(args)) as Record<string, unknown> | undefined;
      if (!row) return null;
      return column ? (row[column] ?? null) : { ...row };
    },
    all: async () => ({
      success: true,
      results: (sqlite.prepare(sql).all(...normalize(args)) as Record<string, unknown>[]).map((r) => ({ ...r })),
      meta: {},
    }),
    run: async () => {
      const info = sqlite.prepare(sql).run(...normalize(args));
      return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
    },
    __exec: () => sqlite.prepare(sql).run(...normalize(args)),
  });

  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: any[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((s) => {
          const info = s.__exec();
          return { success: true, meta: { changes: Number(info.changes) } };
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
    exec: async (sql: string) => sqlite.exec(sql),
  };

  return { db: db as unknown as D1Database, sqlite };
}
