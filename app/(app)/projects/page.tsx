"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { ProjectStatusBadge, Badge, projectStatusColor } from "@/components/ui/Badge";
import { CardLink } from "@/components/ui/Card";

type Project = {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

type HealthSnapshot = {
  projectId: string;
  aiSummary: string;
  signals: { overdueTasks: number; blockedTasks: number };
};

export default function ProjectsPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestoneCounts, setMilestoneCounts] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<Record<string, HealthSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/projects?org_id=${selectedOrgId}`).then((r) => r.json()),
      // Real health data, per Prompt 0.2's "health indicator (mock value for
      // now)" — Prompt 1.6 already built this for real, so there's no
      // reason to fake it here.
      fetch(`/api/ai/project-health?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(async ([projectsBody, healthBody]) => {
        if (!projectsBody.data) throw new Error(projectsBody.error ?? "Failed to load projects");
        const list: Project[] = projectsBody.data;
        setProjects(list);

        const healthMap: Record<string, HealthSnapshot> = {};
        if (healthBody.data) {
          for (const snap of healthBody.data) healthMap[snap.projectId] = snap;
        }
        setHealth(healthMap);

        const counts = await Promise.all(
          list.map((p) =>
            fetch(`/api/milestones?project_id=${p.id}`)
              .then((r) => r.json())
              .then((b) => [p.id, (b.data ?? []).length] as const)
              .catch(() => [p.id, 0] as const),
          ),
        );
        setMilestoneCounts(Object.fromEntries(counts));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (orgLoading || loading) {
    return <p className="text-body text-neutral-600">Loading projects…</p>;
  }

  if (!selectedOrgId) {
    return <p className="text-body text-neutral-600">No organization selected.</p>;
  }

  if (error) {
    return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-display font-semibold text-neutral-950">Projects</h1>
        <span className="text-body text-neutral-600">{projects.length} total</span>
      </div>

      {projects.length === 0 ? (
        <p className="text-body text-neutral-600">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const snapshot = health[project.id];
            return (
              <CardLink
                key={project.id}
                href={`/projects/${project.id}`}
                color={projectStatusColor(project.status)}
                className="group flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-h3 font-semibold text-neutral-950 group-hover:underline">{project.name}</h2>
                  <ProjectStatusBadge status={project.status} />
                </div>

                <div className="text-small text-neutral-600">{milestoneCounts[project.id] ?? 0} milestones</div>

                {snapshot ? (
                  <div className="space-y-1.5 border-t border-neutral-200 pt-3">
                    <div className="flex gap-2">
                      {snapshot.signals.overdueTasks > 0 && <Badge color="danger">{snapshot.signals.overdueTasks} overdue</Badge>}
                      {snapshot.signals.blockedTasks > 0 && <Badge color="warning">{snapshot.signals.blockedTasks} blocked</Badge>}
                      {snapshot.signals.overdueTasks === 0 && snapshot.signals.blockedTasks === 0 && (
                        <Badge color="success">On track</Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 text-small text-neutral-600">{snapshot.aiSummary}</p>
                  </div>
                ) : (
                  <div className="border-t border-neutral-200 pt-3 text-small text-neutral-400">No health scan yet</div>
                )}
              </CardLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
