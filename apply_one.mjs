// Applies a single drizzle migration file in its own transaction and
// records it in drizzle.__drizzle_migrations. Works around drizzle-kit
// migrate()'s batching bug: it wraps ALL pending migrations into one
// transaction, which breaks whenever a later file in the batch uses an
// enum value an earlier file in the same batch just added.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node apply_one.mjs <migration_tag>");
  process.exit(1);
}

const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8"));
const entry = journal.entries.find((e) => e.tag === tag);
if (!entry) {
  console.error(`No journal entry for tag "${tag}"`);
  process.exit(1);
}

const sqlText = readFileSync(`db/migrations/${tag}.sql`, "utf8");
const statements = sqlText.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
const hash = createHash("sha256").update(sqlText).digest("hex");

const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  for (const stmt of statements) {
    await client.query(stmt);
  }
  await client.query(
    `insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)`,
    [hash, entry.when],
  );
  await client.query("commit");
  console.log(`Applied ${tag} (${statements.length} statements)`);
} catch (err) {
  await client.query("rollback");
  console.error(`Failed applying ${tag}:`, err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
