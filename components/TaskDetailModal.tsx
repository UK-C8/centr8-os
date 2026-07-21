"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Field } from "@/components/ui/Input";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES } from "@/lib/constants";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimate: number | null;
  assigneeId: string | null;
};

type Dependency = { taskId: string; dependsOnTaskId: string; type: string; dependsOnTitle?: string };

export function TaskDetailModal({ taskId, onClose, onChanged }: { taskId: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useOrg();
  const canUpdateTask = can("task", "update");
  const canAddDependency = can("task_dependency", "create");
  const canRemoveDependency = can("task_dependency", "delete");
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newDepId, setNewDepId] = useState("");
  const [newDepType, setNewDepType] = useState("blocks");
  const [depError, setDepError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/tasks/${taskId}`).then((r) => r.json()),
      fetch(`/api/tasks/${taskId}/dependencies`).then((r) => r.json()),
    ])
      .then(async ([taskBody, depBody]) => {
        if (!taskBody.data) throw new Error(taskBody.error ?? "Failed to load task");
        setTask(taskBody.data);

        // No endpoint returns dependency titles joined — resolved
        // per-dependency here (small N per task, same pattern as the
        // project list's per-project milestone counts).
        const deps: Dependency[] = depBody.data ?? [];
        const resolved = await Promise.all(
          deps.map(async (d) => {
            const r = await fetch(`/api/tasks/${d.dependsOnTaskId}`).then((res) => res.json());
            return { ...d, dependsOnTitle: r.data?.title ?? d.dependsOnTaskId };
          }),
        );
        setDependencies(resolved);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load task"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [taskId]);

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        estimate: task.estimate,
        assignee_id: task.assigneeId,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onChanged();
  }

  async function addDependency() {
    setDepError(null);
    if (!newDepId) return;
    const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depends_on_task_id: newDepId, type: newDepType }),
    });
    const body = await res.json();
    if (!res.ok) {
      setDepError(body.error ?? "Failed to add dependency");
      return;
    }
    setNewDepId("");
    load();
  }

  async function removeDependency(dependsOnTaskId: string) {
    await fetch(`/api/tasks/${taskId}/dependencies?depends_on_task_id=${dependsOnTaskId}`, { method: "DELETE" });
    load();
  }

  return (
    <Modal onClose={onClose}>
      {loading ? (
        <p className="text-body text-neutral-600">Loading…</p>
      ) : !task ? (
        <p className="text-body text-danger-600">{error ?? "Task not found"}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <input
              className="flex-1 rounded-md border border-transparent bg-transparent text-h2 font-semibold text-neutral-950 focus:border-neutral-300 focus:bg-neutral-50 focus:outline focus:outline-2 focus:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              disabled={!canUpdateTask}
            />
            <button onClick={onClose} className="ml-3 text-body text-neutral-600 hover:text-neutral-950" aria-label="Close">
              ✕
            </button>
          </div>

          {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

          <Field label="Description">
            <Textarea className="w-full" rows={3} value={task.description ?? ""} onChange={(e) => setTask({ ...task, description: e.target.value || null })} disabled={!canUpdateTask} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select className="w-full" value={task.status} onChange={(e) => setTask({ ...task, status: e.target.value })} disabled={!canUpdateTask}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select className="w-full" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })} disabled={!canUpdateTask}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estimate (pts)">
              <Input
                type="number"
                className="w-full"
                value={task.estimate ?? ""}
                onChange={(e) => setTask({ ...task, estimate: e.target.value ? Number(e.target.value) : null })}
                disabled={!canUpdateTask}
              />
            </Field>
            {/* No user directory endpoint exists — assignee is a raw user id, not a name picker. */}
            <Field label="Assignee (user ID)">
              <Input
                className="w-full"
                value={task.assigneeId ?? ""}
                onChange={(e) => setTask({ ...task, assigneeId: e.target.value || null })}
                placeholder="Unassigned"
                disabled={!canUpdateTask}
              />
            </Field>
          </div>

          <div className="space-y-2 border-t border-neutral-200 pt-4">
            <h3 className="text-h3 font-semibold text-neutral-950">Dependencies</h3>
            {dependencies.length === 0 ? (
              <p className="text-small text-neutral-600">None.</p>
            ) : (
              <ul className="space-y-1.5">
                {dependencies.map((d) => (
                  <li key={d.dependsOnTaskId} className="flex items-center justify-between text-body">
                    <span className="text-neutral-950">
                      {d.dependsOnTitle} <Badge>{d.type}</Badge>
                    </span>
                    {canRemoveDependency && (
                      <button
                        onClick={() => removeDependency(d.dependsOnTaskId)}
                        className="text-small text-danger-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {depError && <p className="text-small text-danger-600">{depError}</p>}
            {canAddDependency && (
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-0 flex-1" placeholder="Depends-on task ID" value={newDepId} onChange={(e) => setNewDepId(e.target.value)} />
                <Select value={newDepType} onChange={(e) => setNewDepType(e.target.value)}>
                  <option value="blocks">blocks</option>
                  <option value="blocked_by">blocked_by</option>
                </Select>
                <Button variant="secondary" onClick={addDependency} disabled={!newDepId}>
                  Add
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canUpdateTask && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
