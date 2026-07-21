// The worker is trusted infra, not a per-user request — it connects as
// service_role (bypasses RLS, same pattern as db/seed.ts) rather than
// impersonating a user via the request.jwt.claim.sub trick db/withOrgContext.ts
// uses. Every query below stays explicitly org_id/project_id-scoped in its
// own WHERE clause regardless, the same way lib/agents/monitor.ts's signal
// queries already were before this migration — RLS bypass here is about
// who's allowed to poll ANY org's queue (a trusted worker), not license to
// skip scoping the data itself.
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { agentJobs, auditLog } from "@/db/schema";

const pool = new Pool({ connectionString: process.env.NEON_POOLED_URL });

export type ServiceDb = NeonDatabase<typeof schema>;

export interface ClaimedJob {
  id: string;
  orgId: string;
  agentType: string;
  jobType: string;
  tier: string;
  requestedByUserId: string | null;
  input: unknown;
}

async function withServiceRole<T>(fn: (client: PoolClient, db: ServiceDb) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set role service_role");
    const db = drizzle(client, { schema });
    const result = await fn(client, db);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// One transaction: lock and claim the oldest pending job (skipping any row
// another worker instance already has locked), mark it processing, and
// hand it back. Returns null if the queue is empty right now.
export async function claimNextJob(): Promise<ClaimedJob | null> {
  return withServiceRole(async (client, db) => {
    const { rows } = await client.query<{
      id: string;
      org_id: string;
      agent_type: string;
      job_type: string;
      tier: string;
      requested_by_user_id: string | null;
      input: unknown;
    }>(
      `select id, org_id, agent_type, job_type, tier, requested_by_user_id, input
       from agent_jobs
       where status = 'pending'
       order by created_at
       limit 1
       for update skip locked`,
    );

    const row = rows[0];
    if (!row) return null;

    await db.update(agentJobs).set({ status: "processing", startedAt: new Date() }).where(eq(agentJobs.id, row.id));

    return {
      id: row.id,
      orgId: row.org_id,
      agentType: row.agent_type,
      jobType: row.job_type,
      tier: row.tier,
      requestedByUserId: row.requested_by_user_id,
      input: row.input,
    };
  });
}

// Marks the job done/failed and writes the audit_log entry in the same
// transaction — "each agent call logs its autonomy tier, input, output,
// and org_id to audit_log" (Prompt 2.1 task 4), success or failure alike,
// from the one place every job passes through instead of each API route
// doing it separately.
export async function finishJob(job: {
  id: string;
  orgId: string;
  tier: string;
  input: unknown;
  requestedByUserId: string | null;
  auditAction: string;
  targetType: string;
  targetId: string;
  status: "done" | "failed";
  output: unknown;
  errorMessage: string | null;
}): Promise<void> {
  await withServiceRole(async (_client, db) => {
    await db
      .update(agentJobs)
      .set({
        status: job.status,
        output: job.output ?? null,
        errorMessage: job.errorMessage,
        finishedAt: new Date(),
      })
      .where(eq(agentJobs.id, job.id));

    await db.insert(auditLog).values({
      orgId: job.orgId,
      actorUserId: job.requestedByUserId,
      actorType: "ai",
      action: job.status === "done" ? job.auditAction : `${job.auditAction}_failed`,
      targetType: job.targetType,
      targetId: job.targetId,
      metadata: {
        tier: job.tier,
        input: job.input,
        output: job.output ?? null,
        error: job.errorMessage,
      },
    });
  });
}
