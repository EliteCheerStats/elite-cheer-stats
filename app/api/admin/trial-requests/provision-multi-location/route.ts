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

  const requestId =
    typeof payload.requestId === "string"
      ? payload.requestId.trim()
      : "";

  const organizationName =
    typeof payload.organizationName === "string"
      ? payload.organizationName.trim()
      : "";

  const programId =
    typeof payload.programId === "string"
      ? payload.programId.trim()
      : "";

  const role =
    typeof payload.role === "string"
      ? payload.role.trim().toLowerCase()
      : "owner";

  const trialDays =
    typeof payload.trialDays === "number"
      ? Math.trunc(payload.trialDays)
      : 7;

  const teamIds = Array.isArray(payload.teamIds)
    ? payload.teamIds.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    : [];

  if (
    !requestId ||
    !organizationName ||
    !programId ||
    teamIds.length === 0 ||
    !ALLOWED_ROLES.has(role) ||
    trialDays < 1 ||
    trialDays > 30
  ) {
    return NextResponse.json(
      { error: "Invalid multi-location provisioning request." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer.rpc(
    "provision_multi_location_gym_dashboard_trial",
    {
      p_request_id: requestId,
      p_organization_name: organizationName,
      p_program_id: programId,
      p_team_ids: teamIds,
      p_provisioned_by: authorization.user.id,
      p_role: role,
      p_trial_days: trialDays,
    }
  );

  if (error) {
    console.error(
      "Multi-location Gym Dashboard provisioning failed:",
      error
    );

    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    return NextResponse.json(
      {
        error:
          "Provisioning completed without returning a result.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    provisioning: result,
    message:
      "The multi-location Gym Dashboard trial was provisioned successfully.",
  });
}