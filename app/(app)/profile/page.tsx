"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";

export default function ProfilePage() {
  const { orgs, selectedOrgId, loading: orgLoading } = useOrg();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Profile settings</h1>

      <Card className="space-y-4">
        <div>
          <p className="text-small text-neutral-600">Email</p>
          <p className="text-body-medium font-medium text-neutral-950">{email ?? "Loading…"}</p>
        </div>

        <div>
          <p className="mb-2 text-small text-neutral-600">Organizations</p>
          {orgLoading ? (
            <p className="text-body text-neutral-600">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="text-body text-neutral-600">Not a member of any organization.</p>
          ) : (
            <ul className="space-y-2">
              {orgs.map((org) => (
                <li key={org.id} className="flex items-center justify-between">
                  <span className="text-body text-neutral-950">{org.name}</span>
                  <Badge>{org.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {selectedOrgId && <ApiKeysSection orgId={selectedOrgId} />}
    </div>
  );
}

type ApiKey = { id: string; name: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

// FR-3.x (Prompt 3.2) task 4 — credentials for the read-only finance
// export at /api/v1/finance/projects. Org-level, not a project setting, so
// this lives on the profile page rather than a project's Settings tab.
function ApiKeysSection({ orgId }: { orgId: string }) {
  const { can } = useOrg();
  const canRead = can("api_key", "read");
  const canCreate = can("api_key", "create");
  const canDelete = can("api_key", "delete");

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/api-keys?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setKeys(b.data ?? []))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId, canRead]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create key");
      return;
    }
    setJustCreated({ name: body.data.name, key: body.data.key });
    setName("");
    load();
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    load();
  }

  if (!canRead) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-h2 font-semibold text-neutral-950">API keys</h2>
        <p className="mt-1 text-small text-neutral-600">
          For the read-only finance export (<code className="text-caption">GET /api/v1/finance/projects</code>) —
          external accounting/ERP tools authenticate with one of these instead of a user login.
        </p>
      </div>

      {justCreated && (
        <div className="space-y-1.5 rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-3">
          <p className="text-small font-medium text-warning-600">
            Copy this now — “{justCreated.name}” won&apos;t be shown again.
          </p>
          <code className="block break-all rounded-sm bg-neutral-50 px-2 py-1.5 text-small text-neutral-950">
            {justCreated.key}
          </code>
          <Button variant="secondary" onClick={() => setJustCreated(null)}>
            Done
          </Button>
        </div>
      )}

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {loading ? (
        <p className="text-body text-neutral-600">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-body text-neutral-600">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
              <div>
                <span className="text-neutral-950">{k.name}</span>
                <span className="ml-2 text-small text-neutral-600">
                  {k.revokedAt
                    ? "Revoked"
                    : k.lastUsedAt
                      ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                </span>
              </div>
              {canDelete && !k.revokedAt && (
                <button onClick={() => handleRevoke(k.id)} className="text-small text-danger-600 hover:underline">
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-4">
          <Field label="New key name">
            <Input
              className="min-w-0"
              placeholder="e.g. QuickBooks export"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={creating || !name}>
            {creating ? "Creating…" : "+ New Key"}
          </Button>
        </form>
      )}
    </Card>
  );
}
