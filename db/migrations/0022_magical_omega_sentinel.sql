CREATE TYPE "public"."sso_provider" AS ENUM('saml');--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'sso';--> statement-breakpoint
CREATE TABLE "sso_configurations" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"provider" "sso_provider" DEFAULT 'saml' NOT NULL,
	"idp_entity_id" text,
	"idp_sso_url" text,
	"idp_certificate" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sso_configurations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sso_configurations" ADD CONSTRAINT "sso_configurations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sso_configurations_isolation" ON "sso_configurations" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));