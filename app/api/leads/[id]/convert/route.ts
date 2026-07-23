import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { convertLead } from "@/lib/api/leadConversion";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: leads.orgId }).from(leads).where(eq(leads.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "lead", "update");
      await requirePermission(db, userId, existing.orgId, "account", "create");
      await requirePermission(db, userId, existing.orgId, "contact", "create");

      return convertLead(db, id, existing.orgId, userId);
    });
    if (!row) throw new ApiError(404, "Lead not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
