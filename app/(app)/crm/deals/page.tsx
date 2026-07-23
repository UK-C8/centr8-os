"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { DealBoard, type Deal } from "@/components/DealBoard";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { DEAL_STAGES } from "@/lib/constants";

type RawDeal = {
  id: string;
  accountId: string;
  contactId: string | null;
  name: string;
  value: number | null;
  currency: string;
  stage: (typeof DEAL_STAGES)[number];
  expectedCloseDate: string | null;
};
type Account = { id: string; name: string };
type Contact = { id: string; name: string; accountId: string | null };

export default function DealsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [deals, setDeals] = useState<RawDeal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [openDealId, setOpenDealId] = useState<string | null>(null);

  const canEdit = can("deal", "update");

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/deals?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/accounts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/contacts?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([dealsBody, accountsBody, contactsBody]) => {
        if (!dealsBody.data) throw new Error(dealsBody.error ?? "Failed to load deals");
        setDeals(dealsBody.data);
        setAccounts(accountsBody.data ?? []);
        setContacts(contactsBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load deals"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";

  const boardDeals: Deal[] = useMemo(
    () =>
      deals.map((d) => ({
        id: d.id,
        name: d.name,
        accountName: accountName(d.accountId),
        value: d.value,
        currency: d.currency,
        stage: d.stage,
        expectedCloseDate: d.expectedCloseDate,
      })),
    [deals, accounts],
  );

  async function handleStageChange(dealId: string, stage: string) {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: stage as RawDeal["stage"] } : d)));
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading deals…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const openDeal = deals.find((d) => d.id === openDealId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Deals / Pipeline</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{deals.length} total</span>
          {can("deal", "create") && accounts.length > 0 && <Button onClick={() => setShowNew(true)}>+ New Deal</Button>}
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
            <EmptyDescription>A deal needs an account — create one on the Accounts page first.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <DealBoard deals={boardDeals} canEdit={canEdit} onDealClick={setOpenDealId} onStageChange={handleStageChange} />
      )}

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <NewDealForm
            orgId={selectedOrgId}
            accounts={accounts}
            contacts={contacts}
            onClose={() => setShowNew(false)}
            onCreated={() => {
              setShowNew(false);
              loadAll();
            }}
          />
        </Modal>
      )}

      {openDeal && (
        <Modal onClose={() => setOpenDealId(null)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div>
              <h2 className="text-h2 font-semibold text-neutral-950">{openDeal.name}</h2>
              <p className="text-small text-neutral-600">{accountName(openDeal.accountId)}</p>
            </div>
            <ActivityTimeline orgId={selectedOrgId} relatedType="deal" relatedId={openDeal.id} canEdit={can("activity", "create")} />
            <div className="flex justify-end border-t border-neutral-200 pt-4">
              <Button variant="secondary" onClick={() => setOpenDealId(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NewDealForm({
  orgId,
  accounts,
  contacts,
  onClose,
  onCreated,
}: {
  orgId: string;
  accounts: Account[];
  contacts: Contact[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [contactId, setContactId] = useState("");
  const [value, setValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleContacts = contacts.filter((c) => c.accountId === accountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !accountId) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        account_id: accountId,
        contact_id: contactId || null,
        name,
        value: value ? Number(value) : null,
        expected_close_date: expectedCloseDate || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to create deal");
      return;
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Deal</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Account">
        <Select className="w-full" value={accountId} onChange={(e) => { setAccountId(e.target.value); setContactId(""); }}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Contact">
        <Select className="w-full" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">No contact</option>
          {eligibleContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Value (USD)">
        <Input type="number" min="0" step="0.01" className="w-full" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Field label="Expected close date">
        <Input type="date" className="w-full" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name || !accountId}>
          {saving ? "Creating…" : "Create Deal"}
        </Button>
      </div>
    </form>
  );
}
