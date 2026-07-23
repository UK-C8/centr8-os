"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { PERFORMANCE_REVIEW_STATUSES } from "@/lib/constants";

type Employee = { id: string; fullName: string };
type Review = {
  id: string;
  employeeId: string;
  reviewerId: string | null;
  period: string;
  comments: string | null;
  status: string;
};
type Okr = { id: string; employeeId: string | null; teamId: string | null; objective: string; period: string };

const STATUS_COLOR: Record<string, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  submitted: "warning",
  completed: "success",
};

const TABS = ["Reviews", "OKRs"] as const;
type Tab = (typeof TABS)[number];

export default function PerformancePage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("performance", "create");
  const [tab, setTab] = useState<Tab>("Reviews");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/performance-reviews?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/okrs?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([empBody, reviewBody, okrBody]) => {
        setEmployees(empBody.data ?? []);
        setReviews(reviewBody.data ?? []);
        setOkrs(okrBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  async function updateReviewStatus(id: string, status: string) {
    await fetch(`/api/performance-reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("performance", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "—";

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Performance Reviews & OKRs</h1>
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <div className="flex gap-1 border-b border-neutral-300">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-b-2 border-primary-600 text-primary-700" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Reviews" && (
        <div className="space-y-6">
          {canManage && <NewReviewForm orgId={selectedOrgId} employees={employees} onCreated={loadAll} />}
          {reviews.length === 0 ? (
            <p className="text-body text-neutral-600">No performance reviews yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-body">
                  <div>
                    <p className="text-neutral-950">
                      {employeeName(r.employeeId)} · {r.period}
                    </p>
                    {r.comments && <p className="text-small text-neutral-600">{r.comments}</p>}
                    <p className="text-caption text-neutral-500">Reviewer: {employeeName(r.reviewerId)}</p>
                  </div>
                  {canManage ? (
                    <Select value={r.status} onChange={(e) => updateReviewStatus(r.id, e.target.value)}>
                      {PERFORMANCE_REVIEW_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "OKRs" && (
        <div className="space-y-6">
          {canManage && <NewOkrForm orgId={selectedOrgId} employees={employees} onCreated={loadAll} />}
          {okrs.length === 0 ? (
            <p className="text-body text-neutral-600">No OKRs yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {okrs.map((o) => (
                <Card key={o.id} padding="sm" className="space-y-2">
                  <p className="text-small text-neutral-600">
                    {o.employeeId ? employeeName(o.employeeId) : "Team"} · {o.period}
                  </p>
                  <p className="text-body-medium font-medium text-neutral-950">{o.objective}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewReviewForm({ orgId, employees, onCreated }: { orgId: string; employees: Employee[]; onCreated: () => void }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [reviewerId, setReviewerId] = useState("");
  const [period, setPeriod] = useState("");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId && employees[0]) setEmployeeId(employees[0].id);
  }, [employees, employeeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !period) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/performance-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        employee_id: employeeId,
        reviewer_id: reviewerId || null,
        period,
        comments: comments || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create review");
      return;
    }
    setPeriod("");
    setComments("");
    onCreated();
  }

  if (employees.length === 0) return <p className="text-body text-neutral-600">No employees yet.</p>;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h3 font-semibold text-neutral-950">New review</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Employee">
            <Select className="w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reviewer">
            <Select className="w-full" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Period">
            <Input className="w-full" placeholder="e.g. 2026-Q1" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
        </div>
        <Field label="Comments">
          <Textarea className="w-full" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={saving || !employeeId || !period}>
          {saving ? "Creating…" : "+ Add review"}
        </Button>
      </form>
    </Card>
  );
}

function NewOkrForm({ orgId, employees, onCreated }: { orgId: string; employees: Employee[]; onCreated: () => void }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [objective, setObjective] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId && employees[0]) setEmployeeId(employees[0].id);
  }, [employees, employeeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !objective || !period) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/okrs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, employee_id: employeeId, objective, period, key_results: [] }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create OKR");
      return;
    }
    setObjective("");
    setPeriod("");
    onCreated();
  }

  if (employees.length === 0) return <p className="text-body text-neutral-600">No employees yet.</p>;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h3 font-semibold text-neutral-950">New OKR</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Employee">
            <Select className="w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Period">
            <Input className="w-full" placeholder="e.g. 2026-Q1" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
        </div>
        <Field label="Objective">
          <Input className="w-full" value={objective} onChange={(e) => setObjective(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={saving || !employeeId || !objective || !period}>
          {saving ? "Creating…" : "+ Add OKR"}
        </Button>
      </form>
    </Card>
  );
}
