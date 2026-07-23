"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { EmploymentStatusBadge } from "@/components/ui/Badge";
import { CardLink } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { EMPLOYMENT_STATUSES } from "@/lib/constants";

type Employee = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  employmentStatus: string;
  startDate: string | null;
};

export default function EmployeeDirectoryPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewEmployee, setShowNewEmployee] = useState(false);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/employees?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load employees");
        setEmployees(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load employees"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  if (orgLoading || loading) {
    return <p className="text-body text-neutral-600">Loading employees…</p>;
  }
  if (!selectedOrgId) {
    return <p className="text-body text-neutral-600">No organization selected.</p>;
  }
  if (error) {
    return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Employee Directory</h1>
        <div className="flex items-center gap-3">
          <span className="text-body text-neutral-600">{employees.length} total</span>
          {can("employee", "create") && <Button onClick={() => setShowNewEmployee(true)}>+ New Employee</Button>}
        </div>
      </div>

      {employees.length === 0 ? (
        <p className="text-body text-neutral-600">No employees yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <CardLink key={employee.id} href={`/hr/directory/${employee.id}`} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-h3 font-semibold text-neutral-950">{employee.fullName}</h2>
                <EmploymentStatusBadge status={employee.employmentStatus} />
              </div>
              <p className="text-small text-neutral-600">{employee.jobTitle ?? "No title set"}</p>
            </CardLink>
          ))}
        </div>
      )}

      {showNewEmployee && (
        <Modal onClose={() => setShowNewEmployee(false)}>
          <NewEmployeeForm
            orgId={selectedOrgId}
            onClose={() => setShowNewEmployee(false)}
            onCreated={() => {
              setShowNewEmployee(false);
              loadAll();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function NewEmployeeForm({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<(typeof EMPLOYMENT_STATUSES)[number]>("onboarding");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        full_name: fullName,
        job_title: jobTitle || null,
        employment_status: employmentStatus,
        start_date: startDate || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create employee");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Employee</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Full name">
        <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
      </Field>

      <Field label="Job title">
        <Input className="w-full" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      </Field>

      <Field label="Employment status">
        <Select
          className="w-full"
          value={employmentStatus}
          onChange={(e) => setEmploymentStatus(e.target.value as (typeof EMPLOYMENT_STATUSES)[number])}
        >
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Start date">
        <Input type="date" className="w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !fullName}>
          {saving ? "Creating…" : "Create Employee"}
        </Button>
      </div>
    </form>
  );
}
