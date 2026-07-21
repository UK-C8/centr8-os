// Machine-auth for the client portal (Prompt 3.1) — a client contact has
// no Supabase Auth account, so the portal URL itself carries a bearer
// token (?token=...) instead. Same shape as lib/api/apiKeys.ts's Prompt
// 3.2 pattern: only the sha256 hash is ever persisted, and authorization
// is the token match itself (application code), not RLS — there's no user
// JWT to set request.jwt.claim.sub from. A query param rather than a
// header because this is a URL a client pastes into a browser, not an
// API-client request that can set custom headers.
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/db";
import { clientPortalAccess } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";

const TOKEN_PREFIX = "portal_";

export function generatePortalToken(): { raw: string; hash: string } {
  const raw = `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashPortalToken(raw) };
}

export function hashPortalToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface PortalGrant {
  id: string;
  orgId: string;
  projectId: string;
  clientName: string;
  hiddenFields: string[];
}

export async function requirePortalGrant(token: string | null): Promise<PortalGrant> {
  if (!token) throw new PortalAccessError(401, "Missing access token");

  const hash = hashPortalToken(token);
  const [row] = await db
    .select({
      id: clientPortalAccess.id,
      orgId: clientPortalAccess.orgId,
      projectId: clientPortalAccess.projectId,
      clientName: clientPortalAccess.clientName,
      hiddenFields: clientPortalAccess.hiddenFields,
    })
    .from(clientPortalAccess)
    .where(and(eq(clientPortalAccess.tokenHash, hash), isNull(clientPortalAccess.revokedAt)));

  if (!row) throw new PortalAccessError(401, "Invalid or revoked access link");

  return row as PortalGrant;
}

export class PortalAccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
