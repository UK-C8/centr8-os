"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { JOB_POSTING_STATUSES, CANDIDATE_STAGES } from "@/lib/constants";

type JobPosting = { id: string; title: string; status: string; description: string | null };
type Candidate = { id: string; jobPostingId: string; name: string; email: string | null; stage: string };

const POSTING_COLOR: Record<string, "neutral" | "success" | "danger"> = { draft: "neutral", open: "success", closed: "danger" };
const STAGE_COLOR: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  applied: "neutral",
  interview: "info",
  offer: "warning",
  hired: "success",
  rejected: "danger",
};

export default function RecruitmentPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("recruitment", "create");
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadPostings() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/job-postings?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setPostings(body.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(loadPostings, [selectedOrgId]);
  useEffect(() => {
    if (!selectedId && postings[0]) setSelectedId(postings[0].id);
  }, [postings, selectedId]);

  function loadCandidates(jobPostingId: string) {
    if (!jobPostingId) return;
    fetch(`/api/candidates?job_posting_id=${jobPostingId}`)
      .then((r) => r.json())
      .then((body) => setCandidates(body.data ?? []));
  }

  useEffect(() => loadCandidates(selectedId), [selectedId]);

  async function updatePostingStatus(id: string, status: string) {
    await fetch(`/api/job-postings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadPostings();
  }

  async function updateCandidateStage(id: string, stage: string) {
    await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    loadCandidates(selectedId);
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("recruitment", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  const selectedPosting = postings.find((p) => p.id === selectedId);

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Recruitment / Hiring</h1>
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {canManage && <NewPostingForm orgId={selectedOrgId} onCreated={loadPostings} />}

      {postings.length === 0 ? (
        <p className="text-body text-neutral-600">No job postings yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {postings.map((p) => (
              <button key={p.id} onClick={() => setSelectedId(p.id)} className="text-left">
                <Card
                  padding="sm"
                  className={`space-y-2 ${selectedId === p.id ? "ring-2 ring-primary-600" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-body-medium font-medium text-neutral-950">{p.title}</h2>
                    <Badge color={POSTING_COLOR[p.status]}>{p.status}</Badge>
                  </div>
                </Card>
              </button>
            ))}
          </div>

          {selectedPosting && (
            <div className="space-y-4 border-t border-neutral-200 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-h3 font-semibold text-neutral-950">{selectedPosting.title} — candidates</h2>
                {canManage && (
                  <Select value={selectedPosting.status} onChange={(e) => updatePostingStatus(selectedPosting.id, e.target.value)}>
                    {JOB_POSTING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {selectedPosting.description && <p className="text-body text-neutral-600">{selectedPosting.description}</p>}

              {canManage && <NewCandidateForm jobPostingId={selectedPosting.id} onCreated={() => loadCandidates(selectedId)} />}

              {candidates.length === 0 ? (
                <p className="text-body text-neutral-600">No candidates yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
                  {candidates.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-body">
                      <div>
                        <p className="text-neutral-950">{c.name}</p>
                        {c.email && <p className="text-small text-neutral-600">{c.email}</p>}
                      </div>
                      {canManage ? (
                        <Select value={c.stage} onChange={(e) => updateCandidateStage(c.id, e.target.value)}>
                          {CANDIDATE_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge color={STAGE_COLOR[c.stage]}>{c.stage}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewPostingForm({ orgId, onCreated }: { orgId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, title, description: description || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create job posting");
      return;
    }
    setTitle("");
    setDescription("");
    onCreated();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h3 font-semibold text-neutral-950">New job posting</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
        <Field label="Title">
          <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea className="w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={saving || !title}>
          {saving ? "Creating…" : "+ Add job posting"}
        </Button>
      </form>
    </Card>
  );
}

function NewCandidateForm({ jobPostingId, onCreated }: { jobPostingId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_posting_id: jobPostingId, name, email: email || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to add candidate");
      return;
    }
    setName("");
    setEmail("");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      {error && <p className="w-full rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
      <Field label="Candidate name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={saving || !name}>
        {saving ? "Adding…" : "+ Add candidate"}
      </Button>
    </form>
  );
}
