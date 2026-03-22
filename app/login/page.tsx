"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");

  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/", [searchParams]);

  async function handleLogin() {
    setStatus("loading");
    setMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus("error");
      setMsg(error.message);
      return;
    }

    window.location.href = next;
  }

  return (
    <main className="bg-[#0b1020] text-white px-4 py-12">
  <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Log in to your account</h1>

        <p className="mt-2 text-white/70 text-sm">
          Enter your email and password to continue.
        </p>

        <label className="mt-6 block text-sm text-white/80">Email</label>
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
        />

        <label className="mt-4 block text-sm text-white/80">Password</label>
        <input
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
        />

        {msg && (
          <div className="mt-3 text-sm text-red-300">
            {msg}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={status === "loading"}
          className="mt-4 w-full rounded-md bg-teal-500/90 hover:bg-teal-500 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {status === "loading" ? "Logging in..." : "Log In"}
        </button>

        <p className="mt-4 text-xs text-white/50">
          Need an account?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="underline text-teal-300">
            Create one here
          </Link>
        </p>
      </div>
    </main>
  );
}