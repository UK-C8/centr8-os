CREATE TYPE "public"."agent_job_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('planner', 'monitor', 'analyst', 'writer', 'communicator');--> statement-breakpoint
CREATE TYPE "public"."autonomy_tier" AS ENUM('tier_0', 'tier_1', 'tier_2', 'tier_3');--> statement-breakpoint
CREATE TABLE "agent_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"job_type" text NOT NULL,
	"tier" "autonomy_tier" DEFAULT 'tier_0' NOT NULL,
	"status" "agent_job_status" DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "agent_jobs_isolation" ON "agent_jobs" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));