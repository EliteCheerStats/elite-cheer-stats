"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UpgradePage() {
  const [message, setMessage] = useState("Checking your account...");

  useEffect(() => {
    async function runUpgradeFlow() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !user.email) {
        window.location.replace("/login?next=/upgrade");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, is_premium")
        .eq("email", user.email)
        .single();

      if (profileError) {
        console.error("profile fetch error:", profileError);
        setMessage("Unable to verify account status.");
        return;
      }

      if (profile?.is_premium) {
        window.location.replace("/compare");
        return;
      }

      setMessage("Redirecting to checkout...");

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const raw = await res.text();

      let data: { url?: string; error?: string } | null = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        console.error("Response was not JSON");
      }

      if (res.ok && data?.url) {
        window.location.replace(data.url);
        return;
      }

      console.error("Upgrade route error:", raw);
      setMessage(data?.error || "Unable to start checkout.");
    }

    runUpgradeFlow();
  }, []);

  return (
    <main className="min-h-screen bg-[#0b1020] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-2xl font-bold">Unlock Premium</h1>
        <p className="mt-3 text-white/70 text-sm">{message}</p>
      </div>
    </main>
  );
}