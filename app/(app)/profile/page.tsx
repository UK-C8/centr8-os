"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function ProfilePage() {
  const { orgs, loading: orgLoading } = useOrg();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Profile settings</h1>

      <Card className="space-y-4">
        <div>
          <p className="text-small text-neutral-600">Email</p>
          <p className="text-body-medium font-medium text-neutral-950">{email ?? "Loading…"}</p>
        </div>

        <div>
          <p className="mb-2 text-small text-neutral-600">Organizations</p>
          {orgLoading ? (
            <p className="text-body text-neutral-600">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="text-body text-neutral-600">Not a member of any organization.</p>
          ) : (
            <ul className="space-y-2">
              {orgs.map((org) => (
                <li key={org.id} className="flex items-center justify-between">
                  <span className="text-body text-neutral-950">{org.name}</span>
                  <Badge>{org.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
