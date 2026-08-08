import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TrialRequestBody = {
  gymName?: string;
  gymLocation?: string;
  requesterName?: string;
  requesterRole?: string;
  isMultiLocation?: boolean;
  teamListText?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );

      return NextResponse.json(
        { error: "Trial request service is not configured." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Authenticate the ECS user from the Bearer token.
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be logged in to start a trial." },
        { status: 401 }
      );
    }

    const accessToken = authorization
      .slice("Bearer ".length)
      .trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "You must be logged in to start a trial." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user?.id || !user.email) {
      return NextResponse.json(
        { error: "Your ECS session is invalid or expired. Please log in again." },
        { status: 401 }
      );
    }

    const requesterEmail = user.email.trim().toLowerCase();
    const userId = user.id;

    const body = (await request.json()) as TrialRequestBody;

    const gymName = cleanText(body.gymName);
    const gymLocation = cleanText(body.gymLocation);
    const requesterName = cleanText(body.requesterName);
    const requesterRole = cleanText(body.requesterRole);
    const isMultiLocation = body.isMultiLocation === true;
    const teamListText = cleanText(body.teamListText);

    if (
      !gymName ||
      !gymLocation ||
      !requesterName ||
      !requesterRole
    ) {
      return NextResponse.json(
        {
          error:
            "Gym name, location, your name, and role are required.",
        },
        { status: 400 }
      );
    }

    if (isMultiLocation && !teamListText) {
      return NextResponse.json(
        {
          error:
            "Please list the teams belonging to your location.",
        },
        { status: 400 }
      );
    }

    // Prevent repeated pending requests for the same ECS user and gym.
    const { data: existingRequest, error: existingError } =
      await supabaseAdmin
        .from("gym_dashboard_requests")
        .select("id, status")
        .eq("request_type", "trial")
        .eq("requester_email", requesterEmail)
        .ilike("gym_name", gymName)
        .in("status", [
          "pending",
          "awaiting_information",
          "ready_to_provision",
        ])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingError) {
      console.error(
        "Unable to check existing trial requests:",
        existingError
      );

      return NextResponse.json(
        { error: "Unable to submit the trial request." },
        { status: 500 }
      );
    }

    if (existingRequest) {
      return NextResponse.json(
        {
          error:
            "A trial request for this account and gym is already being reviewed.",
          requestId: existingRequest.id,
          status: existingRequest.status,
        },
        { status: 409 }
      );
    }

    const { data: createdRequest, error: insertError } =
      await supabaseAdmin
        .from("gym_dashboard_requests")
        .insert({
          request_type: "trial",
          status: "pending",

          gym_name: gymName,
          gym_location: gymLocation,

          requester_name: requesterName,
          requester_email: requesterEmail,
          requester_role: requesterRole,

          user_id: userId,

          is_multi_location: isMultiLocation,
          team_list_text: isMultiLocation
            ? teamListText
            : null,
        })
        .select("id, status, created_at")
        .single();

    if (insertError) {
      console.error(
        "Unable to create Gym Dashboard trial request:",
        insertError
      );

      return NextResponse.json(
        { error: "Unable to submit the trial request." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        request: createdRequest,
        message:
          "Your trial request has been received. Your seven-day trial will begin after your dashboard is provisioned.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Trial request endpoint failed:", error);

    return NextResponse.json(
      { error: "Unable to submit the trial request." },
      { status: 500 }
    );
  }
}