"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/";
    return next;
  }, [searchParams]);

  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        router.replace(nextPath);
        return;
      }

      setCheckingSession(false);
    }

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace(nextPath);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router, nextPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password;

      if (!cleanEmail || !cleanPassword) {
        setErrorMsg("Please enter both email and password.");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        setSuccessMsg("Account created. You can log in now.");
        setMode("login");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      router.replace(nextPath);
    } catch (err) {
      console.error("auth page error:", err);
      setErrorMsg("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#020b2d] text-white">
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-white/10 bg-[#03123b] p-8">
            <h1 className="text-3xl font-bold">Loading…</h1>
            <p className="mt-3 text-white/75">Checking your session.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020b2d] text-white">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <Link href="/" className="inline-flex items-center text-2xl font-extrabold">
            <span className="text-white">Elite Cheer </span>
            <span className="text-[#18d3c5]">Stats</span>
          </Link>

          <h1 className="mt-6 text-4xl font-extrabold sm:text-5xl">
            {mode === "login" ? "Log in" : "Create your account"}
          </h1>

          {nextPath !== "/" && (
            <p className="mt-3 text-sm text-[#52f7ea]">
              After auth, you’ll be sent to <span className="font-semibold">{nextPath}</span>
            </p>
          )}
        </div>

        <div className="max-w-xl rounded-2xl border border-white/10 bg-[#03123b] p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-white/80">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-md border border-white/15 bg-[#0b1a3a] px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#18d3c5] focus:ring-1 focus:ring-[#18d3c5]/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/80">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Enter password"
                className="w-full rounded-md border border-white/15 bg-[#0b1a3a] px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#18d3c5] focus:ring-1 focus:ring-[#18d3c5]/40"
              />
            </div>

            {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
            {successMsg && <p className="text-sm text-emerald-400">{successMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#18d3c5] px-4 py-3 font-semibold text-[#06253b] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Log In"
                  : "Create Account"}
            </button>
          </form>

          <div className="mt-4 text-sm text-white/65">
            {mode === "login" ? (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-semibold text-[#41f4e1] hover:underline"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-semibold text-[#41f4e1] hover:underline"
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}