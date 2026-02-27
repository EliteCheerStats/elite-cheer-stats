import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const division_key = (url.searchParams.get("division_key") ?? "").trim() || null;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const sb = createClient(supabaseUrl, serviceRole);

  // 🔁 TODO: swap this to your Team Search source (view/table)
  // Example assumes a view like v_team_search that already returns team_id/program/team/division_key/division_label/metric_value
  let query = sb
    .from("v_team_search")
    .select("team_id, program, team, division_key, division_label, metric_value")
    .limit(limit);

  if (q) {
    // Adjust columns as needed
    query = query.or(`program.ilike.%${q}%,team.ilike.%${q}%`);
  }
  if (division_key) {
    query = query.eq("division_key", division_key);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}