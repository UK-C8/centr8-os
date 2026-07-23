"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Field } from "@/components/ui/Input";

type Employee = { id: string; fullName: string };
type Survey = { id: string; title: string; questions: { text: string }[] };
type Response = { id: string; employeeId: string | null; anonymous: boolean; answers: Record<string, string> };

export default function EngagementPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("engagement", "create");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/engagement-surveys?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([empBody, surveyBody]) => {
        setEmployees(empBody.data ?? []);
        setSurveys(surveyBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);
  useEffect(() => {
    if (!selectedId && surveys[0]) setSelectedId(surveys[0].id);
  }, [surveys, selectedId]);

  function loadResponses(surveyId: string) {
    if (!surveyId) return;
    fetch(`/api/survey-responses?survey_id=${surveyId}`)
      .then((r) => r.json())
      .then((body) => setResponses(body.data ?? []));
  }

  useEffect(() => loadResponses(selectedId), [selectedId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("engagement", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  const selectedSurvey = surveys.find((s) => s.id === selectedId);
  const employeeName = (id: string | null) => (id ? employees.find((e) => e.id === id)?.fullName ?? "Unknown" : "Anonymous");

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Employee Engagement / Surveys</h1>
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {canManage && <NewSurveyForm orgId={selectedOrgId} onCreated={loadAll} />}

      {surveys.length === 0 ? (
        <p className="text-body text-neutral-600">No surveys yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {surveys.map((s) => (
              <button key={s.id} onClick={() => setSelectedId(s.id)} className="text-left">
                <Card padding="sm" className={selectedId === s.id ? "ring-2 ring-primary-600" : ""}>
                  <h2 className="text-body-medium font-medium text-neutral-950">{s.title}</h2>
                  <p className="text-small text-neutral-600">{s.questions.length} question(s)</p>
                </Card>
              </button>
            ))}
          </div>

          {selectedSurvey && (
            <div className="space-y-4 border-t border-neutral-200 pt-6">
              <h2 className="text-h3 font-semibold text-neutral-950">{selectedSurvey.title} — responses</h2>

              {canManage && (
                <RecordResponseForm
                  survey={selectedSurvey}
                  employees={employees}
                  onCreated={() => loadResponses(selectedId)}
                />
              )}

              {responses.length === 0 ? (
                <p className="text-body text-neutral-600">No responses recorded yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
                  {responses.map((r) => (
                    <li key={r.id} className="px-4 py-3 text-body">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-950">{employeeName(r.employeeId)}</span>
                        {r.anonymous && <Badge>Anonymous</Badge>}
                      </div>
                      <ul className="mt-1 space-y-0.5 text-small text-neutral-600">
                        {selectedSurvey.questions.map((q, i) => (
                          <li key={i}>
                            {q.text}: {r.answers[String(i)] ?? "—"}
                          </li>
                        ))}
                      </ul>
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

function NewSurveyForm({ orgId, onCreated }: { orgId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(i: number, value: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? value : q)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanQuestions = questions.filter((q) => q.trim());
    if (!title || cleanQuestions.length === 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/engagement-surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, title, questions: cleanQuestions.map((text) => ({ text })) }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create survey");
      return;
    }
    setTitle("");
    setQuestions([""]);
    onCreated();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h3 font-semibold text-neutral-950">New survey</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
        <Field label="Title">
          <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="space-y-2">
          {questions.map((q, i) => (
            <Field key={i} label={`Question ${i + 1}`}>
              <Input className="w-full" value={q} onChange={(e) => updateQuestion(i, e.target.value)} />
            </Field>
          ))}
          <Button type="button" variant="secondary" onClick={() => setQuestions((qs) => [...qs, ""])}>
            + Add question
          </Button>
        </div>
        <Button type="submit" disabled={saving || !title}>
          {saving ? "Creating…" : "Create survey"}
        </Button>
      </form>
    </Card>
  );
}

function RecordResponseForm({
  survey,
  employees,
  onCreated,
}: {
  survey: Survey;
  employees: Employee[];
  onCreated: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/survey-responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        survey_id: survey.id,
        employee_id: anonymous ? null : employeeId || null,
        anonymous,
        answers,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to record response");
      return;
    }
    setAnswers({});
    onCreated();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-body-medium font-medium text-neutral-950">Record a response</h3>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

        <label className="flex items-center gap-2.5 text-body text-neutral-950">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 rounded-sm border-neutral-300 text-primary-600 focus:outline focus:outline-2 focus:outline-primary-600"
          />
          Anonymous response
        </label>

        {!anonymous && (
          <Field label="Employee">
            <select
              className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-body focus:outline focus:outline-2 focus:outline-primary-600"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </Field>
        )}

        {survey.questions.map((q, i) => (
          <Field key={i} label={q.text}>
            <Input
              className="w-full"
              value={answers[String(i)] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [String(i)]: e.target.value }))}
            />
          </Field>
        ))}

        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Saving…" : "Record response"}
        </Button>
      </form>
    </Card>
  );
}
