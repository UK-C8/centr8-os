"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Org = { id: string; name: string; slug: string; role: string };

type OrgContextValue = {
  orgs: Org[];
  selectedOrgId: string | null;
  selectedOrg: Org | null;
  setSelectedOrgId: (id: string) => void;
  loading: boolean;
  error: string | null;
};

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = "centr8-selected-org-id";

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  function setSelectedOrgId(id: string) {
    setSelectedOrgIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;

  return (
    <OrgContext.Provider value={{ orgs, selectedOrgId, selectedOrg, setSelectedOrgId, loading, error }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
