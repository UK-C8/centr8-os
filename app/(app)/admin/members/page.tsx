"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { ORG_ROLES } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";

type Member = { userId: string; email: string | null; role: string; deactivatedAt: string | null };

export default function MembersPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("organization", "update");

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/org-members?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load members");
        setMembers(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load members"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  async function changeRole(userId: string, role: string) {
    if (!selectedOrgId) return;
    await fetch(`/api/org-members/${userId}?org_id=${selectedOrgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    loadAll();
  }

  async function toggleDeactivated(userId: string, deactivated: boolean) {
    if (!selectedOrgId) return;
    await fetch(`/api/org-members/${userId}?org_id=${selectedOrgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deactivated }),
    });
    loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!canManage) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Members & Roles</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{members.length} total</span>
          <Button onClick={() => setShowInvite(true)}>+ Invite member</Button>
        </div>
      </div>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-body text-neutral-950">{m.email ?? m.userId}</p>
              {m.deactivatedAt && <Badge color="neutral">Deactivated</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={m.role}
                onChange={(e) => changeRole(m.userId, e.target.value)}
                disabled={!!m.deactivatedAt}
              >
                {ORG_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              {m.deactivatedAt ? (
                <Button variant="secondary" onClick={() => toggleDeactivated(m.userId, false)}>
                  Reactivate
                </Button>
              ) : (
                <Button variant="danger" onClick={() => toggleDeactivated(m.userId, true)}>
                  Deactivate
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {showInvite && (
        <Modal onClose={() => setShowInvite(false)}>
          <InviteForm
            orgId={selectedOrgId}
            onClose={() => setShowInvite(false)}
            onInvited={() => {
              setShowInvite(false);
              loadAll();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function InviteForm({ orgId, onClose, onInvited }: { orgId: string; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ORG_ROLES)[number]>("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/org-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, email, role }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to invite member");
      return;
    }
    onInvited();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">Invite member</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Email">
        <Input
          type="email"
          className="w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          placeholder="name@example.com"
        />
      </Field>

      <Field label="Role">
        <Select className="w-full" value={role} onChange={(e) => setRole(e.target.value as (typeof ORG_ROLES)[number])}>
          {ORG_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>

      <p className="text-small text-neutral-600">
        Sends a Supabase invite email with a sign-in link. If the email already has an account, they&apos;re just
        added to this org.
      </p>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !email}>
          {saving ? "Inviting…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
