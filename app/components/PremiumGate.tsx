"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type PremiumGateProps = {
  children: React.ReactNode;
};

export default function PremiumGate({ children }: PremiumGateProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();

    setAuthLoading(true);
    setAuthError(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password;

      if (!cleanEmail || !cleanPassword) {
        setAuthError("Enter email and password.");
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
          setAuthError("Could not verify account.");
          setAuthLoading(false);
          return;
        }

        if (existingProfile) {
          setAuthError("Account already exists. Sign in instead.");
          setAuthMode("login");
          setAuthLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          setAuthError(error.message);
          setAuthLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          const loginRes = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });

          if (loginRes.error) {
            setAuthError(loginRes.error.message);
            setAuthLoading(false);
            return;
          }
        }

        window.location.reload();
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

      window.location.reload();
    } catch {
      setAuthError("Something went wrong.");
      setAuthLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setAuthError("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthError("Check your email for a reset link.");
  }

  useEffect(() => {
    let mounted = true;

    async function checkPremium() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(session);

      if (!session?.user) {
        setIsPremium(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("profile fetch error:", error);
        setIsPremium(false);
        setLoading(false);
        return;
      }

      setIsPremium(!!data?.is_premium);
      setLoading(false);
    }

    checkPremium();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkPremium();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#03123b] p-6 text-white">
        <p className="text-white/70">Loading premium access…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#131f3a] p-6 text-white shadow-xl">
        <h2 className="text-3xl font-bold">
          {authMode === "login" ? "Sign in" : "Create account"}
        </h2>

        <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-white/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white outline-none"
              required
            />

            {authMode === "login" && (
              <div className="mt-1 text-right">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-teal-300 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {authError && (
            <div className="text-sm text-red-400">{authError}</div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-md bg-[#18d3c5] px-4 py-2 font-semibold text-[#06253b] hover:opacity-90 disabled:opacity-50"
          >
            {authLoading
              ? "Loading..."
              : authMode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-white/65">
          {authMode === "login" ? (
            <>
             <div className="mt-6 text-sm text-white/70 text-center">
  Need an account?{" "}
  <button
    onClick={() => setAuthMode("signup")}
    className="font-semibold text-teal-300 hover:text-teal-200 underline underline-offset-2"
  >
    Create account
  </button>
</div>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setAuthMode("login")}
                className="text-[#52f7ea] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#131f3a] p-6 text-white shadow-xl">
        <h2 className="text-3xl font-bold">Upgrade to Premium</h2>

        <p className="mt-3 text-white/80">
          You’re logged in as{" "}
          <span className="font-semibold text-white">
            {session.user.email}
          </span>
          .
        </p>

        <p className="mt-3 text-white/75">
          Unlock ceiling score, hit-zero rate, deeper rankings, team comparison
          tools, and premium analytics.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/upgrade"
            className="inline-flex rounded-md bg-[#18d3c5] px-5 py-3 font-semibold text-[#06253b] hover:opacity-90"
          >
            Upgrade Now
          </Link>

          <Link
            href="/"
            className="rounded-md border border-white/15 px-5 py-3 text-sm hover:bg-white/5"
          >
            Continue Free
          </Link>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
            className="rounded-md border border-white/15 px-5 py-3 text-sm hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}