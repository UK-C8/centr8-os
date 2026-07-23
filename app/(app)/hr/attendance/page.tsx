"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Employee = { id: string; fullName: string };
type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
};

export default function AttendancePage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/employees?org_id=${selectedOrgId}&mine=true`)
      .then((r) => r.json())
      .then((body) => {
        const emp: Employee | null = body.data?.[0] ?? null;
        setMyEmployee(emp);
        if (!emp) return { data: [] };
        return fetch(`/api/attendance?employee_id=${emp.id}`).then((r) => r.json());
      })
      .then((body) => setRecords(body.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load attendance"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = records.find((r) => r.date === today);

  async function checkIn() {
    if (!myEmployee) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: myEmployee.id }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to check in");
      return;
    }
    loadAll();
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
    loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Attendance & Time Tracking</h1>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {!myEmployee ? (
        <Card>
          <p className="text-body text-neutral-600">
            No employee record is linked to your account, so there&apos;s nothing to check in/out of. Ask an HR admin
            to link your account on the{" "}
            {can("employee", "read") ? <a href="/hr/directory" className="text-primary-600 hover:underline">Employee Directory</a> : "Employee Directory"}.
          </p>
        </Card>
      ) : (
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
      )}

      <div>
        <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Recent history</h2>
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
    </div>
  );
}
