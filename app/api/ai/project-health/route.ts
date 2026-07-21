import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog, projectHealthSnapshots, projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { computeProjectHealthSignals } from "@/lib/ai/healthSignals";
import { generateHealthSummary } from "@/lib/ai/gemini";

// Dashboard read: latest snapshot per project in the org. Tier 0 — this
// route never touches goals/projects/milestones/sprints/tasks, only reads
// project_health_snapshots.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "project_health_snapshot", "read");
      return db
        .selectDistinctOn([projectHealthSnapshots.projectId])
        .from(projectHealthSnapshots)
        .innerJoin(projects, eq(projects.id, projectHealthSnapshots.projectId))
        .where(eq(projectHealthSnapshots.orgId, orgId))
        .orderBy(projectHealthSnapshots.projectId, desc(projectHealthSnapshots.createdAt));
    });

    return NextResponse.json({
      data: rows.map((r) => ({ ...r.project_health_snapshots, projectName: r.projects.name })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// On-demand scan (the "scheduled or on-demand function" — no scheduler
// infra exists yet, Railway worker is Phase 2, so this is the trigger for
// now). Tier 0 — the only write is a new project_health_snapshots row plus
// an audit_log entry; nothing here ever mutates task/project/sprint data.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.project_id) {
      throw new ApiError(400, "org_id and project_id are required");
    }

    const { project, signals } = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "project_health_snapshot", "create");

      const [project] = await db.select().from(projects).where(eq(projects.id, body.project_id));
      if (!project) throw new ApiError(404, "Project not found");

      const signals = await computeProjectHealthSignals(db, body.project_id);
      return { project, signals };
    });

    // Gemini call happens outside the DB transaction so the pooled
    // connection isn't held open for a slow external request.
    const aiSummary = await generateHealthSummary(project.name, signals);

    const [snapshot] = await withOrgContext(userId, async (db) => {
      const inserted = await db
        .insert(projectHealthSnapshots)
        .values({ orgId: body.org_id, projectId: body.project_id, signals, aiSummary })
        .returning();

      await db.insert(auditLog).values({
        orgId: body.org_id,
        actorUserId: userId,
        actorType: "ai",
        action: "project_health_snapshot_generated",
        targetType: "project",
        targetId: body.project_id,
        metadata: { snapshotId: inserted[0].id, signals },
      });

      return inserted;
    });

    return NextResponse.json({ data: { ...snapshot, projectName: project.name } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
