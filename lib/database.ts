import { Pool } from "pg";
import { SCHEMA } from "./repository";
let pool: Pool | undefined;
let initialized: Promise<void> | undefined;
export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}
export function getPool() {
  if (!databaseConfigured()) return null;
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}
export async function database() {
  const db = getPool();
  if (!db) return null;
  initialized ??= (async () => {
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(772041901)");
      await c.query(SCHEMA);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  })().catch((e) => {
    initialized = undefined;
    throw e;
  });
  await initialized;
  return db;
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const db = await database();
  if (!db) return false;
  const r = await db.query(
    `INSERT INTO roomwise.rate_limits(key,count,reset_at) VALUES($1,1,now()+($2::int * interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN roomwise.rate_limits.reset_at<now() THEN 1 ELSE roomwise.rate_limits.count+1 END,reset_at=CASE WHEN roomwise.rate_limits.reset_at<now() THEN now()+($2::int * interval '1 second') ELSE roomwise.rate_limits.reset_at END RETURNING count`,
    [key, seconds],
  );
  return r.rows[0].count <= limit;
}
