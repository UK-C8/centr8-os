"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { HR_CASE_STATUSES } from "@/lib/constants";

type Employee = { id: string; fullName: string };
type HrCase = {
  id: string;
  employeeId: string;
  category: string;
  description: string | null;
  status: string;
  assignedTo: string | null;
};

const STATUS_COLOR: Record<string, "warning" | "info" | "success" | "neutral"> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "neutral",
};

export default function HrCasesPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("hr_case", "create");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cases, setCases] = useState<HrCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/hr-cases?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([empBody, caseBody]) => {
        setEmployees(empBody.data ?? []);
        setCases(caseBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  async function updateCase(id: string, patch: { status?: string; assigned_to?: string | null }) {
    await fetch(`/api/hr-cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("hr_case", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "—";

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">HR Cases & Helpdesk</h1>
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {canManage && <NewCaseForm orgId={selectedOrgId} employees={employees} onCreated={loadAll} />}

      {cases.length === 0 ? (
        <p className="text-body text-neutral-600">No HR cases yet.</p>
      ) : (
        <Accordion type="multiple" className="rounded-md border border-neutral-300 bg-neutral-50 px-4">
          {cases.map((c) => (
            <AccordionItem key={c.id} value={c.id}>
              <AccordionTrigger>
                <span className="flex flex-1 items-center justify-between gap-2 pr-2">
                  <span>
                    {employeeName(c.employeeId)} · {c.category}
                  </span>
                  <Badge color={STATUS_COLOR[c.status]}>{c.status.replace("_", " ")}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {c.description && <p className="text-small text-neutral-600">{c.description}</p>}
                  {c.assignedTo && (
                    <p className="text-caption text-neutral-500">Assigned to {employeeName(c.assignedTo)}</p>
                  )}
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={c.assignedTo ?? ""}
                        onChange={(e) => updateCase(c.id, { assigned_to: e.target.value || null })}
                      >
                        <option value="">Unassigned</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.fullName}
                          </option>
                        ))}
                      </Select>
                      <Select value={c.status} onChange={(e) => updateCase(c.id, { status: e.target.value })}>
                        {HR_CASE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

function NewCaseForm({ orgId, employees, onCreated }: { orgId: string; employees: Employee[]; onCreated: () => void }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId && employees[0]) setEmployeeId(employees[0].id);
  }, [employees, employeeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !category) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/hr-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, employee_id: employeeId, category, description: description || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create case");
      return;
    }
    setCategory("");
    setDescription("");
    onCreated();
  }

  if (employees.length === 0) return <p className="text-body text-neutral-600">No employees yet.</p>;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h3 font-semibold text-neutral-950">New case</h2>
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
          <Field label="Category">
            <Input className="w-full" placeholder="e.g. Payroll, Conflict, IT" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea className="w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={saving || !employeeId || !category}>
          {saving ? "Creating…" : "+ Open case"}
        </Button>
      </form>
    </Card>
  );
}
