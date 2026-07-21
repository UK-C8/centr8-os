ALTER TYPE "public"."permission_action" ADD VALUE 'approve';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'configure';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'portal';--> statement-breakpoint
CREATE TABLE "client_portal_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"token_hash" text NOT NULL,
	"hidden_fields" jsonb DEFAULT '["budget"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "client_portal_access_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "client_portal_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "approved_by_client_access_id" uuid;--> statement-breakpoint
ALTER TABLE "client_portal_access" ADD CONSTRAINT "client_portal_access_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_access" ADD CONSTRAINT "client_portal_access_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_approved_by_client_access_id_client_portal_access_id_fk" FOREIGN KEY ("approved_by_client_access_id") REFERENCES "public"."client_portal_access"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "client_portal_access_isolation" ON "client_portal_access" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));