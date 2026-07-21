CREATE TYPE "public"."permission_action" AS ENUM('create', 'read', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('organization', 'department', 'team', 'project', 'milestone', 'sprint', 'task', 'task_dependency');--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"role" text NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"action" "permission_action" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_memberships" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "permissions_select" ON "permissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (org_id is null or org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "permissions_write" ON "permissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "permissions_update" ON "permissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "permissions_delete" ON "permissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
DROP TYPE "public"."role";