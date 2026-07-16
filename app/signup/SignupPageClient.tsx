"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPageClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");

  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/", [searchParams]);

  async function handleSignup() {
    setStatus("loading");
    setMsg("");

    const { error } = await supabase.auth.signUp({
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
        <h1 className="text-2xl font-bold">Create your free account</h1>

        <p className="mt-2 text-white/70 text-sm">
          Create an account to unlock Premium analytics and save your access.
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
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
        />

        {msg && <div className="mt-3 text-sm text-red-300">{msg}</div>}

        <button
          onClick={handleSignup}
          disabled={status === "loading"}
          className="mt-4 w-full rounded-md bg-teal-500/90 hover:bg-teal-500 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {status === "loading" ? "Creating account..." : "Create Account"}
        </button>

        <p className="mt-4 text-xs text-white/50">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="underline text-teal-300"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}