"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import LogoutButton from "@/app/components/LogoutButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Profile = {
  email: string;
  is_premium: boolean;
};

export default function AuthStatus() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        setEmail(null);
        setIsPremium(false);
        setLoading(false);
        return;
      }

      setEmail(user.email);

      const { data } = await supabase
        .from("profiles")
        .select("email, is_premium")
        .eq("email", user.email)
        .single();

      setIsPremium(data?.is_premium ?? false);
      setLoading(false);
    }

    loadStatus();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-white/60">
        Checking session...
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="rounded-full border border-white/15 px-3 py-1 text-white/70">
          Logged out
        </span>
        <a href="/login" className="underline text-teal-300">
          Log in
        </a>
      </div>
    );
  }

  return (
  <div className="flex flex-wrap items-center gap-3 text-sm">
    <span className="rounded-full border border-white/15 px-3 py-1 text-white/80">
      {email}
    </span>

    <span
      className={`rounded-full px-3 py-1 font-medium ${
        isPremium
          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
          : "bg-white/5 text-white/70 border border-white/15"
      }`}
    >
      {isPremium ? "Premium" : "Free"}
    </span>

    {/* 👇 CONDITIONAL BUTTON */}
    {!isPremium && (
      <button
        onClick={() => (window.location.href = "/")}
        className="rounded bg-black px-4 py-2 text-white"
      >
        Upgrade to Premium
      </button>
    )}

    <LogoutButton />
  </div>
);
}