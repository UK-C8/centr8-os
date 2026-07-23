"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field } from "@/components/ui/Input";

type Employee = { id: string; fullName: string };
type CompensationRecord = {
  id: string;
  employeeId: string;
  baseSalary: number;
  currency: string;
  effectiveDate: string;
  bonus: unknown;
  benefits: unknown;
};

// Confirmed scope decision: HR Management has no employee self-service
// login path — compensation is HR-admin-only, viewed and entered on an
// employee's behalf. There's no self-view here, unlike the original 5.3
// spec, because there's no employee-facing login to view it from.
export default function PayrollPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canViewSensitive = can("compensation", "view_sensitive");

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId || !canViewSensitive) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/employees?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setAllEmployees(body.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load payroll data"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId, canViewSensitive]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!canViewSensitive) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Payroll & Compensation</h1>

      <div className="rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-3">
        <p className="text-small font-medium text-warning-600">
          Payroll processing and tax compliance are out of scope — this module tracks compensation records only.
        </p>
      </div>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <HrAdminSection orgId={selectedOrgId} employees={allEmployees} onChanged={loadAll} />
    </div>
  );
}

function RecordList({ records }: { records: CompensationRecord[] }) {
  if (records.length === 0) return <p className="text-body text-neutral-600">No compensation records yet.</p>;
  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
      {[...records]
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
        .map((r) => (
          <li key={r.id} className="px-4 py-3 text-body">
            <div className="flex items-center justify-between">
              <span className="text-neutral-950">
                {r.currency} {r.baseSalary.toLocaleString()}
              </span>
              <span className="text-small text-neutral-600">effective {r.effectiveDate}</span>
            </div>
            {(r.bonus != null || r.benefits != null) && (
              <div className="mt-1 space-x-3 text-small text-neutral-600">
                {r.bonus != null && <span>Bonus: {JSON.stringify(r.bonus)}</span>}
                {r.benefits != null && <span>Benefits: {JSON.stringify(r.benefits)}</span>}
              </div>
            )}
          </li>
        ))}
    </ul>
  );
}

function HrAdminSection({
  orgId,
  employees,
  onChanged,
}: {
  orgId: string;
  employees: Employee[];
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState(employees[0]?.id ?? "");
  const [records, setRecords] = useState<CompensationRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    if (!selectedId && employees[0]) setSelectedId(employees[0].id);
  }, [employees, selectedId]);

  function loadRecords(employeeId: string) {
    if (!employeeId) return;
    setLoadingRecords(true);
    fetch(`/api/compensation-records?employee_id=${employeeId}`)
      .then((r) => r.json())
      .then((body) => setRecords(body.data ?? []))
      .finally(() => setLoadingRecords(false));
  }

  useEffect(() => loadRecords(selectedId), [selectedId]);

  return (
    <div className="space-y-4 border-t border-neutral-200 pt-6">
      <h2 className="text-h3 font-semibold text-neutral-950">HR admin: manage compensation</h2>

      {employees.length === 0 ? (
        <p className="text-body text-neutral-600">No employees yet.</p>
      ) : (
        <>
          <Field label="Employee">
            <Select className="w-full" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </Field>

          {loadingRecords ? (
            <p className="text-body text-neutral-600">Loading…</p>
          ) : (
            <RecordList records={records} />
          )}

          {selectedId && (
            <NewRecordForm
              employeeId={selectedId}
              onCreated={() => {
                loadRecords(selectedId);
                onChanged();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function NewRecordForm({ employeeId, onCreated }: { employeeId: string; onCreated: () => void }) {
  const [baseSalary, setBaseSalary] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!baseSalary || !effectiveDate) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/compensation-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employeeId,
        base_salary: Number(baseSalary),
        currency,
        effective_date: effectiveDate,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save record");
      return;
    }
    setBaseSalary("");
    setEffectiveDate("");
    onCreated();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-body-medium font-medium text-neutral-950">New compensation record</h3>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Base salary">
            <Input
              type="number"
              min={0}
              className="w-full"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Input className="w-full" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Effective date">
            <Input
              type="date"
              className="w-full"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={saving || !baseSalary || !effectiveDate}>
          {saving ? "Saving…" : "+ Add record"}
        </Button>
      </form>
    </Card>
  );
}
