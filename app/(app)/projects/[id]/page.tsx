"use client";

import { useEffect, useState, use } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import {
  ProjectStatusBadge,
  SprintStatusBadge,
  TaskStatusBadge,
  TaskPriorityBadge,
  sprintStatusColor,
} from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardButton } from "@/components/ui/Card";
import { Input, Select, Field } from "@/components/ui/Input";
import { SprintBoard } from "@/components/SprintBoard";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import type { Task } from "@/components/TaskCard";
import { PROJECT_STATUSES, TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES } from "@/lib/constants";

type Project = {
  id: string;
  orgId: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};
type Milestone = { id: string; name: string; dueDate: string | null };
type Sprint = { id: string; name: string; status: string; startDate: string | null; endDate: string | null };

const TABS = ["Overview", "Sprints", "Tasks", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { selectedOrgId, can } = useOrg();
  const canEditTasks = can("task", "update");

  const [tab, setTab] = useState<Tab>("Overview");
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/milestones?project_id=${id}`).then((r) => r.json()),
      fetch(`/api/sprints?project_id=${id}`).then((r) => r.json()),
      fetch(`/api/tasks?project_id=${id}`).then((r) => r.json()),
    ])
      .then(([p, m, s, t]) => {
        if (!p.data) throw new Error(p.error ?? "Failed to load project");
        setProject(p.data);
        setMilestones(m.data ?? []);
        setSprints(s.data ?? []);
        setTasks(t.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [id]);

  async function handleStatusChange(taskId: string, status: string) {
    // Optimistic update so the board feels immediate, then reconcile with
    // the server (which also re-runs the RBAC check — a viewer's drag
    // wouldn't reach here since canEdit already hides dragging, but this
    // covers any other path that calls it).
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) loadAll(); // revert to server truth on failure
  }

  if (loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  if (!project) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">{project.name}</h1>
          <p className="mt-1 text-body text-neutral-600">
            {project.startDate ?? "No start date"} – {project.endDate ?? "No end date"}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-600 hover:text-neutral-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab projectId={id} milestones={milestones} onMilestoneAdded={loadAll} />}
      {tab === "Sprints" && (
        <SprintsTab sprints={sprints} tasks={tasks} canEdit={canEditTasks} onTaskClick={setOpenTaskId} onStatusChange={handleStatusChange} />
      )}
      {tab === "Tasks" && <TasksTab tasks={tasks} onTaskClick={setOpenTaskId} />}
      {tab === "Settings" && project && (
        <SettingsTab project={project} orgId={selectedOrgId} onSaved={loadAll} />
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

function OverviewTab({
  projectId,
  milestones,
  onMilestoneAdded,
}: {
  projectId: string;
  milestones: Milestone[];
  onMilestoneAdded: () => void;
}) {
  const { selectedOrgId, can } = useOrg();
  const canCreate = can("milestone", "create");
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !selectedOrgId) return;
    setSaving(true);
    await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, project_id: projectId, name, due_date: dueDate || null }),
    });
    setName("");
    setDueDate("");
    setSaving(false);
    onMilestoneAdded();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-h3 font-semibold text-neutral-800">Milestones</h2>
      {milestones.length === 0 ? (
        <p className="text-body text-neutral-600">No milestones yet.</p>
      ) : (
        <Card padding="sm" className="p-0">
          <ul className="divide-y divide-neutral-200">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-3 text-body">
                <span className="text-neutral-950">{m.name}</span>
                <span className="text-neutral-600">{m.dueDate ?? "No due date"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canCreate && (
        <form onSubmit={addMilestone} className="flex flex-wrap gap-2">
          <Input className="min-w-0 flex-1" placeholder="New milestone name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button type="submit" disabled={saving || !name}>
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

function SprintsTab({
  sprints,
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
}: {
  sprints: Sprint[];
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
}) {
  const [openSprintId, setOpenSprintId] = useState<string | null>(null);

  if (sprints.length === 0) return <p className="text-body text-neutral-600">No sprints yet.</p>;

  const openSprint = sprints.find((s) => s.id === openSprintId);
  if (openSprint) {
    const sprintTasks = tasks.filter((t) => t.sprintId === openSprint.id);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setOpenSprintId(null)}>
            ← Sprints
          </Button>
          <span className="text-body-medium font-medium text-neutral-950">{openSprint.name}</span>
          <SprintStatusBadge status={openSprint.status} />
        </div>
        <SprintBoard tasks={sprintTasks} canEdit={canEdit} onTaskClick={onTaskClick} onStatusChange={onStatusChange} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sprints.map((s) => {
        const sprintTasks = tasks.filter((t) => t.sprintId === s.id);
        return (
          <CardButton key={s.id} onClick={() => setOpenSprintId(s.id)} color={sprintStatusColor(s.status)} padding="sm">
            <div className="flex items-center justify-between">
              <span className="text-body-medium font-medium text-neutral-950">{s.name}</span>
              <SprintStatusBadge status={s.status} />
            </div>
            <p className="mt-1 text-small text-neutral-600">
              {s.startDate ?? "No start"} – {s.endDate ?? "No end"} · {sprintTasks.length} tasks
            </p>
          </CardButton>
        );
      })}
    </div>
  );
}

function TasksTab({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (taskId: string) => void }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const filtered = tasks.filter(
    (t) =>
      (statusFilter === "all" || t.status === statusFilter) &&
      (priorityFilter === "all" || t.priority === priorityFilter) &&
      (assigneeFilter === "" || (t.assigneeId ?? "").includes(assigneeFilter)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
        <Input placeholder="Filter by assignee ID" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-body text-neutral-600">No tasks match.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-300">
          <table className="w-full min-w-[560px] text-body">
            <thead className="bg-neutral-100">
              <tr className="text-left text-caption font-medium uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Estimate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-neutral-50">
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => onTaskClick(t.id)} className="cursor-pointer hover:bg-neutral-100">
                  <td className="px-4 py-3 text-neutral-950">{t.title}</td>
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
    </div>
  );
}

function SettingsTab({ project, orgId, onSaved }: { project: Project; orgId: string | null; onSaved: () => void }) {
  const { can } = useOrg();
  const canUpdate = can("project", "update");
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="max-w-md space-y-4">
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} disabled={!canUpdate} />
      </Field>
      <Field label="Status">
        <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canUpdate}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-small text-neutral-400">Org: {orgId}</p>
      {canUpdate ? (
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      ) : (
        <p className="text-small text-neutral-400">Your role doesn't allow editing project settings.</p>
      )}
    </form>
  );
}
