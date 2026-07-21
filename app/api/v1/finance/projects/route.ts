import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { ApiKeyError, requireApiKeyOrgId } from "@/lib/api/apiKeys";

// FR-3.x (Prompt 3.2) task 4 — read-only export for external accounting/
// ERP tools. API-key authenticated (Authorization: Bearer <key> or
// X-API-Key), not the Supabase session every other route uses — see
// lib/api/apiKeys.ts. No AI, no writes: exactly the project-level budget
// fields, scoped strictly to the key's own org (the org is derived from
// the key match itself, never taken from a query param, so a valid key
// can never be used to read another org's data).
export async function GET(req: NextRequest) {
  try {
    const orgId = await requireApiKeyOrgId(req);

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        budgetAllocated: projects.budgetAllocated,
        budgetSpent: projects.budgetSpent,
      })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    return NextResponse.json({ data: rows });
  } catch (err) {
    if (err instanceof ApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
