CREATE TYPE "public"."dependency_type" AS ENUM('blocks', 'blocked_by');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sprint_status" AS ENUM('planned', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_id" uuid
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"due_date" date
);
--> statement-breakpoint
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"goal_id" uuid,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"portfolio_id" uuid,
	"name" text NOT NULL,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"start_date" date,
	"end_date" date
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" "sprint_status" DEFAULT 'planned' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"type" "dependency_type" NOT NULL,
	CONSTRAINT "task_dependencies_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id"),
	CONSTRAINT "task_dependencies_no_self_reference" CHECK ("task_dependencies"."task_id" <> "task_dependencies"."depends_on_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"sprint_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'backlog' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"assignee_id" uuid,
	"estimate" integer
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"name" text NOT NULL,
	"structure" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "goals_isolation" ON "goals" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "milestones_isolation" ON "milestones" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "portfolios_isolation" ON "portfolios" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "projects_isolation" ON "projects" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "sprints_isolation" ON "sprints" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "task_dependencies_isolation" ON "task_dependencies" AS PERMISSIVE FOR ALL TO "authenticated" USING (
  exists (
    select 1 from tasks t
    where t.id = task_dependencies.task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
  and exists (
    select 1 from tasks t
    where t.id = task_dependencies.depends_on_task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
) WITH CHECK (
  exists (
    select 1 from tasks t
    where t.id = task_dependencies.task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
  and exists (
    select 1 from tasks t
    where t.id = task_dependencies.depends_on_task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
);--> statement-breakpoint
CREATE POLICY "tasks_isolation" ON "tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "templates_select" ON "templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (org_id is null or org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "templates_write" ON "templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "templates_update" ON "templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
CREATE POLICY "templates_delete" ON "templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (org_id in (select * from auth.user_org_ids()));