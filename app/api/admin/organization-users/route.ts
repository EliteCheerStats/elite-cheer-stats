import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { authorizeAdminRequest } from "@/lib/admin/authorize-admin-request";

const ALLOWED_ROLES = new Set(["owner", "admin", "member"]);

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request);

  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const userId =
    typeof payload.userId === "string" ? payload.userId.trim() : "";

  const organizationId =
    typeof payload.organizationId === "string"
      ? payload.organizationId.trim()
      : "";

  const role =
    typeof payload.role === "string"
      ? payload.role.trim().toLowerCase()
      : "owner";

  if (!userId || !organizationId || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { error: "Invalid assignment request." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "User does not exist." },
      { status: 404 }
    );
  }

  const { data: organization, error: organizationError } =
    await supabaseServer
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

  if (organizationError) {
    return NextResponse.json(
      { error: organizationError.message },
      { status: 500 }
    );
  }

  if (!organization) {
    return NextResponse.json(
      { error: "Organization does not exist." },
      { status: 404 }
    );
  }

  const { error: upsertError } = await supabaseServer
    .from("organization_users")
    .upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        role,
      },
      {
        onConflict: "organization_id,user_id",
      }
    );

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    assignment: {
      userId,
      userEmail: profile.email,
      organizationId,
      organizationName: organization.name,
      role,
    },
  });
}