import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { agentJobs, projectHealthSnapshots, projects } from "@/db/schema";
import { ApiError, handleApiError, pollAgentJob, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import type { ProjectHealthScanInput, ProjectHealthScanOutput } from "@/lib/agents/monitor";

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

// On-demand scan. Tier 0 — the only write is a new project_health_snapshots
// row; nothing here ever mutates task/project/sprint data.
//
// Prompt 2.1: enqueues a Monitor job for workers/agent-worker.ts to pick up
// (SELECT ... FOR UPDATE SKIP LOCKED) instead of computing signals and
// calling Gemini inline. The worker writes the audit_log entry
// (lib/agents/registry.ts's "project_health_snapshot_generated"
// auditAction); this route persists the snapshot row once the job's
// output comes back, same as before.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.project_id) {
      throw new ApiError(400, "org_id and project_id are required");
    }

    const project = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "project_health_snapshot", "create");

      const [project] = await db.select().from(projects).where(eq(projects.id, body.project_id));
      if (!project) throw new ApiError(404, "Project not found");
      return project;
    });

    const input: ProjectHealthScanInput = { projectId: body.project_id, projectName: project.name };
    const [job] = await withOrgContext(userId, (db) =>
      db
        .insert(agentJobs)
        .values({
          orgId: body.org_id,
          agentType: "monitor",
          jobType: "project_health_scan",
          tier: "tier_0",
          requestedByUserId: userId,
          input,
        })
        .returning(),
    );

    const finished = await pollAgentJob(userId, job.id);
    const { signals, aiSummary } = finished.output as ProjectHealthScanOutput;

    const [snapshot] = await withOrgContext(userId, (db) =>
      db
        .insert(projectHealthSnapshots)
        .values({ orgId: body.org_id, projectId: body.project_id, signals, aiSummary })
        .returning(),
    );

    return NextResponse.json({ data: { ...snapshot, projectName: project.name } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
