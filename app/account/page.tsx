"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
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
        console.error("account profile fetch error:", error);
        setIsPremium(false);
        setLoading(false);
        return;
      }

      setIsPremium(!!data?.is_premium);
      setLoading(false);
    }

    loadAccount();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadAccount();
    });

    const handleFocus = () => {
      loadAccount();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleManageSubscription() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("You must be signed in.");
      return;
    }

    const res = await fetch("/api/create-portal-session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await res.json();

    if (data?.url) {
      window.location.href = data.url;
      return;
    }

    alert(data?.error || "Unable to open billing portal right now.");
  } catch (err) {
    console.error("portal session error:", err);
    alert("Unable to open billing portal right now.");
  }
}

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-extrabold text-white">Account</h1>
          <p className="mt-3 text-slate-300">Loading…</p>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-extrabold text-white">Account</h1>
          <p className="mt-3 text-slate-300">You’re not signed in.</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-extrabold text-white">Account</h1>

        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Email
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {session.user.email}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Plan
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {isPremium ? "Premium" : "Free"}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
  {isPremium ? (
    <>
      <button
        onClick={handleManageSubscription}
        className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
      >
        Manage Subscription
      </button>

      <a
        href={`mailto:contactus@elitecheerstats.com?subject=${encodeURIComponent(
          "Refund Request - Elite Cheer Stats"
        )}&body=${encodeURIComponent(
          `Hi,\n\nI would like to request a refund.\n\nAccount email: ${session.user.email}\nReason: My team is not included / product did not meet expectations.\n\nThank you.`
        )}`}
        className="rounded-md border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
      >
        Request a Refund
      </a>
    </>
  ) : (
    <Link
      href="/upgrade"
      className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
    >
      Go Premium
    </Link>
  )}

  <button
    onClick={handleSignOut}
    className="rounded-md border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
  >
    Sign Out
  </button>
</div>
{isPremium && (
  <p className="mt-4 text-xs text-white/60">
    If your team is not included, you may request a full refund within 24 hours of signup.
  </p>
)}
      </div>
    </main>
  );
}