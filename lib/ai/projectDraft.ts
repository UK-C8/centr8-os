// Shape returned by /api/ai/create-project-draft and accepted (edited or
// not) by /api/ai/create-project-draft/accept. Mirrors the Phase 1.3 tables
// closely enough that accept can insert it almost verbatim.
export interface ProjectDraft {
  goal: { title: string; description: string | null };
  project: {
    name: string;
    description: string | null;
    status: "planning" | "active" | "on_hold" | "completed" | "archived";
    start_date: string | null;
    end_date: string | null;
  };
  milestones: { name: string; due_date: string | null }[];
  sprints: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    status: "planned" | "active" | "completed";
  }[];
  tasks: {
    title: string;
    description: string | null;
    priority: "low" | "medium" | "high" | "urgent";
    estimate: number | null;
    // Index into `sprints` above, or null — tasks have no milestone_id
    // column in the schema, so there's no equivalent milestone link.
    sprint_index: number | null;
  }[];
}
