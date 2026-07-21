import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { taskDependencies, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const rows = await withOrgContext(userId, (db) =>
      db.select().from(taskDependencies).where(eq(taskDependencies.taskId, id)),
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: taskId } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const dependsOnTaskId = body.depends_on_task_id;
    const type = body.type;
    if (!dependsOnTaskId || !type) {
      throw new ApiError(400, "depends_on_task_id and type are required");
    }
    if (dependsOnTaskId === taskId) {
      throw new ApiError(400, "A task cannot depend on itself");
    }

    const row = await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, taskId));
      if (!task) throw new ApiError(404, "Task not found");

      await requirePermission(db, userId, task.orgId, "task_dependency", "create");

      // Would taskId -> dependsOnTaskId close a loop? True iff
      // dependsOnTaskId can already reach taskId via existing edges.
      const cycle = await db.execute(sql`
        with recursive chain as (
          select depends_on_task_id as id
          from task_dependencies
          where task_id = ${dependsOnTaskId}
          union
          select td.depends_on_task_id
          from task_dependencies td
          join chain c on td.task_id = c.id
        )
        select 1 from chain where id = ${taskId} limit 1
      `);
      if (cycle.rows.length > 0) {
        throw new ApiError(409, "This dependency would create a circular reference");
      }

      const [inserted] = await db
        .insert(taskDependencies)
        .values({ taskId, dependsOnTaskId, type })
        .returning();
      return inserted;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id: taskId } = await params;
    const userId = await requireUserId(req);
    const dependsOnTaskId = req.nextUrl.searchParams.get("depends_on_task_id");
    if (!dependsOnTaskId) {
      throw new ApiError(400, "depends_on_task_id query param is required");
    }

    const row = await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, taskId));
      if (!task) return undefined;

      await requirePermission(db, userId, task.orgId, "task_dependency", "delete");

      const [deleted] = await db
        .delete(taskDependencies)
        .where(
          and(
            eq(taskDependencies.taskId, taskId),
            eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
          ),
        )
        .returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Dependency not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
