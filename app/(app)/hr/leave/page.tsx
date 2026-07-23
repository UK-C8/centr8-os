"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Field } from "@/components/ui/Input";

type Employee = { id: string; fullName: string };
type Policy = { id: string; name: string; daysPerYear: number; balance?: { used: number; remaining: number } };
type LeaveRequest = {
  id: string;
  employeeId: string;
  policyId: string;
  startDate: string;
  endDate: string;
  status: string;
};

const STATUS_COLOR: Record<string, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

// Confirmed scope decision: HR Management has no employee self-service
// login path — an HR admin files leave requests on each employee's
// behalf, same as Attendance and Payroll & Compensation.
export default function LeavePage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canRequest = can("leave", "request");
  const canApprove = can("leave", "approve");
  const canConfigure = can("leave", "configure");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<LeaveRequest[]>([]);
  const [teamRequests, setTeamRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/leave-requests?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/leave-policies?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([empBody, teamBody, policiesBody]) => {
        setEmployees(empBody.data ?? []);
        setTeamRequests(teamBody.data ?? []);
        setAllPolicies(policiesBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leave data"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);
  useEffect(() => {
    if (!selectedId && employees[0]) setSelectedId(employees[0].id);
  }, [employees, selectedId]);

  function loadForSelected(employeeId: string) {
    if (!selectedOrgId || !employeeId) return;
    Promise.all([
      fetch(`/api/leave-policies?org_id=${selectedOrgId}&employee_id=${employeeId}`).then((r) => r.json()),
      fetch(`/api/leave-requests?org_id=${selectedOrgId}&employee_id=${employeeId}`).then((r) => r.json()),
    ]).then(([policiesBody, requestsBody]) => {
      setPolicies(policiesBody.data ?? []);
      setSelectedRequests(requestsBody.data ?? []);
    });
  }

  useEffect(() => loadForSelected(selectedId), [selectedId, selectedOrgId]);

  async function decide(id: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      loadAll();
      loadForSelected(selectedId);
    }
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  const pendingTeamRequests = teamRequests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-8">
      <h1 className="text-display font-semibold text-neutral-950">Leave Management</h1>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {canConfigure && (
        <PolicyManager
          orgId={selectedOrgId}
          policies={allPolicies}
          onCreated={() => {
            loadAll();
            loadForSelected(selectedId);
          }}
        />
      )}

      {canRequest && employees.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <Field label="Employee">
              <Select className="w-full" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <h2 className="text-h3 font-semibold text-neutral-950">Balance</h2>
            {policies.length === 0 ? (
              <p className="text-body text-neutral-600">No leave policies set up for this org yet.</p>
            ) : (
              <ul className="space-y-2">
                {policies.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-body">
                    <span className="text-neutral-950">{p.name}</span>
                    <span className="text-neutral-600">
                      {p.balance ? `${p.balance.remaining} / ${p.daysPerYear} days left` : `${p.daysPerYear} days/year`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-neutral-200 pt-3">
              <h3 className="mb-2 text-body-medium font-medium text-neutral-950">Requests</h3>
              <RequestList requests={selectedRequests} policies={policies} />
            </div>
          </Card>

          {selectedId && (
            <NewLeaveRequestForm
              employeeId={selectedId}
              policies={policies}
              onCreated={() => {
                loadForSelected(selectedId);
                loadAll();
              }}
            />
          )}
        </div>
      )}

      {canApprove && pendingTeamRequests.length > 0 && (
        <div>
          <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Pending approval</h2>
          <RequestList requests={pendingTeamRequests} policies={allPolicies} onDecide={decide} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Team leave</h2>
        <RequestList requests={teamRequests.filter((r) => r.status === "approved")} policies={allPolicies} />
      </div>
    </div>
  );
}

function RequestList({
  requests,
  policies,
  onDecide,
}: {
  requests: LeaveRequest[];
  policies: Policy[];
  onDecide?: (id: string, status: "approved" | "rejected") => void;
}) {
  if (requests.length === 0) return <p className="text-body text-neutral-600">Nothing here.</p>;
  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-body">
          <span className="text-neutral-950">
            {policies.find((p) => p.id === r.policyId)?.name ?? "Leave"} · {r.startDate} → {r.endDate}
          </span>
          <div className="flex items-center gap-2">
            <Badge color={STATUS_COLOR[r.status] ?? "neutral"}>{r.status}</Badge>
            {onDecide && (
              <>
                <Button variant="secondary" onClick={() => onDecide(r.id, "approved")}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => onDecide(r.id, "rejected")}>
                  Reject
                </Button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PolicyManager({ orgId, policies, onCreated }: { orgId: string; policies: Policy[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [daysPerYear, setDaysPerYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !daysPerYear) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/leave-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name, days_per_year: Number(daysPerYear) }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create policy");
      return;
    }
    setName("");
    setDaysPerYear("");
    onCreated();
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-h3 font-semibold text-neutral-950">Leave policies</h2>
      {policies.length > 0 && (
        <ul className="space-y-1 text-body text-neutral-600">
          {policies.map((p) => (
            <li key={p.id}>
              {p.name} — {p.daysPerYear} days/year
            </li>
          ))}
        </ul>
      )}
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <Field label="Policy name">
          <Input placeholder="e.g. PTO" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Days/year">
          <Input type="number" min={0} className="w-24" value={daysPerYear} onChange={(e) => setDaysPerYear(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={saving || !name || !daysPerYear}>
          {saving ? "Adding…" : "+ Add policy"}
        </Button>
      </form>
    </Card>
  );
}

function NewLeaveRequestForm({
  employeeId,
  policies,
  onCreated,
}: {
  employeeId: string;
  policies: Policy[];
  onCreated: () => void;
}) {
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!policyId && policies[0]) setPolicyId(policies[0].id);
  }, [policies, policyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!policyId || !startDate || !endDate) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, policy_id: policyId, start_date: startDate, end_date: endDate }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to submit request");
      return;
    }
    setStartDate("");
    setEndDate("");
    onCreated();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h3 font-semibold text-neutral-950">Request time off</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
        {policies.length === 0 ? (
          <p className="text-body text-neutral-600">No leave policies available.</p>
        ) : (
          <>
            <Field label="Policy">
              <Select className="w-full" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Start date">
                <Input type="date" className="w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="End date">
                <Input type="date" className="w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" disabled={saving || !startDate || !endDate}>
              {saving ? "Submitting…" : "Submit request"}
            </Button>
          </>
        )}
      </form>
    </Card>
  );
}
