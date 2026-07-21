// Machine-auth for /api/v1/* routes (Prompt 3.2 task 4) — external
// accounting/ERP tools have no Supabase session, so they can't use the
// Bearer-JWT + withOrgContext path every other route uses. Only the sha256
// hash of a key is ever persisted; the raw key is shown once at creation.
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";

const KEY_PREFIX = "c8_live_";

export function generateApiKey(): { raw: string; hash: string } {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashApiKey(raw) };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// No Supabase JWT exists for these requests, so there's no per-user RLS
// context to set — this reads via db/index.ts's plain connection (the
// Neon project's owner role, which Neon grants BYPASSRLS by default; see
// db/withOrgContext.ts's comment on the same gotcha). That's intentional
// here: authorization is enforced by the key match itself, in application
// code, not by RLS.
export async function requireApiKeyOrgId(req: Request): Promise<string> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const key = bearer ?? req.headers.get("x-api-key");
  if (!key) throw new ApiKeyError(401, "Missing API key (Authorization: Bearer <key> or X-API-Key header)");

  const hash = hashApiKey(key);
  const [row] = await db
    .select({ id: apiKeys.id, orgId: apiKeys.orgId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)));

  if (!row) throw new ApiKeyError(401, "Invalid or revoked API key");

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));

  return row.orgId;
}

export class ApiKeyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
