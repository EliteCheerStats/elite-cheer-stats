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

  const email = request.nextUrl.searchParams
    .get("email")
    ?.trim()
    .toLowerCase();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required." },
      { status: 400 }
    );
  }

  const supabase = supabaseServer;

  const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, email")
  .ilike("email", email)
  .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "User not found." },
      { status: 404 }
    );
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_users")
    .select(`
      organization_id,
      role,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", profile.id);

  if (membershipError) {
    return NextResponse.json(
      { error: membershipError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    user: {
      id: profile.id,
      email: profile.email,
      fullName: null,
      memberships: (memberships || []).map((membership: any) => ({
        organizationId: membership.organization_id,
        organizationName:
          membership.organizations?.name || membership.organization_id,
        role: membership.role,
      })),
    },
  });
}
