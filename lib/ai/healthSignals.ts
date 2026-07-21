// FR-8.x baseline health monitoring, Tier 0 — read-only. Computes signals
// straight from tasks/sprints/task_dependencies; never writes to any of
// them. The caller (app/api/ai/project-health/route.ts) is the only place
// that persists anything, and only to project_health_snapshots.
import { eq, inArray } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { sprints, taskDependencies, tasks } from "@/db/schema";

export interface ProjectHealthSignals {
  computedAt: string;
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  sprints: {
    id: string;
    name: string;
    status: string;
    totalTasks: number;
    doneTasks: number;
    burnRate: number;
  }[];
}

const CLOSED_STATUSES = new Set(["done", "cancelled"]);

export async function computeProjectHealthSignals(
  db: OrgScopedDb,
  projectId: string,
): Promise<ProjectHealthSignals> {
  const [projectTasks, projectSprints] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
    db.select().from(sprints).where(eq(sprints.projectId, projectId)),
  ]);

  const dependencies = projectTasks.length
    ? await db
        .select()
        .from(taskDependencies)
        .where(
          inArray(
            taskDependencies.taskId,
            projectTasks.map((t) => t.id),
          ),
        )
    : [];

  const taskById = new Map(projectTasks.map((t) => [t.id, t]));
  const sprintById = new Map(projectSprints.map((s) => [s.id, s]));
  const today = new Date().toISOString().slice(0, 10);

  const doneTasks = projectTasks.filter((t) => t.status === "done").length;
  const openTasks = projectTasks.filter((t) => !CLOSED_STATUSES.has(t.status)).length;

  // "Overdue" has no direct column on tasks — proxied via the task's
  // sprint end date, since tasks don't carry their own due date.
  const overdueTasks = projectTasks.filter((t) => {
    if (CLOSED_STATUSES.has(t.status)) return false;
    const sprint = t.sprintId ? sprintById.get(t.sprintId) : undefined;
    return sprint?.endDate != null && sprint.endDate < today;
  }).length;

  // A task is blocked if any of its dependencies (task_dependencies.task_id
  // -> depends_on_task_id) points at a task that isn't closed yet.
  const blockedTaskIds = new Set<string>();
  for (const dep of dependencies) {
    const blocker = taskById.get(dep.dependsOnTaskId);
    if (blocker && !CLOSED_STATUSES.has(blocker.status)) {
      blockedTaskIds.add(dep.taskId);
    }
  }

  const sprintSignals = projectSprints.map((s) => {
    const sprintTasks = projectTasks.filter((t) => t.sprintId === s.id);
    const sprintDone = sprintTasks.filter((t) => t.status === "done").length;
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      totalTasks: sprintTasks.length,
      doneTasks: sprintDone,
      burnRate: sprintTasks.length ? Number((sprintDone / sprintTasks.length).toFixed(2)) : 0,
    };
  });

  return {
    computedAt: new Date().toISOString(),
    totalTasks: projectTasks.length,
    openTasks,
    doneTasks,
    overdueTasks,
    blockedTasks: blockedTaskIds.size,
    sprints: sprintSignals,
  };
}
