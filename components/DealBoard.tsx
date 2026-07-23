"use client";

import { useState } from "react";
import { cardAccentClass } from "@/components/ui/Badge";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/lib/constants";

export type Deal = {
  id: string;
  name: string;
  accountName: string;
  value: number | null;
  currency: string;
  stage: (typeof DEAL_STAGES)[number];
  expectedCloseDate: string | null;
};

const STAGE_ACCENT: Record<(typeof DEAL_STAGES)[number], Parameters<typeof cardAccentClass>[0]> = {
  prospecting: "neutral",
  proposal: "info",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

function formatValue(value: number | null, currency: string) {
  if (value == null) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

// Same native HTML5 drag-and-drop pattern as components/SprintBoard.tsx
// (columns by a status-like enum, dataTransfer carries the dragged id) —
// deals aren't tasks (different shape: value/currency/account, not
// priority/estimate/assignee), so this is a parallel component rather
// than a generic one, but the DnD mechanics are copied on purpose.
export function DealBoard({
  deals,
  canEdit,
  onDealClick,
  onStageChange,
}: {
  deals: Deal[];
  canEdit: boolean;
  onDealClick: (dealId: string) => void;
  onStageChange: (dealId: string, stage: string) => void;
}) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {DEAL_STAGES.map((stage) => {
        const columnDeals = deals.filter((d) => d.stage === stage);
        const columnTotal = columnDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setDragOverStage(stage);
            }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              const dealId = e.dataTransfer.getData("text/plain");
              setDragOverStage(null);
              if (dealId) onStageChange(dealId, stage);
            }}
            className={`w-64 shrink-0 rounded-md border p-3 transition-colors ${
              dragOverStage === stage ? "border-primary-600 bg-primary-100" : "border-neutral-300 bg-neutral-100"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-caption font-medium uppercase tracking-wide text-neutral-600">
                {DEAL_STAGE_LABELS[stage]}
              </h3>
              <span className="text-small text-neutral-400">{columnDeals.length}</span>
            </div>
            {columnTotal > 0 && (
              <p className="mb-2 text-caption text-neutral-500">{formatValue(columnTotal, columnDeals[0]?.currency ?? "USD")}</p>
            )}
            <div className="space-y-2">
              {columnDeals.map((deal) => (
                <div
                  key={deal.id}
                  role="button"
                  tabIndex={0}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", deal.id)}
                  onClick={() => onDealClick(deal.id)}
                  onKeyDown={(e) => e.key === "Enter" && onDealClick(deal.id)}
                  className={`space-y-1.5 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-left shadow-sm transition-shadow hover:shadow-md ${cardAccentClass(STAGE_ACCENT[deal.stage])} ${
                    canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                  }`}
                >
                  <p className="text-body-medium font-medium text-neutral-950">{deal.name}</p>
                  <p className="text-small text-neutral-600">{deal.accountName}</p>
                  <div className="flex items-center justify-between">
                    {formatValue(deal.value, deal.currency) && (
                      <span className="text-small font-medium text-neutral-800">{formatValue(deal.value, deal.currency)}</span>
                    )}
                    {deal.expectedCloseDate && (
                      <span className="text-caption text-neutral-500">
                        {new Date(deal.expectedCloseDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
