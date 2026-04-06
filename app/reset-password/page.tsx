"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Checking recovery session...");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    async function init() {
      setErrorMsg("");
      setReady(false);
      setMessage("Checking recovery session...");

      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (accessToken && refreshToken && type === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            if (!mounted) return;
            setMessage("Reset link is invalid or expired. Request a new one.");
            return;
          }

          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        }
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setMessage("Recovery session failed. Request a new reset link.");
        return;
      }

      if (data.session) {
        setReady(true);
        setMessage("Enter a new password.");
      } else {
        setMessage("No recovery session found. Open the reset link from your email again.");
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleReset() {
    setErrorMsg("");

    const cleanPassword = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPassword) {
      setErrorMsg("Please enter a new password.");
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password: cleanPassword });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    window.location.href = "/login?mode=login&reset=success";
  }

  return (
    <main className="bg-[#0b1020] text-white px-4 py-12 min-h-screen">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="mt-2 text-sm text-white/70">{message}</p>

        {ready && (
          <>
            <label className="mt-6 block text-sm text-white/80">New Password</label>
            <input
              type="password"
              placeholder="Enter a new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-teal-400/50"
            />

            <label className="mt-4 block text-sm text-white/80">Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-teal-400/50"
            />

            {errorMsg && (
              <div className="mt-3 text-sm text-red-300">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleReset}
              disabled={loading}
              className="mt-4 w-full rounded-md bg-teal-500/90 hover:bg-teal-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? "Updating..." : "Set Password"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}