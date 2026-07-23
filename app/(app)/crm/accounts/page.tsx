"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Field } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";

type Account = { id: string; name: string; industry: string | null; website: string | null };

export default function AccountsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/accounts?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load accounts");
        setAccounts(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load accounts"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading accounts…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Accounts</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{accounts.length} total</span>
          {can("account", "create") && <Button onClick={() => setShowNew(true)}>+ New Account</Button>}
        </div>
      </div>

      {accounts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No accounts yet</EmptyTitle>
            <EmptyDescription>Accounts are created directly, or automatically when a lead is converted.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Website</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-neutral-950">{a.name}</TableCell>
                  <TableCell className="text-neutral-600">{a.industry ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{a.website ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <NewAccountForm
            orgId={selectedOrgId}
            onClose={() => setShowNew(false)}
            onCreated={() => {
              setShowNew(false);
              loadAll();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function NewAccountForm({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name, industry: industry || null, website: website || null }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to create account");
      return;
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Account</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Industry">
        <Input className="w-full" value={industry} onChange={(e) => setIndustry(e.target.value)} />
      </Field>
      <Field label="Website">
        <Input className="w-full" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name}>
          {saving ? "Creating…" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}
