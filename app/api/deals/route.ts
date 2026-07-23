import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "deal", "read");
      return db.select().from(deals).where(eq(deals.orgId, orgId));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.account_id || !body.name) {
      throw new ApiError(400, "org_id, account_id, and name are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "deal", "create");
      return db
        .insert(deals)
        .values({
          orgId: body.org_id,
          accountId: body.account_id,
          contactId: body.contact_id ?? null,
          name: body.name,
          value: body.value ?? null,
          currency: body.currency ?? "USD",
          stage: body.stage ?? "prospecting",
          ownerId: body.owner_id ?? null,
          expectedCloseDate: body.expected_close_date ?? null,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
