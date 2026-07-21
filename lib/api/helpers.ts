import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { agentJobs } from "@/db/schema";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Browser callers authenticate via the Supabase session cookie; scripted/API
// callers (curl, future FR-6.x API clients) pass `Authorization: Bearer
// <access_token>` instead, since they have no cookie jar to carry a session.
export async function requireUserId(req?: NextRequest): Promise<string> {
  const supabase = await createClient();
  const bearer = req?.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];

  const { data, error } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return data.user.id;
}

// Prompt 2.1 task 5: API routes enqueue an agent_jobs row and poll for the
// result instead of calling Gemini inline. Each poll is its own short
// withOrgContext call rather than one held-open transaction for the whole
// wait — same reasoning app/api/ai/project-health/route.ts's old comment
// gave for keeping the Gemini call outside a transaction: don't hold a
// pooled connection open across a slow wait.
export async function pollAgentJob(
  userId: string,
  jobId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const intervalMs = opts.intervalMs ?? 400;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [job] = await withOrgContext(userId, (db) =>
      db.select().from(agentJobs).where(eq(agentJobs.id, jobId)),
    );
    if (!job) throw new ApiError(404, "Agent job not found");
    if (job.status === "done") return job;
    if (job.status === "failed") throw new ApiError(502, job.errorMessage ?? "Agent job failed");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new ApiError(504, "Agent job timed out — the worker may be offline (run `npm run worker` locally, or check the Railway service)");
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
