"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SubscriptionButton() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
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

      const { data } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      setIsPremium(!!data?.is_premium);
      setLoading(false);
    }

    check();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  if (!session) {
    return (
      <Link
        href="/login"
        className="ml-1 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/10"
      >
        Sign In
      </Link>
    );
  }

  if (!isPremium) {
    return (
      <Link
        href="/upgrade"
        className="ml-1 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200 hover:bg-teal-500/20"
      >
        Go Premium
      </Link>
    );
  }

  return (
    <a
      href="/account"
      className="ml-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
    >
      Manage Subscription
    </a>
  );
}