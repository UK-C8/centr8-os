"use client";

import { useState } from "react";
import { TaskCard, type Task } from "@/components/TaskCard";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";

// The mock spec (Prompt 0.3) names four columns (To Do / In Progress / In
// Review / Done), but the real task_status enum has six values (backlog,
// cancelled too) — dropping backlog/cancelled tasks off the board entirely
// would make them silently disappear, so all six are shown.
export function SprintBoard({
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
}: {
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setDragOverStatus(status);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/plain");
              setDragOverStatus(null);
              if (taskId) onStatusChange(taskId, status);
            }}
            className={`w-64 shrink-0 rounded-md border p-3 transition-colors ${
              dragOverStatus === status ? "border-primary-600 bg-primary-100" : "border-neutral-300 bg-neutral-100"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-caption font-medium uppercase tracking-wide text-neutral-600">
                {TASK_STATUS_LABELS[status]}
              </h3>
              <span className="text-small text-neutral-400">{columnTasks.length}</span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                  onClick={() => onTaskClick(task.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
