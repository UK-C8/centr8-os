// One-off dev seed: a test org, an admin membership, a department, a team.
// Runs as service_role (bypasses RLS) since creating org #1 requires a
// membership that in turn requires org #1 to already exist — see
// db/migrations/0000_auth_compat.sql for why that bootstrap needs a bypass.
import { Pool } from "@neondatabase/serverless";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_USER_ID = "00000000-0000-0000-0000-0000000000a1";
const DEPARTMENT_ID = "00000000-0000-0000-0000-0000000000d1";
const TEAM_ID = "00000000-0000-0000-0000-0000000000e1";

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("set role service_role");

    await client.query(
      `insert into organizations (id, name, slug)
       values ($1, 'Test Org', 'test-org')
       on conflict (id) do nothing`,
      [ORG_ID],
    );

    await client.query(
      `insert into departments (id, org_id, name)
       values ($1, $2, 'Engineering')
       on conflict (id) do nothing`,
      [DEPARTMENT_ID, ORG_ID],
    );

    await client.query(
      `insert into teams (id, org_id, department_id, name)
       values ($1, $2, $3, 'Platform')
       on conflict (id) do nothing`,
      [TEAM_ID, ORG_ID, DEPARTMENT_ID],
    );

    await client.query(
      `insert into org_memberships (user_id, org_id, role, department_id, team_id)
       values ($1, $2, 'admin', $3, $4)
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER_ID, ORG_ID, DEPARTMENT_ID, TEAM_ID],
    );

    await client.query("commit");
    console.log("Seeded:", { orgId: ORG_ID, adminUserId: ADMIN_USER_ID });
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
