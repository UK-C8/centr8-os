// One-off dev seed: a test org, an admin membership, a department, a team,
// plus a real loginable viewer-role user for manually verifying the
// Prompt 1.4 UI-gating behavior (org_memberships.user_id has no FK to
// auth.users, so a row alone isn't enough — without a matching Supabase
// Auth account the id could never actually sign in through the UI).
// Runs as service_role (bypasses RLS) since creating org #1 requires a
// membership that in turn requires org #1 to already exist — see
// db/migrations/0000_auth_compat.sql for why that bootstrap needs a bypass.
import { Pool } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_USER_ID = "00000000-0000-0000-0000-0000000000a1";
const DEPARTMENT_ID = "00000000-0000-0000-0000-0000000000d1";
const TEAM_ID = "00000000-0000-0000-0000-0000000000e1";

const VIEWER_EMAIL = "centr8-viewer-test@example.com";
const VIEWER_PASSWORD = "ViewerTest123!";

// Creates the Supabase Auth account if it doesn't exist yet, or reuses it
// (matched by email) on re-runs — same idempotent intent as the SQL
// `on conflict do nothing` calls below, just via the admin API instead of
// a unique constraint.
async function ensureViewerAuthUser(): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: VIEWER_EMAIL,
    password: VIEWER_PASSWORD,
    email_confirm: true,
  });
  if (created.user) return created.user.id;

  if (!createErr?.message.includes("already been registered")) throw createErr;

  // Already exists from a prior seed run — look it up instead.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === VIEWER_EMAIL);
    if (match) return match.id;
    if (data.users.length < 200) throw new Error(`${VIEWER_EMAIL} not found via listUsers after create conflict`);
    page++;
  }
}

async function main() {
  const viewerUserId = await ensureViewerAuthUser();

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

    await client.query(
      `insert into org_memberships (user_id, org_id, role, department_id, team_id)
       values ($1, $2, 'viewer', $3, $4)
       on conflict (user_id, org_id) do update set role = excluded.role`,
      [viewerUserId, ORG_ID, DEPARTMENT_ID, TEAM_ID],
    );

    await client.query("commit");
    console.log("Seeded:", {
      orgId: ORG_ID,
      adminUserId: ADMIN_USER_ID,
      viewerUserId,
      viewerLogin: { email: VIEWER_EMAIL, password: VIEWER_PASSWORD },
    });
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
