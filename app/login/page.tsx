"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-md border border-neutral-300 bg-neutral-50 p-6 shadow-sm"
      >
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Sign in to Centr8 OS</h1>
          <p className="mt-1 text-body text-neutral-600">The AI-native operating system for work.</p>
        </div>

        <label className="block text-body-medium font-medium text-neutral-800">
          Email
          <Input 
            type="email"
            required
            className="mt-1 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-body-medium font-medium text-neutral-800">
          Password
          <Input 
            type="password"
            required
            className="mt-1 w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="rounded-sm bg-danger-100 px-3 py-2 text-body text-danger-600">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
