"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function GymDashboardNavLink() {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;

      if (!userId) {
        setHasAccess(false);
        return;
      }

      const { data: membership, error } = await supabase
        .from("v_user_organizations")
        .select(`
          organization_id,
          organization_name,
          subscription_status,
          role
        `)
        .eq("user_id", userId)
        .eq("subscription_status", "active")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Gym Dashboard access check failed:", error);
        setHasAccess(false);
        return;
      }

      setHasAccess(!!membership);
    }

    checkAccess();
  }, []);

  if (!hasAccess) return null;

  return (
    <a
      className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-cyan-200 hover:bg-cyan-500/20"
      href="/gym-dashboard"
    >
      Gym Dashboard
    </a>
  );
}