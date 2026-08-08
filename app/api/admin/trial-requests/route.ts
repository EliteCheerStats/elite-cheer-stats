import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { authorizeAdminRequest } from "@/lib/admin/authorize-admin-request";

const ALLOWED_STATUSES = new Set([
  "pending",
  "awaiting_information",
  "ready_to_provision",
  "provisioned",
  "declined",
  "cancelled",
]);

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request);

  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  const status = request.nextUrl.searchParams.get("status")?.trim();

  let query = supabaseServer
    .from("gym_dashboard_requests")
    .select(`
      id,
      request_type,
      status,
      gym_name,
      gym_location,
      requester_name,
      requester_email,
      requester_role,
      is_multi_location,
      team_list_text,
      user_id,
      organization_id,
      admin_notes,
      provisioned_by,
      provisioned_at,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Invalid request status." },
        { status: 400 }
      );
    }

    query = query.eq("status", status);
  }

  const { data: requests, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    requests: requests ?? [],
  });
}

export async function PATCH(request: NextRequest) {
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

  const requestId =
    typeof payload.requestId === "string"
      ? payload.requestId.trim()
      : "";

  const status =
    typeof payload.status === "string"
      ? payload.status.trim()
      : "";

  const adminNotes =
    typeof payload.adminNotes === "string"
      ? payload.adminNotes.trim()
      : null;

  const userId =
    typeof payload.userId === "string" && payload.userId.trim()
      ? payload.userId.trim()
      : null;

  const organizationId =
    typeof payload.organizationId === "string" &&
    payload.organizationId.trim()
      ? payload.organizationId.trim()
      : null;

  if (!requestId) {
    return NextResponse.json(
      { error: "Request ID is required." },
      { status: 400 }
    );
  }

  if (status && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "Invalid request status." },
      { status: 400 }
    );
  }

  if (!status && adminNotes === null && !userId && !organizationId) {
    return NextResponse.json(
      { error: "No request changes were provided." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (status) {
    updates.status = status;
  }

  if (payload.adminNotes !== undefined) {
    updates.admin_notes = adminNotes;
  }

  if (payload.userId !== undefined) {
    updates.user_id = userId;
  }

  if (payload.organizationId !== undefined) {
    updates.organization_id = organizationId;
  }

  if (status === "provisioned") {
    updates.provisioned_at = new Date().toISOString();
    updates.provisioned_by = authorization.user.id;
  }

  if (status && status !== "provisioned") {
    updates.provisioned_at = null;
    updates.provisioned_by = null;
  }

  const { data: updatedRequest, error } = await supabaseServer
    .from("gym_dashboard_requests")
    .update(updates)
    .eq("id", requestId)
    .select(`
      id,
      request_type,
      status,
      gym_name,
      gym_location,
      requester_name,
      requester_email,
      requester_role,
      is_multi_location,
      team_list_text,
      user_id,
      organization_id,
      admin_notes,
      provisioned_by,
      provisioned_at,
      created_at,
      updated_at
    `)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (!updatedRequest) {
    return NextResponse.json(
      { error: "Trial request was not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    request: updatedRequest,
  });
}