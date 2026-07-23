"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/lib/constants";

type Deal = { id: string; value: number | null; currency: string; stage: (typeof DEAL_STAGES)[number]; expectedCloseDate: string | null };
type Forecast = { id: string; period: string; targetValue: number | null };

const OPEN_STAGES = DEAL_STAGES.filter((s) => s !== "won" && s !== "lost");

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

// Deliberately client-side: the rollup (pipeline value by stage/period) is
// never stored — computed live from GET /api/deals, grouped by
// expectedCloseDate's YYYY-MM and stage. Only the per-period target is
// persisted (forecasts table). See db/schema.ts's comment on `forecasts`.
export default function ForecastsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPeriod, setSavingPeriod] = useState<string | null>(null);

  const canEdit = can("forecast", "update") || can("forecast", "create");

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/deals?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/forecasts?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([dealsBody, forecastsBody]) => {
        if (!dealsBody.data) throw new Error(dealsBody.error ?? "Failed to load deals");
        setDeals(dealsBody.data);
        setForecasts(forecastsBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load forecasts"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  const { periods, byPeriodStage, totalsByPeriod } = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    for (const d of deals) {
      if (!d.expectedCloseDate || !OPEN_STAGES.includes(d.stage as (typeof OPEN_STAGES)[number])) continue;
      const period = d.expectedCloseDate.slice(0, 7);
      grouped[period] ??= {};
      grouped[period][d.stage] = (grouped[period][d.stage] ?? 0) + (d.value ?? 0);
    }
    const totals: Record<string, number> = {};
    for (const [period, byStage] of Object.entries(grouped)) {
      totals[period] = Object.values(byStage).reduce((a, b) => a + b, 0);
    }
    const allPeriods = new Set([...Object.keys(grouped), ...forecasts.map((f) => f.period)]);
    return { periods: [...allPeriods].sort(), byPeriodStage: grouped, totalsByPeriod: totals };
  }, [deals, forecasts]);

  async function saveTarget(period: string, targetValue: number | null) {
    setSavingPeriod(period);
    const existing = forecasts.find((f) => f.period === period);
    const res = await fetch(existing ? `/api/forecasts/${existing.id}` : "/api/forecasts", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(existing ? { target_value: targetValue } : { org_id: selectedOrgId, period, target_value: targetValue }),
    });
    setSavingPeriod(null);
    if (res.ok) loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading forecasts…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Sales Forecasts</h1>
        <p className="text-body text-neutral-600">
          Open pipeline value by stage and expected close month — a computed rollup, not a prediction.
        </p>
      </div>

      {periods.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 5v5l3 3" />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No forecastable deals yet</EmptyTitle>
            <EmptyDescription>Deals need an expected close date to show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                {OPEN_STAGES.map((s) => (
                  <TableHead key={s}>{DEAL_STAGE_LABELS[s]}</TableHead>
                ))}
                <TableHead>Total pipeline</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period) => (
                <TableRow key={period}>
                  <TableCell className="font-medium text-neutral-950">{period}</TableCell>
                  {OPEN_STAGES.map((s) => (
                    <TableCell key={s} className="text-neutral-600">
                      {byPeriodStage[period]?.[s] ? formatCurrency(byPeriodStage[period][s]) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="font-medium text-neutral-950">{formatCurrency(totalsByPeriod[period] ?? 0)}</TableCell>
                  <TableCell>
                    <TargetCell
                      value={forecasts.find((f) => f.period === period)?.targetValue ?? null}
                      canEdit={canEdit}
                      saving={savingPeriod === period}
                      onSave={(v) => saveTarget(period, v)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function TargetCell({
  value,
  canEdit,
  saving,
  onSave,
}: {
  value: number | null;
  canEdit: boolean;
  saving: boolean;
  onSave: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  if (!canEdit) return <span className="text-neutral-600">{value != null ? formatCurrency(value) : "—"}</span>;

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min="0"
        step="0.01"
        className="w-28"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Set target"
        disabled={saving}
      />
      <Button
        variant="secondary"
        onClick={() => onSave(draft ? Number(draft) : null)}
        disabled={saving || draft === (value != null ? String(value) : "")}
      >
        {saving ? "…" : "Save"}
      </Button>
    </div>
  );
}
