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

  const query =
    request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const programId =
    request.nextUrl.searchParams.get("programId")?.trim() ?? "";

  if (!programId) {
    return NextResponse.json(
      { error: "Program ID is required." },
      { status: 400 }
    );
  }

  /*
    Step 1:
    Load candidate teams belonging to the selected ECS program.
  */
  let teamQuery = supabaseServer
    .from("teams")
    .select("id, program_id, name, match_key")
    .eq("program_id", programId)
    .order("name")
    .limit(100);

  if (query.length >= 1) {
    teamQuery = teamQuery.ilike(
      "name",
      `%${query}%`
    );
  }

  const { data: candidateTeams, error: teamError } =
    await teamQuery;

  if (teamError) {
    return NextResponse.json(
      { error: teamError.message },
      { status: 500 }
    );
  }

  if (!candidateTeams || candidateTeams.length === 0) {
    return NextResponse.json({
      teams: [],
    });
  }

  /*
    Step 2:
    Determine which candidate teams actually have competition
    results in the live results_rebuild table.

    Historical orphan team records with zero results are excluded.
  */
  const candidateTeamIds = candidateTeams.map(
    (team) => team.id
  );

  const { data: resultTeams, error: resultError } =
    await supabaseServer
      .from("results_rebuild")
      .select("team_id")
      .in("team_id", candidateTeamIds);

  if (resultError) {
    return NextResponse.json(
      { error: resultError.message },
      { status: 500 }
    );
  }

  const activeTeamIds = new Set(
    (resultTeams ?? [])
      .map((row) => row.team_id)
      .filter(
        (teamId): teamId is string =>
          typeof teamId === "string"
      )
  );

  /*
    Step 3:
    Return only teams that actually have live result data.
  */
  const teams = candidateTeams.filter((team) =>
    activeTeamIds.has(team.id)
  );

  return NextResponse.json({
    teams,
  });
}