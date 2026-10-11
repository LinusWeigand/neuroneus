import { config } from "dotenv";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const migrationsFolder = "./drizzle";

const tables = Object.values(schema as Record<string, unknown>).flatMap((v) => (is(v, PgTable) ? [getTableConfig(v)] : []));

async function recordedMigrations(pool: Pool) {
  const { rows } = await pool.query<{ exists: boolean }>(
    `select to_regclass('drizzle.__drizzle_migrations') is not null as exists`,
  );
  if (!rows[0].exists) return 0;
  const count = await pool.query<{ n: number }>(`select count(*)::int as n from drizzle.__drizzle_migrations`);
  return count.rows[0].n;
}

async function adoptExistingSchema(pool: Pool) {
  if ((await recordedMigrations(pool)) > 0) return;

  const { rows } = await pool.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  const live = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!live.has(r.table_name)) live.set(r.table_name, new Set());
    live.get(r.table_name)!.add(r.column_name);
  }

  const present = tables.filter((t) => live.has(t.name));
  if (present.length === 0) return;

  const missing = tables.flatMap((t) => {
    const cols = live.get(t.name);
    if (!cols) return [`table "${t.name}"`];
    return t.columns.filter((c) => !cols.has(c.name)).map((c) => `column "${t.name}.${c.name}"`);
  });
  if (missing.length > 0) {
    throw new Error(
      `The database has some of this app's tables but no migration history, and is missing ${missing.join(", ")}. ` +
        `Drop the partial tables (or use an empty Neon branch) and redeploy.`,
    );
  }

  const migrations = readMigrationFiles({ migrationsFolder });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`create schema if not exists drizzle`);
    await client.query(
      `create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`,
    );
    for (const m of migrations) {
      await client.query(`insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)`, [
        m.hash,
        m.folderMillis,
      ]);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  console.log(`[migrate] adopted existing schema: recorded ${migrations.length} migration(s) as applied.`);
}

async function main() {
  if (!url) {
    console.warn("[migrate] DATABASE_URL not set, skipping migrations.");
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await adoptExistingSchema(pool);
    await migrate(drizzle(pool), { migrationsFolder });
    console.log("[migrate] database is up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
