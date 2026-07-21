// Standalone long-running process — the Railway worker service (CLAUDE.md
// §2, Prompt 2.1). Deployed separately from the Next.js app (which stays
// on Vercel): a Railway service pointed at this same repo with its start
// command set to `npm run worker` instead of the Next.js default. Not
// invoked by, or importable from, any Next.js API route — those enqueue a
// row in `agent_jobs` and poll for the result instead (see
// app/api/ai/create-project-draft/route.ts and .../project-health/route.ts).
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "@/db/schema";
import { claimNextJob, finishJob } from "./db";
import { buildRegistry } from "@/lib/agents/registry";

const POLL_INTERVAL_MS = 1000;
const IDLE_LOG_EVERY_N_POLLS = 30; // ~30s at the default interval, so idle running isn't silent but also isn't noisy

let running = true;
process.on("SIGINT", () => {
  console.log("agent-worker: received SIGINT, finishing current job then exiting");
  running = false;
});
process.on("SIGTERM", () => {
  console.log("agent-worker: received SIGTERM, finishing current job then exiting");
  running = false;
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  console.log(`agent-worker: claimed job ${job.id} (${job.agentType}/${job.jobType}, org ${job.orgId})`);

  // A dedicated db handle for this job's registry build — the Monitor
  // handler queries live task/sprint data through it (see
  // lib/agents/monitor.ts's makeProjectHealthScanJob), separate from the
  // claim/finish transactions in workers/db.ts.
  const pool = new Pool({ connectionString: process.env.NEON_POOLED_URL });
  const client = await pool.connect();
  try {
    await client.query("set role service_role");
    const db = drizzle(client, { schema });
    const registry = buildRegistry(db);
    const definition = registry[job.jobType];

    if (!definition) {
      await finishJob({
        id: job.id,
        orgId: job.orgId,
        tier: job.tier,
        input: job.input,
        requestedByUserId: job.requestedByUserId,
        auditAction: `unknown_job_type_${job.jobType}`,
        targetType: "organization",
        targetId: job.orgId,
        status: "failed",
        output: null,
        errorMessage: `No agent registered for job_type "${job.jobType}"`,
      });
      console.error(`agent-worker: job ${job.id} failed — no handler for job_type "${job.jobType}"`);
      return true;
    }

    try {
      const output = await definition.handler(job.input);
      await finishJob({
        id: job.id,
        orgId: job.orgId,
        tier: job.tier,
        input: job.input,
        requestedByUserId: job.requestedByUserId,
        auditAction: definition.auditAction,
        targetType: definition.targetType,
        targetId: definition.targetId(job.orgId, job.input),
        status: "done",
        output,
        errorMessage: null,
      });
      console.log(`agent-worker: job ${job.id} done`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await finishJob({
        id: job.id,
        orgId: job.orgId,
        tier: job.tier,
        input: job.input,
        requestedByUserId: job.requestedByUserId,
        auditAction: definition.auditAction,
        targetType: definition.targetType,
        targetId: definition.targetId(job.orgId, job.input),
        status: "failed",
        output: null,
        errorMessage: message,
      });
      console.error(`agent-worker: job ${job.id} failed — ${message}`);
    }
  } finally {
    client.release();
    await pool.end();
  }

  return true;
}

async function main() {
  console.log("agent-worker: starting, polling agent_jobs every", POLL_INTERVAL_MS, "ms");
  let idlePolls = 0;
  while (running) {
    const worked = await runOnce();
    if (worked) {
      idlePolls = 0;
    } else {
      idlePolls++;
      if (idlePolls % IDLE_LOG_EVERY_N_POLLS === 0) {
        console.log("agent-worker: idle, queue empty");
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }
  console.log("agent-worker: stopped");
  process.exit(0);
}

main().catch((err) => {
  console.error("agent-worker: fatal error", err);
  process.exit(1);
});
