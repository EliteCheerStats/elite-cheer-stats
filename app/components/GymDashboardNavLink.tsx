"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveGymOrganization } from "@/lib/gym-dashboard/getActiveOrganization";

export default function GymDashboardNavLink() {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Unable to load user session for Gym Dashboard access:",
          sessionError
        );
        setHasAccess(false);
        return;
      }

      const userId = session?.user?.id;

      if (!userId) {
        setHasAccess(false);
        return;
      }

      try {
        const activeOrganization =
          await getActiveGymOrganization(userId);

        setHasAccess(Boolean(activeOrganization));
      } catch (accessError) {
        console.error(
          "Unable to resolve Gym Dashboard access:",
          accessError
        );
        setHasAccess(false);
      }
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