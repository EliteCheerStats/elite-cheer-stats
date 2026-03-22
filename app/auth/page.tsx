"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/";
    return next;
  }, [searchParams]);

  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

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

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password;

      if (!cleanEmail || !cleanPassword) {
        setAuthError("Please enter both email and password.");
        setAuthLoading(false);
        return;
      }

      if (authMode === "signup") {
        const { data: existingProfile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", cleanEmail)
          .maybeSingle();

        if (profileError) {
          setAuthError("Could not verify account status. Please try again.");
          setAuthLoading(false);
          return;
        }

        if (existingProfile) {
          setAuthError("An account with this email already exists. Please log in.");
          setAuthMode("login");
          setAuthLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          setAuthError(error.message);
          setAuthLoading(false);
          return;
        }

        if (data.session?.user) {
          router.replace(nextPath);
          return;
        }

        setAuthMessage("Account created. Please log in.");
        setAuthMode("login");
        setAuthLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }

      router.replace(nextPath);
    } catch {
      setAuthError("Something went wrong. Please try again.");
      setAuthLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#020b2d] text-white">
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-white/10 bg-[#03123b] p-8">
            <h1 className="text-3xl font-bold">Loading…</h1>
            <p className="mt-3 text-white/75">Checking your account session.</p>
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

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Competitive Cheerleading Analytics
          </p>

          <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">
            {authMode === "signup" ? "Create your free account" : "Log in"}
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-white/85">
            {authMode === "signup"
              ? "Create an account to unlock Premium analytics and continue to your destination."
              : "Log in to continue to your account and Premium features."}
          </p>

          {nextPath !== "/" && (
            <p className="mt-3 text-sm text-[#52f7ea]">
              After login, you’ll be sent to <span className="font-semibold">{nextPath}</span>.
            </p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_480px] lg:items-start">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard
                title="Rankings"
                desc="Track team movement, leaderboard visibility, and season momentum."
              />
              <FeatureCard
                title="Team Search"
                desc="Quickly find teams, scores, trends, and event history."
              />
              <FeatureCard
                title="Team Comparison"
                desc="Compare teams side by side across scoring trends and outcomes."
              />
              <FeatureCard
                title="Premium Analytics"
                desc="Unlock ceiling score, hit-zero rate, deeper rankings, and more."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#03123b] p-6 shadow-xl">
            <h2 className="text-2xl font-bold">
              {authMode === "signup" ? "Create your free account" : "Log in"}
            </h2>

            <p className="mt-2 text-white/75">
              {authMode === "signup"
                ? "Create an account to save your access and unlock Premium features."
                : "Log in with your email and password."}
            </p>

            <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/80">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[#0b1a3a] px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#18d3c5] focus:ring-1 focus:ring-[#18d3c5]/40"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/80">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[#0b1a3a] px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#18d3c5] focus:ring-1 focus:ring-[#18d3c5]/40"
                  placeholder="Enter password"
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                />
              </div>

              {authError && <p className="text-sm text-red-400">{authError}</p>}
              {authMessage && <p className="text-sm text-emerald-400">{authMessage}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-md bg-[#18d3c5] px-4 py-3 font-semibold text-[#06253b] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading
                  ? authMode === "signup"
                    ? "Creating Account..."
                    : "Logging In..."
                  : authMode === "signup"
                    ? "Create Account"
                    : "Log In"}
              </button>
            </form>

            <div className="mt-4 text-sm text-white/65">
              {authMode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                      setAuthMessage(null);
                    }}
                    className="font-semibold text-[#41f4e1] hover:underline"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Need an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError(null);
                      setAuthMessage(null);
                    }}
                    className="font-semibold text-[#41f4e1] hover:underline"
                  >
                    Create one
                  </button>
                </>
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-sm text-white/55">
              <Link href="/" className="hover:text-white">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#021033] p-6">
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className="mt-4 text-lg text-white/85">{desc}</p>
    </div>
  );
}