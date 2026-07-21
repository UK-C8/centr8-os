"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { createClient } from "@/lib/supabase/client";
import { ProjectStatusBadge, projectStatusColor, taskStatusColor } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardLink } from "@/components/ui/Card";
import { DonutChart } from "@/components/ui/DonutChart";
import { StatCard } from "@/components/ui/StatCard";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_STATUS_PROGRESS } from "@/lib/constants";

type Project = { id: string; name: string; status: string };
type AuditEntry = {
  id: string;
  actorType: "human" | "ai";
  actorUserId: string | null;
  action: string;
  targetType: string;
  createdAt: string;
};

export default function DashboardPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/projects?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/audit-log?org_id=${selectedOrgId}&limit=15`).then((r) => r.json()),
    ])
      .then(async ([projectsBody, activityBody]) => {
        if (!projectsBody.data) throw new Error(projectsBody.error ?? "Failed to load projects");
        setProjects(projectsBody.data);
        setActivity(activityBody.data ?? []);

        // No aggregate "task counts by status across the org" endpoint
        // exists — tasks are always scoped to a project or sprint. Same
        // per-project fetch-and-aggregate pattern as the project list's
        // milestone counts.
        const perProject = await Promise.all(
          projectsBody.data.map((p: Project) =>
            fetch(`/api/tasks?project_id=${p.id}`)
              .then((r) => r.json())
              .then((b) => (b.data ?? []) as { status: string }[])
              .catch(() => []),
          ),
        );
        const counts: Record<string, number> = {};
        for (const status of TASK_STATUSES) counts[status] = 0;
        for (const tasks of perProject) for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
        setTaskCounts(counts);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const activeProjects = projects.filter((p) => p.status === "active");

  const totalTasks = TASK_STATUSES.reduce((sum, s) => sum + (taskCounts[s] ?? 0), 0);
  const doneCount = taskCounts.done ?? 0;
  const pendingCount = totalTasks - doneCount - (taskCounts.cancelled ?? 0);
  const avgProgress = totalTasks
    ? Math.round(
        TASK_STATUSES.reduce((sum, s) => sum + (taskCounts[s] ?? 0) * TASK_STATUS_PROGRESS[s], 0) / totalTasks,
      )
    : 0;

  const firstName = email ? email.split("@")[0].split(/[._-]/)[0] : null;
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">
          {displayName ? `Welcome, ${displayName}` : "Welcome"}
        </h1>
        <p className="mt-1 text-body text-neutral-600">Check out the latest updates.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          color="success"
          value={doneCount}
          label="Tasks Done"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          color="info"
          value={`${avgProgress}%`}
          label="Avg. Progress"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14" />
            </svg>
          }
        />
        <StatCard
          color="warning"
          value={pendingCount}
          label="Pending"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-h3 font-semibold text-neutral-800">Task counts by status</h2>
        <Card>
          <DonutChart
            slices={TASK_STATUSES.map((status) => ({
              label: TASK_STATUS_LABELS[status],
              value: taskCounts[status] ?? 0,
              color: taskStatusColor(status),
            }))}
          />
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-h3 font-semibold text-neutral-800">Active projects</h2>
          <Button href="/projects" variant="secondary">
            View all →
          </Button>
        </div>
        {activeProjects.length === 0 ? (
          <p className="text-body text-neutral-600">No active projects.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((p) => (
              <CardLink key={p.id} href={`/projects/${p.id}`} color={projectStatusColor(p.status)} padding="sm" className="flex items-center justify-between">
                <span className="text-body-medium font-medium text-neutral-950">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
              </CardLink>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-h3 font-semibold text-neutral-800">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-body text-neutral-600">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 text-body">
                <span className="text-neutral-950">
                  {/* No user-directory endpoint exists (same gap as task
                      assignee) — actor is shown by type, not resolved name. */}
                  <span
                    className={
                      a.actorType === "ai"
                        ? "mr-2 rounded-sm bg-ai-100 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-ai-600"
                        : "mr-2 rounded-sm bg-neutral-200 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-neutral-800"
                    }
                  >
                    {a.actorType}
                  </span>
                  {a.action.replace(/_/g, " ")} · {a.targetType}
                </span>
                <span className="text-small text-neutral-600">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
