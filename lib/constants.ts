// Mirrors db/schema.ts's enum value lists — kept here once instead of
// re-declared per screen (ai/create-project, project detail, sprint board
// all needed the same lists).
export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "archived"] as const;
export const SPRINT_STATUSES = ["planned", "active", "completed"] as const;
export const TASK_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const EMPLOYMENT_STATUSES = ["active", "onboarding", "terminated"] as const;
export const ONBOARDING_STATUSES = ["not_started", "in_progress", "complete"] as const;

export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

// Where a status sits in the workflow, as a 0-100 completion percentage —
// not a subtask checklist (no such model exists). cancelled reads as
// "closed out," same treatment as done, since neither is still in flight.
// Shared by TaskCard's per-task progress bar and the dashboard's "Avg.
// Progress" stat, so the two numbers can't drift apart.
export const TASK_STATUS_PROGRESS: Record<(typeof TASK_STATUSES)[number], number> = {
  backlog: 0,
  todo: 15,
  in_progress: 55,
  in_review: 80,
  done: 100,
  cancelled: 100,
};
