import Link from "next/link";

type FollowedTeam = {
  team_id: string;
  team_name: string | null;
  program_name: string | null;
};

type YourTeamsSectionProps = {
  teams: FollowedTeam[];
};

export default function YourTeamsSection({
  teams,
}: YourTeamsSectionProps) {
  if (!teams.length) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-[#05113a] p-6 md:p-8">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">Your Teams</h2>
        <p className="mt-1 text-sm text-white/65">
          Quick access to the teams you follow.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <div
            key={team.team_id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="text-lg font-semibold text-white">
              {team.team_name || "Unknown Team"}
            </div>

            {team.program_name ? (
              <div className="mt-1 text-sm text-white/70">
                {team.program_name}
              </div>
            ) : null}

            <div className="mt-4">
              <Link
                href={`/team/${team.team_id}`}
                className="inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                View Team
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}