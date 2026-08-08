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

  const organizationId =
    typeof payload.organizationId === "string"
      ? payload.organizationId.trim()
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

  if (
    !requestId ||
    !organizationId ||
    !programId ||
    !ALLOWED_ROLES.has(role) ||
    trialDays < 1 ||
    trialDays > 30
  ) {
    return NextResponse.json(
      { error: "Invalid provisioning request." },
      { status: 400 }
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
      { error: "Organization was not found." },
      { status: 404 }
    );
  }

  const { data: program, error: programError } =
    await supabaseServer
      .from("programs")
      .select("id, name")
      .eq("id", programId)
      .maybeSingle();

  if (programError) {
    return NextResponse.json(
      { error: programError.message },
      { status: 500 }
    );
  }

  if (!program) {
    return NextResponse.json(
      { error: "Program was not found." },
      { status: 404 }
    );
  }

  const { error: mappingError } = await supabaseServer
    .from("organization_programs")
    .upsert(
      {
        organization_id: organizationId,
        program_id: programId,
      },
      {
        onConflict: "organization_id,program_id",
      }
    );

  if (mappingError) {
    console.error(
      "Unable to map organization to program:",
      mappingError
    );

    return NextResponse.json(
      { error: mappingError.message },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseServer.rpc(
    "provision_gym_dashboard_trial",
    {
      p_request_id: requestId,
      p_organization_id: organizationId,
      p_provisioned_by: authorization.user.id,
      p_role: role,
      p_trial_days: trialDays,
    }
  );

  if (error) {
    console.error("Gym Dashboard provisioning failed:", error);

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
    organization: {
      id: organization.id,
      name: organization.name,
    },
    program: {
      id: program.id,
      name: program.name,
    },
    message:
      "The Gym Dashboard trial was provisioned successfully.",
  });
}