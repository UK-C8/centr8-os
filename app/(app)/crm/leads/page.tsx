"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { LeadStatusBadge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { LEAD_STATUSES } from "@/lib/constants";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: (typeof LEAD_STATUSES)[number];
  convertedAccountId: string | null;
  convertedContactId: string | null;
  campaignId: string | null;
};
type Campaign = { id: string; name: string };

export default function LeadsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canUpdate = can("lead", "update");

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/leads?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/campaigns?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([leadsBody, campaignsBody]) => {
        if (!leadsBody.data) throw new Error(leadsBody.error ?? "Failed to load leads");
        setLeads(leadsBody.data);
        setCampaigns(campaignsBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    setActionError(null);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setActionError(body.error ?? "Failed to update lead");
      return;
    }
    loadAll();
  }

  async function convert(id: string) {
    setBusyId(id);
    setActionError(null);
    const res = await fetch(`/api/leads/${id}/convert`, { method: "POST" });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setActionError(body.error ?? "Failed to convert lead");
      return;
    }
    loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading leads…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Leads</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{leads.length} total</span>
          {can("lead", "create") && <Button onClick={() => setShowNew(true)}>+ New Lead</Button>}
        </div>
      </div>

      {actionError && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{actionError}</p>}

      {leads.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4z"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No leads yet</EmptyTitle>
            <EmptyDescription>Add your first lead to start working the pipeline.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact info</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium text-neutral-950">{l.name}</TableCell>
                  <TableCell className="text-neutral-600">{l.company ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{l.email ?? l.phone ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{l.source ?? "—"}</TableCell>
                  <TableCell>
                    {canUpdate && l.status !== "converted" ? (
                      <Select
                        className="w-36"
                        value={l.status}
                        disabled={busyId === l.id}
                        onChange={(e) => updateStatus(l.id, e.target.value)}
                      >
                        {LEAD_STATUSES.filter((s) => s !== "converted").map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <LeadStatusBadge status={l.status} />
                    )}
                  </TableCell>
                  <TableCell>
                    {l.status === "converted" ? (
                      <a href="/crm/accounts" className="text-small text-primary-700 hover:underline">
                        View account →
                      </a>
                    ) : (
                      canUpdate && (
                        <Button variant="secondary" onClick={() => convert(l.id)} disabled={busyId === l.id}>
                          {busyId === l.id ? "Converting…" : "Convert"}
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <NewLeadForm
            orgId={selectedOrgId}
            campaigns={campaigns}
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

function NewLeadForm({
  orgId,
  campaigns,
  onClose,
  onCreated,
}: {
  orgId: string;
  campaigns: Campaign[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        name,
        company: company || null,
        email: email || null,
        phone: phone || null,
        source: source || null,
        campaign_id: campaignId || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to create lead");
      return;
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Lead</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Company">
        <Input className="w-full" value={company} onChange={(e) => setCompany(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Phone">
        <Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Source">
        <Input className="w-full" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Website, Referral" />
      </Field>
      {campaigns.length > 0 && (
        <Field label="Campaign">
          <Select className="w-full" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name}>
          {saving ? "Creating…" : "Create Lead"}
        </Button>
      </div>
    </form>
  );
}
