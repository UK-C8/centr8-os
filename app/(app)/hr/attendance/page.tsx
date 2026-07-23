"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select, Field } from "@/components/ui/Input";

type Employee = { id: string; fullName: string };
type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
};

// Confirmed scope decision: HR Management has no employee self-service
// login path — an HR admin records attendance on each employee's behalf,
// same as Leave Management and Payroll & Compensation.
export default function AttendancePage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canRecord = can("attendance", "record");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadEmployees() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/employees?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setEmployees(body.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load employees"))
      .finally(() => setLoading(false));
  }

  useEffect(loadEmployees, [selectedOrgId]);
  useEffect(() => {
    if (!selectedId && employees[0]) setSelectedId(employees[0].id);
  }, [employees, selectedId]);

  function loadRecords(employeeId: string) {
    if (!employeeId) return;
    fetch(`/api/attendance?employee_id=${employeeId}`)
      .then((r) => r.json())
      .then((body) => setRecords(body.data ?? []))
      .catch(() => setRecords([]));
  }

  useEffect(() => loadRecords(selectedId), [selectedId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = records.find((r) => r.date === today);

  async function checkIn() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: selectedId }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to check in");
      return;
    }
    loadRecords(selectedId);
  }

  async function checkOut() {
    if (!todayRecord) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/attendance/${todayRecord.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to check out");
      return;
    }
    loadRecords(selectedId);
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!canRecord) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Attendance & Time Tracking</h1>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {employees.length === 0 ? (
        <p className="text-body text-neutral-600">No employees yet.</p>
      ) : (
        <>
          <Field label="Employee">
            <Select className="w-full max-w-sm" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </Field>

          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-h3 font-semibold text-neutral-950">Today, {today}</p>
              {todayRecord ? (
                <p className="mt-1 text-body text-neutral-600">
                  Checked in {new Date(todayRecord.checkIn!).toLocaleTimeString()}
                  {todayRecord.checkOut && ` · Checked out ${new Date(todayRecord.checkOut).toLocaleTimeString()}`}
                </p>
              ) : (
                <p className="mt-1 text-body text-neutral-600">Not checked in yet.</p>
              )}
            </div>
            {!todayRecord ? (
              <Button onClick={checkIn} disabled={saving}>
                {saving ? "Checking in…" : "Check in"}
              </Button>
            ) : !todayRecord.checkOut ? (
              <Button variant="secondary" onClick={checkOut} disabled={saving}>
                {saving ? "Checking out…" : "Check out"}
              </Button>
            ) : (
              <Badge color="success">Done for today</Badge>
            )}
          </Card>

          <div>
            <h2 className="mb-3 text-h3 font-semibold text-neutral-950">History</h2>
            {records.length === 0 ? (
              <p className="text-body text-neutral-600">No attendance recorded yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
                {[...records]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
                      <span className="text-neutral-950">{r.date}</span>
                      <span className="text-small text-neutral-600">
                        {r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "—"} –{" "}
                        {r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "—"}
                      </span>
                      <Badge>{r.status}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
