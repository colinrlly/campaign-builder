"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(action: "signin" | "signup") {
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } =
      action === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (action === "signup") {
      // If email confirmation is disabled in Supabase, a session exists now.
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setInfo("Check your email to confirm your account, then sign in.");
        return;
      }
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">Editor sign in</h1>
      <p className="mt-1 text-sm text-slate-400">
        Sign in to edit maps and lore. The player viewer stays public.
      </p>

      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          handle("signin");
        }}
      >
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md bg-slate-800 px-3 py-2 ring-1 ring-slate-600 outline-none focus:ring-sky-500"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md bg-slate-800 px-3 py-2 ring-1 ring-slate-600 outline-none focus:ring-sky-500"
        />

        {error && <p className="text-sm text-rose-400">{error}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? "…" : "Sign in"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("signup")}
          className="rounded-md px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-600 hover:bg-slate-800 disabled:opacity-50"
        >
          Create account
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
