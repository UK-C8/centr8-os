import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { sprintCapacities, sprints, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// FR-3.x (Prompt 3.2) task 1 — per-user capacity for a sprint, plus their
// currently assigned workload computed live from tasks.estimate (never
// stored, so it can't drift from real assignments). "Assigned" excludes
// cancelled tasks only — a done task still counts toward what was
// assigned, capacity planning is about load, not remaining work.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sprintId = req.nextUrl.searchParams.get("sprint_id");
    if (!sprintId) throw new ApiError(400, "sprint_id is required");

    const data = await withOrgContext(userId, async (db) => {
      const [sprint] = await db.select({ orgId: sprints.orgId }).from(sprints).where(eq(sprints.id, sprintId));
      if (!sprint) throw new ApiError(404, "Sprint not found");

      await requirePermission(db, userId, sprint.orgId, "capacity", "read");

      const [capacityRows, taskRows] = await Promise.all([
        db.select().from(sprintCapacities).where(eq(sprintCapacities.sprintId, sprintId)),
        db
          .select({ assigneeId: tasks.assigneeId, estimate: tasks.estimate })
          .from(tasks)
          .where(and(eq(tasks.sprintId, sprintId), ne(tasks.status, "cancelled"))),
      ]);

      const assignedByUser = new Map<string, number>();
      for (const t of taskRows) {
        if (!t.assigneeId) continue;
        assignedByUser.set(t.assigneeId, (assignedByUser.get(t.assigneeId) ?? 0) + (t.estimate ?? 0));
      }

      return capacityRows.map((c) => {
        const assigned = assignedByUser.get(c.userId) ?? 0;
        return { userId: c.userId, capacity: c.capacity, assigned, overAllocated: assigned > c.capacity };
      });
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}

// Upsert — one row per (sprint, user). "Setting capacity" per the prompt's
// own phrasing is a single verb, so this checks capacity:update alone
// (create+update both seeded to the same roles anyway, see
// db/migrations/0018_seed_budgeting_permissions.sql).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id || !body.sprint_id || !body.user_id || typeof body.capacity !== "number") {
      throw new ApiError(400, "org_id, sprint_id, user_id, and a numeric capacity are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "capacity", "update");
      return db
        .insert(sprintCapacities)
        .values({
          orgId: body.org_id,
          sprintId: body.sprint_id,
          userId: body.user_id,
          capacity: body.capacity,
        })
        .onConflictDoUpdate({
          target: [sprintCapacities.sprintId, sprintCapacities.userId],
          set: { capacity: body.capacity },
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
