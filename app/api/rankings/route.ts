import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const division = searchParams.get("division");
  const is_flex = searchParams.get("is_flex");
  const is_d2 = searchParams.get("is_d2");
  const size_effective = searchParams.get("size_effective");
  const min_events = Number(searchParams.get("min_events") ?? "2");

  if (!division || is_flex === null || is_d2 === null || !size_effective) {
    return NextResponse.json(
      { error: "division, is_flex, is_d2, size_effective are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer.rpc("get_rankings_from_normalized", {
    p_division: division,
    p_is_flex: is_flex === "true",
    p_is_d2: is_d2 === "true",
    p_size_effective: size_effective,
    p_min_events: min_events,
    p_limit: 200,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [] });
}