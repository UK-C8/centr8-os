"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { ProjectStatusBadge, Badge, projectStatusColor } from "@/components/ui/Badge";
import { CardLink } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { PROJECT_STATUSES } from "@/lib/constants";

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
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestoneCounts, setMilestoneCounts] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<Record<string, HealthSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);

  function loadAll() {
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
  }

  useEffect(loadAll, [selectedOrgId]);

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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Projects</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{projects.length} total</span>
          {can("project", "create") && (
            <Button onClick={() => setShowNewProject(true)}>+ New Project</Button>
          )}
        </div>
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

      {showNewProject && (
        <Modal onClose={() => setShowNewProject(false)}>
          <NewProjectForm
            orgId={selectedOrgId}
            onClose={() => setShowNewProject(false)}
            onCreated={() => {
              setShowNewProject(false);
              loadAll();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function NewProjectForm({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<(typeof PROJECT_STATUSES)[number]>("planning");
  const [portfolioId, setPortfolioId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        name,
        status,
        portfolio_id: portfolioId || null,
        start_date: startDate || null,
        end_date: endDate || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create project");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Project</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>

      <Field label="Status">
        <Select
          className="w-full"
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof PROJECT_STATUSES)[number])}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      {/* No portfolios list endpoint exists yet — same "raw id, not a
          picker" pattern already used for task assignee elsewhere in the
          app. Optional: projects.portfolio_id is nullable. */}
      <Field label="Portfolio ID (optional)">
        <Input
          className="w-full"
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          placeholder="Leave blank if not part of a portfolio"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start date">
          <Input type="date" className="w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <Input type="date" className="w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name}>
          {saving ? "Creating…" : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
