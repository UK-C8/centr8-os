"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { EmploymentStatusBadge } from "@/components/ui/Badge";
import { Card, CardLink } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { EMPLOYMENT_STATUSES, ORG_ROLES } from "@/lib/constants";

type Employee = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  employmentStatus: string;
  startDate: string | null;
};

type ViewMode = "grid" | "list";

export default function EmployeeDirectoryPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");

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
          <ViewToggle view={view} onChange={setView} />
          {can("employee", "create") && <Button onClick={() => setShowNewEmployee(true)}>+ New Employee</Button>}
        </div>
      </div>

      {employees.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No employees yet</EmptyTitle>
            <EmptyDescription>Add your first employee to start building the directory.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === "grid" ? (
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
      ) : (
        <EmployeeTable employees={employees} />
      )}

      {showNewEmployee && (
        <Modal onClose={() => setShowNewEmployee(false)} maxWidth="max-w-2xl">
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

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const base = "rounded-sm p-1.5 transition-colors";
  const active = "bg-primary-100 text-primary-700";
  const inactive = "text-neutral-500 hover:bg-neutral-200";
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
      <button
        type="button"
        aria-label="Grid view"
        onClick={() => onChange("grid")}
        className={`${base} ${view === "grid" ? active : inactive}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="List view"
        onClick={() => onChange("list")}
        className={`${base} ${view === "list" ? active : inactive}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
}

function EmployeeTable({ employees }: { employees: Employee[] }) {
  return (
    <Card padding="sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Job title</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Start date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <a href={`/hr/directory/${e.id}`} className="font-medium text-neutral-950 hover:underline">
                  {e.fullName}
                </a>
              </TableCell>
              <TableCell className="text-neutral-600">{e.jobTitle ?? "—"}</TableCell>
              <TableCell className="text-neutral-600">{e.email ?? e.phone ?? "—"}</TableCell>
              <TableCell className="text-neutral-600">{e.startDate ?? "—"}</TableCell>
              <TableCell>
                <EmploymentStatusBadge status={e.employmentStatus} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

const TABS = ["Personal Information", "Professional Information", "Account Access"] as const;
type Tab = (typeof TABS)[number];

function NewEmployeeForm({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [tab, setTab] = useState<Tab>("Personal Information");

  // Personal Information
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Professional Information
  const [jobTitle, setJobTitle] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<(typeof EMPLOYMENT_STATUSES)[number]>("onboarding");
  const [startDate, setStartDate] = useState("");

  // Account Access
  const [sendInvite, setSendInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<(typeof ORG_ROLES)[number]>("member");

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
        email: email || null,
        phone: phone || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        marital_status: maritalStatus || null,
        nationality: nationality || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        job_title: jobTitle || null,
        employment_status: employmentStatus,
        start_date: startDate || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to create employee");
      return;
    }

    if (sendInvite && email) {
      const inviteRes = await fetch("/api/org-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, email, role: inviteRole }),
      });
      if (!inviteRes.ok) {
        const inviteBody = await inviteRes.json();
        setSaving(false);
        setError(`Employee created, but the login invite failed: ${inviteBody.error ?? "unknown error"}`);
        return;
      }
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-h2 font-semibold text-neutral-950">New Employee</h2>
        <p className="mt-1 text-small text-neutral-600">
          No document or photo upload — this app has no file storage set up yet.
        </p>
      </div>

      <div className="flex gap-1 border-b border-neutral-300">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-small font-medium transition-colors ${
              tab === t ? "border-b-2 border-primary-600 text-primary-700" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {tab === "Personal Information" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
            </Field>
            <Field label="Email">
              <Input type="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" className="w-full" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Gender">
              <Input className="w-full" value={gender} onChange={(e) => setGender(e.target.value)} />
            </Field>
            <Field label="Marital status">
              <Input className="w-full" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} />
            </Field>
          </div>
          <Field label="Nationality">
            <Input className="w-full" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </Field>
          <Field label="Address">
            <Input className="w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="City">
              <Input className="w-full" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="State">
              <Input className="w-full" value={state} onChange={(e) => setState(e.target.value)} />
            </Field>
            <Field label="ZIP code">
              <Input className="w-full" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {tab === "Professional Information" && (
        <div className="space-y-4">
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
        </div>
      )}

      {tab === "Account Access" && (
        <div className="space-y-4">
          <label className="flex items-center gap-2.5 text-body text-neutral-950">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              disabled={!email}
              className="h-4 w-4 rounded-sm border-neutral-300 text-primary-600 focus:outline focus:outline-2 focus:outline-primary-600"
            />
            Send a login invite to this employee&apos;s email
          </label>
          {!email && <p className="text-small text-neutral-600">Add an email on Personal Information to enable this.</p>}
          {sendInvite && (
            <Field label="Role">
              <Select
                className="w-full max-w-xs"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as (typeof ORG_ROLES)[number])}
              >
                {ORG_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

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
