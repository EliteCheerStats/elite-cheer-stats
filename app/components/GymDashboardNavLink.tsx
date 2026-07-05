"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function GymDashboardNavLink() {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setHasAccess(false);
        return;
      }

      const { data: membership } = await supabase
        .from("organization_users")
        .select(`
          organization_id,
          organizations (
            id,
            name,
            subscription_status
          )
        `)
        .eq("user_id", userId)
        .maybeSingle();

      const organization = Array.isArray(membership?.organizations)
        ? membership.organizations[0]
        : membership?.organizations;

      setHasAccess(!!membership && organization?.subscription_status === "active");
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