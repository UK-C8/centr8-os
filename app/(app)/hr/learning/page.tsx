"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Field } from "@/components/ui/Input";
import { ORG_ROLES } from "@/lib/constants";

type Employee = { id: string; fullName: string };
type Course = { id: string; title: string; requiredForRole: string | null };
type Completion = { id: string; employeeId: string; courseId: string; completedAt: string };

export default function LearningPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("training", "create");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/training-courses?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([empBody, courseBody]) => {
        setEmployees(empBody.data ?? []);
        setCourses(courseBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);
  useEffect(() => {
    if (!selectedCourseId && courses[0]) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  function loadCompletions(courseId: string) {
    if (!courseId) return;
    fetch(`/api/training-completions?course_id=${courseId}`)
      .then((r) => r.json())
      .then((body) => setCompletions(body.data ?? []));
  }

  useEffect(() => loadCompletions(selectedCourseId), [selectedCourseId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("training", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? "Unknown";
  const completedIds = new Set(completions.map((c) => c.employeeId));

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Learning & Training (LMS)</h1>
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {canManage && <NewCourseForm orgId={selectedOrgId} onCreated={loadAll} />}

      {courses.length === 0 ? (
        <p className="text-body text-neutral-600">No training courses yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <button key={c.id} onClick={() => setSelectedCourseId(c.id)} className="text-left">
                <Card padding="sm" className={`space-y-1 ${selectedCourseId === c.id ? "ring-2 ring-primary-600" : ""}`}>
                  <h2 className="text-body-medium font-medium text-neutral-950">{c.title}</h2>
                  {c.requiredForRole && <Badge>Required for {c.requiredForRole}</Badge>}
                </Card>
              </button>
            ))}
          </div>

          {selectedCourse && (
            <div className="space-y-4 border-t border-neutral-200 pt-6">
              <h2 className="text-h3 font-semibold text-neutral-950">{selectedCourse.title} — completions</h2>

              {canManage && (
                <MarkCompleteForm
                  courseId={selectedCourse.id}
                  employees={employees.filter((e) => !completedIds.has(e.id))}
                  onCreated={() => loadCompletions(selectedCourseId)}
                />
              )}

              {completions.length === 0 ? (
                <p className="text-body text-neutral-600">No one has completed this course yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
                  {completions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
                      <span className="text-neutral-950">{employeeName(c.employeeId)}</span>
                      <span className="text-small text-neutral-600">{new Date(c.completedAt).toLocaleDateString()}</span>
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

function NewCourseForm({ orgId, onCreated }: { orgId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [requiredForRole, setRequiredForRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/training-courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, title, required_for_role: requiredForRole || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create course");
      return;
    }
    setTitle("");
    setRequiredForRole("");
    onCreated();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h3 font-semibold text-neutral-950">New course</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title">
            <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Required for role (optional)">
            <Select className="w-full" value={requiredForRole} onChange={(e) => setRequiredForRole(e.target.value)}>
              <option value="">Not required</option>
              {ORG_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={saving || !title}>
          {saving ? "Creating…" : "+ Add course"}
        </Button>
      </form>
    </Card>
  );
}

function MarkCompleteForm({
  courseId,
  employees,
  onCreated,
}: {
  courseId: string;
  employees: Employee[];
  onCreated: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmployeeId(employees[0]?.id ?? "");
  }, [employees]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    setSaving(true);
    await fetch("/api/training-completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId, employee_id: employeeId }),
    });
    setSaving(false);
    onCreated();
  }

  if (employees.length === 0) return <p className="text-small text-neutral-600">Everyone has completed this course.</p>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <Field label="Mark complete for">
        <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={saving || !employeeId}>
        {saving ? "Saving…" : "Mark complete"}
      </Button>
    </form>
  );
}
