"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

// Structured like shadcn's login-01 block (Card + Field/FieldGroup), but
// with the OAuth button and "Sign up" link dropped — this app has no OAuth
// provider configured and no self-serve signup (invite-only org membership,
// see /admin/members) — and wired to real Supabase email/password auth
// rather than the block's static markup.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(searchParams.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Decorative side — purely illustrative (skeleton placeholder bars,
          no invented stats/numbers), hidden below md same as the reference's
          split layout collapsing to a single column on mobile. */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-primary-100 p-10 md:flex">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-100 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-primary-600/20 blur-3xl" />

        <div className="relative w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary-600 text-body-medium font-semibold text-neutral-50">
              C8
            </div>
            <span className="text-h3 font-semibold text-neutral-950">Centr8 OS</span>
          </div>
          <div>
            <h2 className="text-h1 font-semibold text-neutral-950">The AI-native operating system for work</h2>
            <p className="mt-2 text-body text-neutral-600">
              Projects, HR, and CRM in one place — with an AI project manager that plans, monitors, and executes
              alongside you.
            </p>
          </div>

          <div className="rounded-md border border-neutral-300 bg-neutral-50/90 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-2.5 w-24 rounded-full bg-neutral-300" />
              <div className="h-2.5 w-10 rounded-full bg-primary-600/40" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2 rounded-sm bg-neutral-100 p-3">
                  <div className="h-2 w-10 rounded-full bg-neutral-300" />
                  <div className="h-4 w-14 rounded-full bg-neutral-300" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-end gap-1.5">
              {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                <div key={i} className="w-full rounded-full bg-primary-600/40" style={{ height: `${h}px` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex w-full items-center justify-center px-6 py-12 md:w-1/2">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col gap-2 md:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary-600 text-body-medium font-semibold text-neutral-50">
                  C8
                </div>
              </div>
              <div>
                <h1 className="text-h1 font-semibold text-neutral-950">Welcome back</h1>
                <FieldDescription>Sign in to your Centr8 OS workspace.</FieldDescription>
              </div>

              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  required
                  className="w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  required
                  className="w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error && <FieldError>{error}</FieldError>}

              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </div>
      </div>
    </div>
  );
}
