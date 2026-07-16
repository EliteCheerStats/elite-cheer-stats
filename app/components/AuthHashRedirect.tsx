"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthHashRedirect() {
  useEffect(() => {
    async function checkRecovery() {
      const hash = window.location.hash || "";

      // Only do anything if Supabase auth tokens are in the URL fragment
      if (!hash.includes("access_token")) return;

      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const type = params.get("type");

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("getSession error:", error);
        return;
      }

      if (data.session && type === "recovery") {
        window.location.replace("/reset-password");
      }
    }

    checkRecovery();
  }, []);

  return null;
}