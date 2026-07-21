// Acceptance check for Prompt 1.2: a user in Org 1 must get zero rows back
// from Org 2's data. Sets up two orgs/users via service_role (bypasses RLS,
// same bootstrap reasoning as db/seed.ts), then re-queries as `authenticated`
// — never service_role for the read, since that's the thing under test.
// Explicitly SET ROLE authenticated, not just RESET ROLE: this connection
// authenticates as the Neon project's owner role, which Neon grants
// BYPASSRLS by default, so simply resetting back to it would silently skip
// RLS again (see db/withOrgContext.ts for the long version).
import { Pool } from "@neondatabase/serverless";

const ORG_A = "00000000-0000-0000-0000-0000000000aa";
const ORG_B = "00000000-0000-0000-0000-0000000000bb";
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();

  try {
    // --- fixtures, as service_role ---
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values
         ($1, 'Org A', 'rls-test-org-a'),
         ($2, 'Org B', 'rls-test-org-b')
       on conflict (id) do nothing`,
      [ORG_A, ORG_B],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'admin'),
         ($3, $4, 'admin')
       on conflict (user_id, org_id) do nothing`,
      [USER_A, ORG_A, USER_B, ORG_B],
    );
    await client.query(
      `insert into departments (id, org_id, name) values
         (gen_random_uuid(), $1, 'Org A Dept'),
         (gen_random_uuid(), $2, 'Org B Dept')`,
      [ORG_A, ORG_B],
    );
    await client.query("reset role");
    await client.query("commit");

    // --- read back as User A, RLS-scoped role ---
    await client.query("begin");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [USER_A]);

    const orgs = await client.query("select id from organizations");
    assert(orgs.rows.length === 1 && orgs.rows[0].id === ORG_A, "organizations: expected only Org A");

    const orgBLeak = orgs.rows.some((r) => r.id === ORG_B);
    assert(!orgBLeak, "organizations: Org B row leaked to User A");

    const memberships = await client.query("select org_id from org_memberships");
    assert(
      memberships.rows.every((r) => r.org_id === ORG_A),
      "org_memberships: leaked a row outside Org A",
    );

    const departments = await client.query("select org_id from departments");
    assert(
      departments.rows.every((r) => r.org_id === ORG_A),
      "departments: leaked a row outside Org A",
    );

    await client.query("commit");

    console.log("PASS: User A (Org A) sees zero rows from Org B across organizations, org_memberships, departments.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
