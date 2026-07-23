import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { candidates, jobPostings } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const jobPostingId = req.nextUrl.searchParams.get("job_posting_id");
    if (!jobPostingId) throw new ApiError(400, "job_posting_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      const [posting] = await db.select({ orgId: jobPostings.orgId }).from(jobPostings).where(eq(jobPostings.id, jobPostingId));
      if (!posting) return undefined;
      await requirePermission(db, userId, posting.orgId, "recruitment", "read");
      return db.select().from(candidates).where(eq(candidates.jobPostingId, jobPostingId));
    });
    if (rows === undefined) throw new ApiError(404, "Job posting not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.job_posting_id || !body.name) throw new ApiError(400, "job_posting_id and name are required");

    const row = await withOrgContext(userId, async (db) => {
      const [posting] = await db.select({ orgId: jobPostings.orgId }).from(jobPostings).where(eq(jobPostings.id, body.job_posting_id));
      if (!posting) return undefined;
      await requirePermission(db, userId, posting.orgId, "recruitment", "create");

      const [created] = await db
        .insert(candidates)
        .values({
          orgId: posting.orgId,
          jobPostingId: body.job_posting_id,
          name: body.name,
          email: body.email ?? null,
          stage: body.stage ?? undefined,
        })
        .returning();
      return created;
    });
    if (!row) throw new ApiError(404, "Job posting not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
