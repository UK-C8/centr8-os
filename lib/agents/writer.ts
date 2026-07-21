// Writer agent (FR-10.x) — generative docs (PRDs, SOPs, release notes,
// reports). Scaffolded per Prompt 2.1 task 2; not wired to a real job type
// yet — see Prompt 2.6 for the generative documentation engine.
import { AgentError } from "./shared/geminiClient";

export async function runWriterJob(_input: unknown): Promise<never> {
  throw new AgentError("Writer agent has no job types registered yet — see Prompt 2.6");
}
