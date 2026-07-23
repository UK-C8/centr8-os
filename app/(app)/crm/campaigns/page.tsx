"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { CAMPAIGN_STATUSES } from "@/lib/constants";

type Campaign = {
  id: string;
  name: string;
  type: string | null;
  status: (typeof CAMPAIGN_STATUSES)[number];
  startDate: string | null;
  endDate: string | null;
};
type Lead = { id: string; name: string; company: string | null; status: string; campaignId: string | null };

const STATUS_COLOR: Record<(typeof CAMPAIGN_STATUSES)[number], "neutral" | "info" | "success" | "warning"> = {
  planned: "neutral",
  active: "info",
  completed: "success",
  cancelled: "warning",
};

export default function CampaignsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/campaigns?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/leads?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([campaignsBody, leadsBody]) => {
        if (!campaignsBody.data) throw new Error(campaignsBody.error ?? "Failed to load campaigns");
        setCampaigns(campaignsBody.data);
        setLeads(leadsBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading campaigns…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const leadsFor = (campaignId: string) => leads.filter((l) => l.campaignId === campaignId);
  const openCampaign = campaigns.find((c) => c.id === openCampaignId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Campaigns</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{campaigns.length} total</span>
          {can("campaign", "create") && <Button onClick={() => setShowNew(true)}>+ New Campaign</Button>}
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No campaigns yet</EmptyTitle>
            <EmptyDescription>Create a campaign, then attribute leads to it from the New Lead form.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenCampaignId(c.id)}>
                  <TableCell className="font-medium text-neutral-950">{c.name}</TableCell>
                  <TableCell className="text-neutral-600">{c.type ?? "—"}</TableCell>
                  <TableCell>
                    <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-neutral-600">
                    {c.startDate ?? "—"} {c.endDate ? `→ ${c.endDate}` : ""}
                  </TableCell>
                  <TableCell className="text-neutral-600">{leadsFor(c.id).length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <NewCampaignForm
            orgId={selectedOrgId}
            onClose={() => setShowNew(false)}
            onCreated={() => {
              setShowNew(false);
              loadAll();
            }}
          />
        </Modal>
      )}

      {openCampaign && (
        <Modal onClose={() => setOpenCampaignId(null)}>
          <div className="space-y-4">
            <div>
              <h2 className="text-h2 font-semibold text-neutral-950">{openCampaign.name}</h2>
              <p className="text-small text-neutral-600">{openCampaign.type ?? "No type set"}</p>
            </div>
            <div>
              <h3 className="mb-2 text-h3 font-semibold text-neutral-950">Attributed leads</h3>
              {leadsFor(openCampaign.id).length === 0 ? (
                <p className="text-body text-neutral-600">No leads attributed to this campaign yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300">
                  {leadsFor(openCampaign.id).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-body">
                      <span className="text-neutral-950">{l.name}</span>
                      <span className="text-small text-neutral-600">{l.company ?? "—"}</span>
                      <Badge>{l.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end border-t border-neutral-200 pt-4">
              <Button variant="secondary" onClick={() => setOpenCampaignId(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NewCampaignForm({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState<(typeof CAMPAIGN_STATUSES)[number]>("planned");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        name,
        type: type || null,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to create campaign");
      return;
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Campaign</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Type">
        <Input className="w-full" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Email, Webinar, Ad" />
      </Field>
      <Field label="Status">
        <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value as (typeof CAMPAIGN_STATUSES)[number])}>
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date">
          <Input type="date" className="w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <Input type="date" className="w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name}>
          {saving ? "Creating…" : "Create Campaign"}
        </Button>
      </div>
    </form>
  );
}
