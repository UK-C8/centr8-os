"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/ui/Badge";
import { Select, Input } from "@/components/ui/Input";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import type { Task } from "@/components/TaskCard";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES } from "@/lib/constants";

type Project = { id: string; name: string };

// Same fan-out pattern as /sprints — /api/tasks has no org-wide list
// endpoint, only project_id/sprint_id scoped, so this fetches every
// project's tasks in parallel and aggregates client-side.
export default function TasksPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/projects?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then(async (projectsBody) => {
        if (!projectsBody.data) throw new Error(projectsBody.error ?? "Failed to load projects");
        const projectList: Project[] = projectsBody.data;
        setProjects(projectList);

        const perProject = await Promise.all(
          projectList.map((p) =>
            fetch(`/api/tasks?project_id=${p.id}`)
              .then((r) => r.json())
              .then((b) => (b.data ?? []) as (Task & { projectId: string })[])
              .catch(() => []),
          ),
        );
        setTasks(perProject.flat());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tasks"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Unknown project";
  const filtered = (tasks as (Task & { projectId: string })[]).filter(
    (t) =>
      (statusFilter === "all" || t.status === statusFilter) &&
      (priorityFilter === "all" || t.priority === priorityFilter) &&
      (projectFilter === "all" || t.projectId === projectFilter),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Tasks</h1>

      <div className="flex flex-wrap gap-2">
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      {tasks.length === 0 ? (
        <p className="text-body text-neutral-600">No tasks yet. Create one from a project's Tasks tab.</p>
      ) : filtered.length === 0 ? (
        <p className="text-body text-neutral-600">No tasks match.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-300">
          <table className="w-full min-w-[640px] text-body">
            <thead className="bg-neutral-100">
              <tr className="text-left text-caption font-medium uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Estimate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-neutral-50">
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => setOpenTaskId(t.id)} className="cursor-pointer hover:bg-neutral-100">
                  <td className="px-4 py-3 text-neutral-950">{t.title}</td>
                  <td className="px-4 py-3 text-neutral-600">{projectName(t.projectId)}</td>
                  <td className="px-4 py-3">
                    <TaskPriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <TaskStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{t.estimate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => {
            setOpenTaskId(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}
