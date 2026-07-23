ALTER TYPE "public"."permission_action" ADD VALUE 'view_sensitive';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'compensation';--> statement-breakpoint
CREATE TABLE "compensation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"base_salary" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"effective_date" date NOT NULL,
	"bonus" jsonb,
	"benefits" jsonb
);
--> statement-breakpoint
ALTER TABLE "compensation_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "compensation_records_isolation" ON "compensation_records" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));