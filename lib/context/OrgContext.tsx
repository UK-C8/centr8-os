"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { PermissionAction, ResourceType } from "@/lib/api/permissions";

export type Org = { id: string; name: string; slug: string; role: string };

type OrgContextValue = {
  orgs: Org[];
  selectedOrgId: string | null;
  selectedOrg: Org | null;
  setSelectedOrgId: (id: string) => void;
  loading: boolean;
  error: string | null;
  // Table-driven, sourced from GET /api/permissions — the same `permissions`
  // rows requirePermission() enforces server-side (Prompt 1.4 task 4), not
  // a hardcoded role name check. Defaults to false while permissions are
  // still loading, so actions stay hidden/disabled rather than flash on.
  can: (resourceType: ResourceType, action: PermissionAction) => boolean;
  permissionsLoading: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = "centr8-selected-org-id";

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grants, setGrants] = useState<Set<string>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orgs")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load organizations");
        return body.data as Org[];
      })
      .then((data) => {
        setOrgs(data);
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const initial = data.find((o) => o.id === stored)?.id ?? data[0]?.id ?? null;
        setSelectedOrgIdState(initial);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load organizations"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    setPermissionsLoading(true);
    fetch(`/api/permissions?org_id=${selectedOrgId}`)
      .then((res) => res.json())
      .then((body) => {
        const rows = (body.data ?? []) as { resourceType: string; action: string }[];
        setGrants(new Set(rows.map((r) => `${r.resourceType}:${r.action}`)));
      })
      .catch(() => setGrants(new Set()))
      .finally(() => setPermissionsLoading(false));
  }, [selectedOrgId]);

  function setSelectedOrgId(id: string) {
    setSelectedOrgIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }

  function can(resourceType: ResourceType, action: PermissionAction) {
    return grants.has(`${resourceType}:${action}`);
  }

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{ orgs, selectedOrgId, selectedOrg, setSelectedOrgId, loading, error, can, permissionsLoading }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
