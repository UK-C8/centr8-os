"use client";

// FR-3.x (Prompt 3.2) task 1 — per-user capacity for a sprint plus their
// live-computed assigned workload. Rendered above the kanban board
// wherever a single sprint is open (project detail's Sprints tab, the
// org-wide Sprints page) — capacity is a property of the sprint, not of
// any one screen, so one component covers both.
import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type CapacityRow = { userId: string; capacity: number; assigned: number; overAllocated: boolean };

export function CapacityPanel({ sprintId, orgId }: { sprintId: string; orgId: string }) {
  const { can } = useOrg();
  const canEdit = can("capacity", "update");
  const [rows, setRows] = useState<CapacityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/capacity?sprint_id=${sprintId}`)
      .then((r) => r.json())
      .then((b) => setRows(b.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [sprintId]);

  async function handleSet(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !capacity) return;
    setSaving(true);
    await fetch("/api/capacity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, sprint_id: sprintId, user_id: userId, capacity: Number(capacity) }),
    });
    setUserId("");
    setCapacity("");
    setSaving(false);
    load();
  }

  if (loading) return null;

  return (
    <Card padding="sm" className="space-y-3">
      <h3 className="text-h3 font-semibold text-neutral-800">Team capacity</h3>

      {rows.length === 0 ? (
        <p className="text-small text-neutral-600">No capacity set for this sprint yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.userId} className="flex items-center justify-between text-body">
              {/* No user directory endpoint exists — same raw-id pattern
                  as task assignee elsewhere in the app. */}
              <span className="text-neutral-950" title={r.userId}>
                {r.userId.slice(0, 8)}…
              </span>
              <div className="flex items-center gap-2">
                <span className="text-small text-neutral-600">
                  {r.assigned}/{r.capacity} pts
                </span>
                {r.overAllocated && <Badge color="danger">Over-allocated</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleSet} className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
          <Input className="min-w-0 flex-1" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <Input
            type="number"
            min="0"
            className="w-28"
            placeholder="Capacity (pts)"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={saving || !userId || !capacity}>
            Set
          </Button>
        </form>
      )}
    </Card>
  );
}
