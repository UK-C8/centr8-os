// Communicator agent (FR-10.x/FR-4.x) — client updates, standup summaries.
// Scaffolded per Prompt 2.1 task 2; not wired to a real job type yet — no
// phase prompt has specced its first real job (client portal AI update
// summaries land in Prompt 3.1).
import { AgentError } from "./shared/geminiClient";

export async function runCommunicatorJob(_input: unknown): Promise<never> {
  throw new AgentError("Communicator agent has no job types registered yet — see Prompt 3.1");
}
