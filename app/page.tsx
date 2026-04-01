"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        setSessionEmail(null);
        setIsPremium(false);
        setLoading(false);
        return;
      }

      setSessionEmail(session.user.email ?? null);

      const { data } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      setIsPremium(!!data?.is_premium);
      setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

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
          window.location.reload();
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
        setAuthError("Invalid email or password.");
        setAuthLoading(false);
        return;
      }

      window.location.reload();
    } catch {
      setAuthError("Something went wrong. Please try again.");
      setAuthLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020b2d] text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white">
            Competitive Cheerleading Analytics
          </p>

          <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">
            Elite Cheer Stats
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-white/85">
            Rankings, team search, comparisons, and premium cheer analytics built
            for parents, athletes, and gym decision-makers.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">

<Link
              href="/rankings"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold hover:bg-white/10"
            >
              Rankings
            </Link>

            <Link
              href="/team"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold hover:bg-white/10"
            >
              Search a Team
            </Link>
            
            <Link
              href="/compare"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold hover:bg-white/10"
            >
              Compare Teams
            </Link>

            
            <Link
              href="/comp-builder"
              className="rounded-xl border border-[#00e5d4]/30 bg-[#00e5d4]/10 px-6 py-3 text-base font-semibold text-[#52f7ea] hover:bg-[#00e5d4]/15"
            >
              Comp Builder
            </Link>
          </div>

          {!loading && sessionEmail && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm">
                {sessionEmail}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  isPremium
                    ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : "border border-amber-400/30 bg-amber-500/10 text-amber-300"
                }`}
              >
                {isPremium ? "Premium" : "Free"}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureCard
              title="Rankings"
              desc="Free access to top team movement and leaderboard visibility."
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

        {!loading && !sessionEmail && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#03123b] p-6">
            <h2 className="text-2xl font-bold">
              {authMode === "signup" ? "Create your free account" : "Log in"}
            </h2>

            <p className="mt-2 text-white/75">
              {authMode === "signup"
                ? "Create an account to unlock Premium analytics and save your access."
                : "Log in to access your account and Premium features."}
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
          </div>
        )}
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