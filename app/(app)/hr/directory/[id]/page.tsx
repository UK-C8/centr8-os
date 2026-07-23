"use client";

import { useEffect, useState, use } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import type { PermissionAction, ResourceType } from "@/lib/api/permissions";
import { EmploymentStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Field } from "@/components/ui/Input";
import { EMPLOYMENT_STATUSES } from "@/lib/constants";

type Employee = {
  id: string;
  orgId: string;
  fullName: string;
  jobTitle: string | null;
  employmentStatus: string;
  startDate: string | null;
  endDate: string | null;
};

type Step = { label: string; done: boolean };
type Workflow = { id: string; steps: Step[]; status: string };

const TABS = ["Overview", "Onboarding"] as const;
type Tab = (typeof TABS)[number];

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useOrg();
  const [tab, setTab] = useState<Tab>("Overview");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadEmployee() {
    setLoading(true);
    setError(null);
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load employee");
        setEmployee(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load employee"))
      .finally(() => setLoading(false));
  }

  useEffect(loadEmployee, [id]);

  if (loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  if (!employee) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">{employee.fullName}</h1>
          <p className="mt-1 text-body text-neutral-600">{employee.jobTitle ?? "No title set"}</p>
        </div>
        <EmploymentStatusBadge status={employee.employmentStatus} />
      </div>

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

      {tab === "Overview" && <OverviewTab employee={employee} can={can} onUpdated={loadEmployee} />}
      {tab === "Onboarding" && <OnboardingTab employeeId={employee.id} />}
    </div>
  );
}

function OverviewTab({
  employee,
  can,
  onUpdated,
}: {
  employee: Employee;
  can: (r: ResourceType, a: PermissionAction) => boolean;
  onUpdated: () => void;
}) {
  const canUpdate = can("employee", "update");
  const canTerminate = can("employee", "terminate");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(employee.fullName);
  const [jobTitle, setJobTitle] = useState(employee.jobTitle ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, job_title: jobTitle || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    setEditing(false);
    onUpdated();
  }

  async function handleTerminate() {
    if (!confirm(`Terminate ${employee.fullName}? This can't be easily undone.`)) return;
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employment_status: "terminated", end_date: new Date().toISOString().slice(0, 10) }),
    });
    if (res.ok) onUpdated();
  }

  return (
    <Card className="space-y-4">
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Full name">
            <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Job title">
            <Input className="w-full" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-small text-neutral-600">Employment status</dt>
              <dd className="mt-1"><EmploymentStatusBadge status={employee.employmentStatus} /></dd>
            </div>
            <div>
              <dt className="text-small text-neutral-600">Start date</dt>
              <dd className="mt-1 text-body text-neutral-950">{employee.startDate ?? "—"}</dd>
            </div>
            {employee.endDate && (
              <div>
                <dt className="text-small text-neutral-600">End date</dt>
                <dd className="mt-1 text-body text-neutral-950">{employee.endDate}</dd>
              </div>
            )}
          </dl>

          <div className="flex gap-3 border-t border-neutral-200 pt-4">
            {canUpdate && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {canTerminate && employee.employmentStatus !== "terminated" && (
              <Button variant="danger" onClick={handleTerminate}>
                Terminate
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function OnboardingTab({ employeeId }: { employeeId: string }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStep, setNewStep] = useState("");
  const [saving, setSaving] = useState(false);

  function loadWorkflow() {
    setLoading(true);
    setError(null);
    fetch(`/api/onboarding-workflows?employee_id=${employeeId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setWorkflow(body.data?.[0] ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load onboarding"))
      .finally(() => setLoading(false));
  }

  useEffect(loadWorkflow, [employeeId]);

  async function createWorkflow() {
    setSaving(true);
    const res = await fetch("/api/onboarding-workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, steps: [] }),
    });
    setSaving(false);
    if (res.ok) loadWorkflow();
  }

  async function saveSteps(steps: Step[]) {
    if (!workflow) return;
    const allDone = steps.length > 0 && steps.every((s) => s.done);
    const anyDone = steps.some((s) => s.done);
    const status = allDone ? "complete" : anyDone ? "in_progress" : "not_started";
    setSaving(true);
    const res = await fetch(`/api/onboarding-workflows/${workflow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps, status }),
    });
    const body = await res.json();
    setSaving(false);
    if (res.ok) setWorkflow(body.data);
  }

  function toggleStep(i: number) {
    if (!workflow) return;
    const steps = workflow.steps.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s));
    saveSteps(steps);
  }

  function addStep(e: React.FormEvent) {
    e.preventDefault();
    if (!workflow || !newStep.trim()) return;
    saveSteps([...workflow.steps, { label: newStep.trim(), done: false }]);
    setNewStep("");
  }

  if (loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  if (!workflow) {
    return (
      <Card className="space-y-3">
        <p className="text-body text-neutral-600">No onboarding checklist started yet.</p>
        <Button onClick={createWorkflow} disabled={saving}>
          {saving ? "Starting…" : "Start onboarding checklist"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-neutral-950">Onboarding checklist</h2>
        <Badge color={workflow.status === "complete" ? "success" : workflow.status === "in_progress" ? "info" : "neutral"}>
          {workflow.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {workflow.steps.length === 0 ? (
        <p className="text-body text-neutral-600">No steps yet — add the first one below.</p>
      ) : (
        <ul className="space-y-2">
          {workflow.steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={step.done}
                onChange={() => toggleStep(i)}
                disabled={saving}
                className="h-4 w-4 rounded-sm border-neutral-300 text-primary-600 focus:outline focus:outline-2 focus:outline-primary-600"
              />
              <span className={`text-body ${step.done ? "text-neutral-400 line-through" : "text-neutral-950"}`}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addStep} className="flex gap-2 border-t border-neutral-200 pt-4">
        <Input
          className="min-w-0 flex-1"
          placeholder="e.g. Set up laptop"
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={saving || !newStep.trim()}>
          + Add step
        </Button>
      </form>
    </Card>
  );
}
