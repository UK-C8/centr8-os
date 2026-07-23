// Shared Supabase Auth admin client — service-role key, server-only. Used
// anywhere the app needs to create/look up/invite auth accounts directly
// rather than through a user's own session (SCIM provisioning, org member
// invites).
import { createClient } from "@supabase/supabase-js";

export function supabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function findAuthUserByEmail(email: string) {
  const supabase = supabaseAdminClient();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
  }
}
