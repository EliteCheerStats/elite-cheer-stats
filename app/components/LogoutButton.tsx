"use client";

import { supabase } from "@/lib/supabaseClient";



export default function LogoutButton() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
    >
      Log out
    </button>
  );
}