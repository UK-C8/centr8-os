"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/projects", label: "Projects", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { href: "/sprints", label: "Sprints", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { href: "/tasks", label: "Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/executive", label: "Executive", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14" },
  { href: "/ai/create-project", label: "AI Draft", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { href: "/health", label: "Health", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { orgs, selectedOrgId, setSelectedOrgId, loading } = useOrg();
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Close the drawer on route change so it doesn't stay open after nav.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navContent = (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-neutral-300 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary-600 text-caption font-semibold text-neutral-50">
          C8
        </div>
        <span className="text-h3 font-semibold text-neutral-950">Centr8 OS</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-sm px-3 py-2 text-body-medium font-medium transition-colors ${
                active ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-neutral-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-300 bg-neutral-50 md:flex">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-neutral-950/40" onClick={() => setNavOpen(false)} />
          <aside className="relative flex h-full w-64 max-w-[80vw] flex-col bg-neutral-50 shadow-lg">{navContent}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b border-neutral-300 bg-neutral-50 px-3 sm:px-6">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="rounded-sm p-2 text-neutral-600 hover:bg-neutral-200 md:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden md:block" />

          <div className="flex items-center gap-2 sm:gap-3">
            {loading ? (
              <span className="hidden text-body text-neutral-600 sm:inline">Loading orgs…</span>
            ) : orgs.length === 0 ? (
              <span className="hidden text-body text-warning-600 sm:inline">Not a member of any organization</span>
            ) : (
              <select
                value={selectedOrgId ?? ""}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-28 rounded-sm border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-body focus:outline focus:outline-2 focus:outline-primary-600 sm:w-auto sm:px-3"
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} · {org.role}
                  </option>
                ))}
              </select>
            )}

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-neutral-200"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-caption font-medium text-neutral-50">
                  {(email ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden max-w-[10rem] truncate text-body-medium font-medium text-neutral-800 sm:inline">
                  {email ?? "Account"}
                </span>
                <svg className="hidden h-3.5 w-3.5 text-neutral-600 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-neutral-300 bg-neutral-50 py-1 shadow-lg">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-body text-neutral-800 hover:bg-neutral-200"
                  >
                    Profile settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-3 py-2 text-left text-body text-danger-600 hover:bg-neutral-200"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
