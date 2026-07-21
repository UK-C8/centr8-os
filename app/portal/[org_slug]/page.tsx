"use client";

// FR-4.x (Prompt 3.1) — outside the (app) shell/auth group since
// client-portal users are not org_memberships rows; auth is a bearer
// token in the URL (?token=...) checked against client_portal_access,
// not a Supabase session (see lib/api/portalAccess.ts). Client component
// because it needs useSearchParams for the token and interactive milestone
// approval — no server-only data here that would benefit from an RSC.
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProjectStatusBadge, projectStatusColor } from "@/components/ui/Badge";

// Informal shape for organizations.branding_config (jsonb, default {}) —
// no schema enforces this, it's just what this page reads. Unset fields
// fall back to the ordinary design-system look (§5), so a portal without
// branding configured is still fully usable, just unbranded.
interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
}

interface PortalMilestone {
  id: string;
  name: string;
  dueDate: string | null;
  approvedAt: string | null;
}

interface PortalData {
  organization: { name: string; brandingConfig: BrandingConfig };
  clientName: string;
  project: {
    id: string;
    name: string;
    status: string;
    budgetAllocated?: number | null;
    budgetSpent?: number | null;
  };
  milestones: PortalMilestone[];
  // TODO(agent-provider): this is a plain computed summary, not an
  // AI-generated one — see lib/portal/summary.ts's own TODO. Replace with
  // real Communicator-agent output once the Gemini/Groq decision lands;
  // this shape (currentMilestoneName, pctTasksDone) can stay the same,
  // just becomes AI-authored content wrapped in the usual AiBanner.
  summary: { currentMilestoneName: string | null; pctTasksDone: number };
}

export default function PortalPage({ params }: { params: Promise<{ org_slug: string }> }) {
  const { org_slug } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/portal/${org_slug}?token=${encodeURIComponent(token ?? "")}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load portal");
        setData(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load portal"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [org_slug, token]);

  async function approveMilestone(milestoneId: string) {
    if (!token) return;
    setApprovingId(milestoneId);
    await fetch(`/api/portal/${org_slug}/milestones/${milestoneId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setApprovingId(null);
    load();
  }

  const brandColor = data?.organization.brandingConfig.primaryColor;

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="border-b border-neutral-300 bg-neutral-50 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {data?.organization.brandingConfig.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, org-supplied URL; not a local asset next/image can optimize
            <img src={data.organization.brandingConfig.logoUrl} alt="" className="h-8 w-8 rounded-sm object-contain" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-sm text-caption font-semibold text-neutral-50"
              style={{ backgroundColor: brandColor ?? "var(--primary-600)" }}
            >
              {(data?.organization.name ?? org_slug).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-h3 font-semibold text-neutral-950">{data?.organization.name ?? org_slug}</p>
            <p className="text-caption text-neutral-600">Client portal</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {loading ? (
          <p className="text-body text-neutral-600">Loading…</p>
        ) : error ? (
          <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>
        ) : !data ? null : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-display font-semibold text-neutral-950">{data.project.name}</h1>
                <p className="mt-1 text-body text-neutral-600">Prepared for {data.clientName}</p>
              </div>
              <ProjectStatusBadge status={data.project.status} />
            </div>

            {/* Plain, computed status summary — not AI-generated, see the
                PortalData.summary TODO above. */}
            <Card padding="sm" color={projectStatusColor(data.project.status)}>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <p className="text-small text-neutral-600">Current milestone</p>
                  <p className="text-body-medium font-medium text-neutral-950">
                    {data.summary.currentMilestoneName ?? "None"}
                  </p>
                </div>
                <div>
                  <p className="text-small text-neutral-600">Tasks complete</p>
                  <p className="text-body-medium font-medium text-neutral-950">{data.summary.pctTasksDone}%</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${data.summary.pctTasksDone}%`, backgroundColor: brandColor ?? "var(--primary-600)" }}
                />
              </div>
            </Card>

            {(data.project.budgetAllocated != null || data.project.budgetSpent != null) && (
              <Card padding="sm" className="space-y-1">
                <h2 className="text-h3 font-semibold text-neutral-800">Budget</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-body">
                  <span className="text-neutral-600">
                    Allocated:{" "}
                    <span className="font-medium text-neutral-950">
                      {data.project.budgetAllocated != null ? `$${data.project.budgetAllocated.toLocaleString()}` : "Not set"}
                    </span>
                  </span>
                  <span className="text-neutral-600">
                    Spent:{" "}
                    <span className="font-medium text-neutral-950">
                      {data.project.budgetSpent != null ? `$${data.project.budgetSpent.toLocaleString()}` : "Not set"}
                    </span>
                  </span>
                </div>
              </Card>
            )}

            <div className="space-y-3">
              <h2 className="text-h3 font-semibold text-neutral-800">Milestones</h2>
              {data.milestones.length === 0 ? (
                <p className="text-body text-neutral-600">No milestones yet.</p>
              ) : (
                <Card padding="sm" className="p-0">
                  <ul className="divide-y divide-neutral-200">
                    {data.milestones.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
                        <div>
                          <p className="text-neutral-950">{m.name}</p>
                          <p className="text-small text-neutral-600">{m.dueDate ?? "No due date"}</p>
                        </div>
                        {m.approvedAt ? (
                          <Badge color="success">Approved</Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => approveMilestone(m.id)}
                            disabled={approvingId === m.id}
                          >
                            {approvingId === m.id ? "Approving…" : "Approve"}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
