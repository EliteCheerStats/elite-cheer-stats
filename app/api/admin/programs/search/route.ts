import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { authorizeAdminRequest } from "@/lib/admin/authorize-admin-request";

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request);

  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ programs: [] });
  }

  const { data, error } = await supabaseServer
    .from("programs")
    .select("id, name, match_key")
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    programs: data ?? [],
  });
}