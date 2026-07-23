"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";

type Contact = { id: string; accountId: string | null; name: string; email: string | null; phone: string | null; title: string | null };
type Account = { id: string; name: string };

export default function ContactsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/contacts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/accounts?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([contactsBody, accountsBody]) => {
        if (!contactsBody.data) throw new Error(contactsBody.error ?? "Failed to load contacts");
        setContacts(contactsBody.data);
        setAccounts(accountsBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contacts"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading contacts…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Contacts</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{contacts.length} total</span>
          {can("contact", "create") && <Button onClick={() => setShowNew(true)}>+ New Contact</Button>}
        </div>
      </div>

      {contacts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No contacts yet</EmptyTitle>
            <EmptyDescription>Contacts are created directly, or automatically when a lead is converted.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Contact info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-neutral-950">{c.name}</TableCell>
                  <TableCell className="text-neutral-600">{accountName(c.accountId)}</TableCell>
                  <TableCell className="text-neutral-600">{c.title ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{c.email ?? c.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <NewContactForm
            orgId={selectedOrgId}
            accounts={accounts}
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

function NewContactForm({
  orgId,
  accounts,
  onClose,
  onCreated,
}: {
  orgId: string;
  accounts: Account[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        name,
        account_id: accountId || null,
        title: title || null,
        email: email || null,
        phone: phone || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to create contact");
      return;
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Contact</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Account">
        <Select className="w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">No account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Title">
        <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Phone">
        <Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name}>
          {saving ? "Creating…" : "Create Contact"}
        </Button>
      </div>
    </form>
  );
}
