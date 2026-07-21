// Placeholder per Prompt 0.1 — outside the (app) shell/auth group since
// client-portal users are not org_memberships rows (Phase 3.1 territory).
export default async function PortalPage({ params }: { params: Promise<{ org_slug: string }> }) {
  const { org_slug } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100">
      <div className="text-center">
        <h1 className="text-h2 font-semibold text-neutral-950">Client Portal</h1>
        <p className="mt-1 text-body text-neutral-600">
          Branded portal for <span className="font-mono">{org_slug}</span> — coming in Phase 3.1.
        </p>
      </div>
    </div>
  );
}
