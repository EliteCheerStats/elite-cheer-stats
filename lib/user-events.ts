import { supabase } from "@/lib/supabaseClient";

export async function trackUserEvent({
  eventType,
  page,
  teamId = null,
  eventId = null,
  metadata = {},
}: {
  eventType: string;
  page: string;
  teamId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, any>;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    console.log("trackUserEvent: no session user");
    return;
  }

  const { data, error } = await supabase.from("user_events").insert({
    user_id: session.user.id,
    event_type: eventType,
    page_path: page,
    team_id: teamId,
    event_id: eventId,
    metadata,
  });

  console.log("trackUserEvent result:", { data, error });
}