import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { onboardingWorkflows } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireEmployeeManageAccess } from "@/lib/api/employees";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ orgId: onboardingWorkflows.orgId, employeeId: onboardingWorkflows.employeeId })
        .from(onboardingWorkflows)
        .where(eq(onboardingWorkflows.id, id));
      if (!existing) return undefined;

      await requireEmployeeManageAccess(db, userId, existing.orgId, existing.employeeId);

      const [updated] = await db
        .update(onboardingWorkflows)
        .set({
          steps: body.steps ?? undefined,
          status: body.status ?? undefined,
          templateId: body.template_id === undefined ? undefined : body.template_id,
        })
        .where(eq(onboardingWorkflows.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Onboarding workflow not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
