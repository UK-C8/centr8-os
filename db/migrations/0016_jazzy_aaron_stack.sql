ALTER TYPE "public"."resource_type" ADD VALUE 'budget';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'capacity';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'api_key';--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprint_capacities" (
	"org_id" uuid NOT NULL,
	"sprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"capacity" integer NOT NULL,
	CONSTRAINT "sprint_capacities_sprint_id_user_id_pk" PRIMARY KEY("sprint_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "sprint_capacities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_allocated" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_spent" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_capacities" ADD CONSTRAINT "sprint_capacities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_capacities" ADD CONSTRAINT "sprint_capacities_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "api_keys_isolation" ON "api_keys" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "sprint_capacities_isolation" ON "sprint_capacities" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));