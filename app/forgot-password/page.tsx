"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleReset = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMsg("Please enter your email.");
      return;
    }

    setLoading(true);
    setMsg("");

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <main className="bg-[#0b1020] text-white px-4 py-12 min-h-screen">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="mt-2 text-sm text-white/70">
          Enter your email and we’ll send you a reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            Check your email for a password reset link.
          </div>
        ) : (
          <>
            <label className="mt-6 block text-sm text-white/80">Email</label>
            <input
              type="email"
              placeholder="you@email.com"
              className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {msg && (
              <div className="mt-3 text-sm text-red-300">
                {msg}
              </div>
            )}

            <button
              onClick={handleReset}
              disabled={loading}
              className="mt-4 w-full rounded-md bg-teal-500/90 hover:bg-teal-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}