// Analyst agent (FR-13.x) — comparative analysis, executive insights.
// Scaffolded per Prompt 2.1 task 2; not wired to a real job type yet. The
// executive dashboard's "Recommended actions" list stays the Prompt 0.4
// hardcoded placeholder until Prompt 2.7 gives this a real job to run.
import { AgentError } from "./shared/geminiClient";

export async function runAnalystJob(_input: unknown): Promise<never> {
  throw new AgentError("Analyst agent has no job types registered yet — see Prompt 2.7");
}
