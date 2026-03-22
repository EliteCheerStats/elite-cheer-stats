"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type PremiumLockProps = {
  children: React.ReactNode;
  title?: string;
  compact?: boolean;
  className?: string;
};

export default function PremiumLock({
  children,
  title = "Go Premium",
  compact = false,
  className = "",
}: PremiumLockProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
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
        console.error("premium lock profile fetch error:", error);
        setIsPremium(false);
        setLoading(false);
        return;
      }

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

  if (loading) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}>
        <div className="text-sm text-white/60">Loading…</div>
      </div>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none select-none blur-[6px] opacity-60">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`rounded-2xl border border-white/10 bg-[#131f3a]/95 text-white shadow-xl backdrop-blur ${
            compact ? "max-w-sm p-4" : "max-w-md p-6"
          }`}
        >
          <h3 className={`${compact ? "text-xl" : "text-2xl"} font-bold`}>
            {title}
          </h3>

          <p className="mt-2 text-sm text-white/75">
            {session?.user ? session.user.email : "Sign in required"}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {session?.user ? (
              <>
                <Link
                  href="/upgrade"
                  className="inline-flex rounded-md bg-[#18d3c5] px-4 py-2 font-semibold text-[#06253b] hover:opacity-90"
                >
                  Go Premium
                </Link>

                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
  href="/compare"
  className="inline-flex rounded-md bg-[#18d3c5] px-4 py-2 font-semibold text-[#06253b] hover:opacity-90"
>
  Sign in
</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}