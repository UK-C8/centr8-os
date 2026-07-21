// Acceptance check for Prompt 1.4 (FR-1.3): a non-admin role is blocked
// from mutating actions like deleting a project, using the exact same
// requirePermission() + withOrgContext() the API routes call — not a
// reimplementation of the check, the real thing.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { projects } from "./schema";
import { requirePermission } from "../lib/api/permissions";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000c1";
const PROJECT_ID = "00000000-0000-0000-0000-0000000000c2";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000c3";
const MEMBER_USER = "00000000-0000-0000-0000-0000000000c4";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000c5";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function assertForbidden(promise: Promise<unknown>, message: string) {
  try {
    await promise;
    throw new Error(`FAIL: ${message} (expected a 403, nothing was thrown)`);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 403) throw err;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();

  try {
    // --- fixtures, as service_role (bypasses RLS; same reasoning as db/seed.ts) ---
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values ($1, 'RBAC Test Org', 'rbac-test-org')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into projects (id, org_id, name) values ($1, $2, 'RBAC Test Project')
       on conflict (id) do nothing`,
      [PROJECT_ID, ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'admin'),
         ($3, $2, 'member'),
         ($4, $2, 'viewer')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_ID, MEMBER_USER, VIEWER_USER],
    );
    await client.query("commit");

    // --- requirePermission() directly, per role ---
    await withOrgContext(ADMIN_USER, (db) => requirePermission(db, ADMIN_USER, ORG_ID, "project", "delete"));
    console.log("PASS: admin may delete a project");

    await assertForbidden(
      withOrgContext(MEMBER_USER, (db) => requirePermission(db, MEMBER_USER, ORG_ID, "project", "delete")),
      "member should not be allowed to delete a project",
    );
    console.log("PASS: member is blocked from deleting a project (403)");

    await assertForbidden(
      withOrgContext(VIEWER_USER, (db) => requirePermission(db, VIEWER_USER, ORG_ID, "task", "create")),
      "viewer should not be allowed to create a task",
    );
    console.log("PASS: viewer is blocked from creating a task (403)");

    await withOrgContext(MEMBER_USER, (db) => requirePermission(db, MEMBER_USER, ORG_ID, "task", "create"));
    console.log("PASS: member may create a task (role-based, not a blanket deny)");

    // --- end-to-end: the actual DELETE /api/projects/[id] flow, blocked ---
    await assertForbidden(
      withOrgContext(MEMBER_USER, async (db) => {
        const [existing] = await db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, PROJECT_ID));
        await requirePermission(db, MEMBER_USER, existing!.orgId, "project", "delete");
        return db.delete(projects).where(eq(projects.id, PROJECT_ID)).returning();
      }),
      "member's project-delete request should be rejected before touching the row",
    );

    const stillThere = await client.query("select 1 from projects where id = $1", [PROJECT_ID]);
    assert(stillThere.rows.length === 1, "project was deleted despite the member's request being forbidden");
    console.log("PASS: project row untouched after member's blocked delete attempt");

    // --- same flow, as admin: should actually delete it ---
    await withOrgContext(ADMIN_USER, async (db) => {
      const [existing] = await db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, PROJECT_ID));
      await requirePermission(db, ADMIN_USER, existing!.orgId, "project", "delete");
      return db.delete(projects).where(eq(projects.id, PROJECT_ID)).returning();
    });

    const gone = await client.query("select 1 from projects where id = $1", [PROJECT_ID]);
    assert(gone.rows.length === 0, "project should be gone after admin's delete");
    console.log("PASS: admin's delete actually removed the project");

    console.log("\nALL RBAC CHECKS PASSED");
  } finally {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id = $1", [ORG_ID]); // cascades everything above
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
