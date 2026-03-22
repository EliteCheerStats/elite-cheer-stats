"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Checking recovery session...");

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error(error);
        setMessage("Recovery session failed.");
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
  }, []);

  async function handleReset() {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated. You can now log in.");
    window.location.href = "/login";
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
      <p className="mb-4">{message}</p>

      {ready ? (
        <div className="flex gap-2">
<input
  type="password"
  placeholder="New password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className="w-full rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-teal-400/50"
/>
          <button
            onClick={handleReset}
            className="bg-black text-white px-4 py-2"
          >
            Set Password
          </button>
        </div>
      ) : null}
    </main>
  );
}