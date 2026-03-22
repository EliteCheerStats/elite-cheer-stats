"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Signing you in...");
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/", [searchParams]);

  useEffect(() => {
    async function finishLogin() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("getSession error:", error);
          setMessage("Login failed. Please try again.");
          return;
        }

        if (data.session) {
          window.location.replace(next);
          return;
        }

        setMessage("No active session found. Please try logging in again.");
      } catch (err) {
        console.error("auth callback error:", err);
        setMessage("Login failed. Please try again.");
      }
    }

    finishLogin();
  }, [next]);

  return (
    <main className="p-6 text-white bg-[#0b1020] min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Signing you in</h1>
      <p>{message}</p>
    </main>
  );
}