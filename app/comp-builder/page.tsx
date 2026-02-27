"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "ecs_comp_builder_email_v1";

// Optional: save emails to Supabase (waitlist table). If you don't want DB storage,
// set SAVE_TO_SUPABASE = false.
const SAVE_TO_SUPABASE = true;

const supabase =
  SAVE_TO_SUPABASE
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

export default function CompBuilderPage() {
  const [gateEmail, setGateEmail] = useState<string>("");
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        setUnlocked(true);
        setGateEmail(existing);
      }
    } catch {
      // ignore
    }
  }, []);

  const unlock = async () => {
    setMsg("");
    setStatus("loading");

    const email = gateEmail.trim();

    // Minimal check (not real verification)
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMsg("Please enter your email to continue.");
      return;
    }

    // Save locally to “unlock” the page
    try {
      localStorage.setItem(STORAGE_KEY, email);
    } catch {
      // ignore
    }

    // Optional: store in Supabase waitlist
    if (SAVE_TO_SUPABASE && supabase) {
      const { error } = await supabase.from("waitlist").insert({
        email: email.toLowerCase(),
        source: "comp_builder_gate",
      });

      // If duplicate, treat as fine
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        setStatus("error");
        setMsg("Saved locally, but failed to save to waitlist.");
        setUnlocked(true); // still unlock
        return;
      }
    }

    setUnlocked(true);
    setStatus("idle");
  };

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setUnlocked(false);
    setGateEmail("");
    setMsg("");
    setStatus("idle");
  };

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#0B0F1A] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Comp Builder</h1>
          <p className="mt-1 text-sm text-white/70">
            Enter your email to view the Comp Builder preview.</p>
            <p>**NOTE: This feature is not live yet.
          </p>

          <label className="mt-5 block text-sm text-white/80">Email</label>
          <input
            value={gateEmail}
            onChange={(e) => setGateEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
          />

          {msg && (
            <div className={`mt-3 text-sm ${status === "error" ? "text-red-300" : "text-white/80"}`}>
              {msg}
            </div>
          )}

          <button
            onClick={unlock}
            disabled={status === "loading"}
            className="mt-4 w-full rounded-md bg-teal-500/90 hover:bg-teal-500 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {status === "loading" ? "Opening..." : "Continue"}
          </button>

          <p className="mt-4 text-xs text-white/50">
            No spam. Just a launch notification when features are LIVE.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Comp Builder</h1>
            <p className="text-sm text-white/70">Preview (coming soon)</p>
          </div>

          <button
            onClick={reset}
            className="rounded-md border border-white/15 hover:bg-white/5 px-3 py-2 text-sm"
            title="Clear saved email and re-lock"
          >
            Reset Gate
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3">
          <Image
            src="/comp-builder-coming-soon.png"
            alt="Comp Builder Preview"
            width={1600}
            height={900}
            priority
            className="w-full h-auto rounded-xl"
          />
        </div>
      </div>
    </main>
  );
}