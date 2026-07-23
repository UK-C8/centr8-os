CREATE TYPE "public"."activity_related_type" AS ENUM('lead', 'contact', 'account', 'deal');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('call', 'meeting', 'task', 'note');--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('prospecting', 'proposal', 'negotiation', 'won', 'lost');--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'deal';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'activity';--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"related_type" "activity_related_type" NOT NULL,
	"related_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"notes" text,
	"due_date" date,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"value" numeric(12, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"stage" "deal_stage" DEFAULT 'prospecting' NOT NULL,
	"owner_id" uuid,
	"expected_close_date" date
);
--> statement-breakpoint
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "activities_isolation" ON "activities" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "deals_isolation" ON "deals" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));