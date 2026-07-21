import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog, goals, milestones, projects, sprints, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import type { ProjectDraft } from "@/lib/ai/projectDraft";

// The only route allowed to turn an AI draft into real rows, and only ever
// in response to this explicit call — never invoked automatically by the
// draft-generation route. Acceptance criteria: no project/milestone/sprint/
// task row exists without a human hitting "Accept & Create".
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const draft = body.draft as ProjectDraft | undefined;

    if (!body.org_id || !draft?.goal?.title || !draft?.project?.name) {
      throw new ApiError(400, "org_id and a draft with goal.title and project.name are required");
    }

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "goal", "create");
      await requirePermission(db, userId, body.org_id, "project", "create");
      await requirePermission(db, userId, body.org_id, "milestone", "create");
      await requirePermission(db, userId, body.org_id, "sprint", "create");
      await requirePermission(db, userId, body.org_id, "task", "create");

      const [goalRow] = await db
        .insert(goals)
        .values({ orgId: body.org_id, title: draft.goal.title, description: draft.goal.description })
        .returning();

      // `projects` has no description column (Prompt 1.3 schema) — the
      // draft's project.description is review-UI-only, dropped here.
      const [projectRow] = await db
        .insert(projects)
        .values({
          orgId: body.org_id,
          name: draft.project.name,
          status: draft.project.status,
          startDate: draft.project.start_date,
          endDate: draft.project.end_date,
        })
        .returning();

      const milestoneRows = draft.milestones.length
        ? await db
            .insert(milestones)
            .values(
              draft.milestones.map((m) => ({
                orgId: body.org_id,
                projectId: projectRow.id,
                name: m.name,
                dueDate: m.due_date,
              })),
            )
            .returning()
        : [];

      const sprintRows = draft.sprints.length
        ? await db
            .insert(sprints)
            .values(
              draft.sprints.map((s) => ({
                orgId: body.org_id,
                projectId: projectRow.id,
                name: s.name,
                startDate: s.start_date,
                endDate: s.end_date,
                status: s.status,
              })),
            )
            .returning()
        : [];

      const taskRows = draft.tasks.length
        ? await db
            .insert(tasks)
            .values(
              draft.tasks.map((t) => ({
                orgId: body.org_id,
                projectId: projectRow.id,
                sprintId: t.sprint_index !== null ? (sprintRows[t.sprint_index]?.id ?? null) : null,
                title: t.title,
                description: t.description,
                priority: t.priority,
                estimate: t.estimate,
              })),
            )
            .returning()
        : [];

      await db.insert(auditLog).values({
        orgId: body.org_id,
        actorUserId: userId,
        actorType: "human",
        action: "ai_project_draft_accepted",
        targetType: "project",
        targetId: projectRow.id,
        metadata: {
          draftId: body.draft_id ?? null,
          goalId: goalRow.id,
          milestoneCount: milestoneRows.length,
          sprintCount: sprintRows.length,
          taskCount: taskRows.length,
        },
      });

      return { goal: goalRow, project: projectRow, milestones: milestoneRows, sprints: sprintRows, tasks: taskRows };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
