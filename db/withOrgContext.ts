// RLS-scoped runtime queries: `db/index.ts`'s neon-http client is stateless
// (one HTTP call per query), so it can't carry the `request.jwt.claim.sub`
// session var RLS policies key off (see 0000_auth_compat.sql). This uses a
// pooled, session-backed connection instead, wraps every call in a
// transaction, and sets that var before handing the caller a drizzle
// instance — so every query inside the callback is scoped to that user's
// orgs by Postgres itself, not just app-layer filtering.
//
// Neon-specific gotcha: the single Neon role this project connects as
// (from both NEON_DIRECT_URL and NEON_POOLED_URL) is the project's owner
// role, and Neon grants BYPASSRLS to owner roles by default — independent
// of, and overriding, the `force row level security` set in
// 0002/0004_force_rls*.sql. So `set role authenticated` (a role we
// deliberately created without BYPASSRLS, see 0000_auth_compat.sql) is not
// optional here; without it every query on this connection silently skips
// RLS regardless of the session var below.
import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.NEON_POOLED_URL });

export type OrgScopedDb = NeonDatabase<typeof schema>;

export async function withOrgContext<T>(
  userId: string,
  fn: (db: OrgScopedDb) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
