import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Elite Cheer Stats | Cheerleading Analytics, Rankings & Team Comparison",
  description:
    "Elite Cheer Stats is a competitive cheerleading analytics platform. Compare teams, track hit zero rates, analyze ceiling scores, and follow rankings and scoring trends.",
  alternates: {
    canonical: "https://elitecheerstats.com",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Elite Cheer Stats | Cheerleading Analytics",
    description:
      "Compare teams, track hit zero rates, analyze ceiling scores, and follow rankings and scoring trends.",
    url: "https://elitecheerstats.com",
    siteName: "Elite Cheer Stats",
    type: "website",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Elite Cheer Stats",
  url: "https://elitecheerstats.com",
};

export default function HomePage() {
  return (
    <>
      <Script
        id="ecs-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <main className="min-h-screen bg-[#0b1020] text-white">
        {/* HERO */}
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">
                Competitive Cheerleading Analytics
              </p>

              <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
                Elite Cheer Stats
              </h1>

              <p className="mt-6 text-lg leading-8 text-white/85 md:text-xl">
                <strong>Elite Cheer Stats (elitecheerstats.com)</strong> is a
                competitive cheerleading analytics platform built for the
                competitive cheer community. Compare teams, track{" "}
                <strong>Hit Zero Rate</strong>, analyze{" "}
                <strong>Ceiling Score</strong>, and follow rankings and scoring
                trends across the season.
              </p>

              <p className="mt-4 text-lg font-medium text-white/90">
                Stop guessing who will win. See the data behind every team.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
  {/* PRIMARY */}
  <Link
    href="/compare"
    className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-center font-semibold text-white/90 transition hover:bg-white/10"
  >
    Compare Teams
  </Link>

  {/* SECONDARY */}
  <Link
    href="/team"
    className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-center font-semibold text-white/90 transition hover:bg-white/10"
  >
    Search a Team
  </Link>

  {/* SECONDARY (MATCHED) */}
  <Link
    href="/rankings"
    className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-center font-semibold text-white/90 transition hover:bg-white/10"
  >
    Rankings
  </Link>

  {/* ACCENT (LEAVE AS-IS FEEL) */}
  <Link
    href="/comp-builder"
    className="rounded-xl border border-teal-400/30 bg-teal-400/10 px-6 py-3 text-center font-semibold text-teal-300 transition hover:bg-teal-400/20"
  >
    Comp Builder
  </Link>
</div>

              <p className="mt-4 text-sm text-white/50">
                Real competition data. Real performance insight.
              </p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card
              title="Team Comparison Tool"
              description="Compare any two teams head-to-head and see how they stack up in consistency, ceiling, and scoring trends."
            />
            <Card
              title="Hit Zero Rate"
              description="Measure how often a team performs clean and track consistency across the season."
            />
            <Card
              title="Ceiling Score"
              description="Understand a team’s true scoring potential based on execution and performance trends."
            />
            <Card
              title="Rankings & Trends"
              description="Follow rankings, averages, and momentum to see who is trending up before major events."
            />
          </div>
        </section>

        {/* ABOUT */}
        <section className="border-y border-white/10 bg-white/5">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h2 className="text-2xl font-bold md:text-3xl">
                  What is Elite Cheer Stats?
                </h2>
                <p className="mt-4 text-white/80 leading-7">
                  Elite Cheer Stats provides a clearer way to understand
                  competitive cheerleading performance. Instead of relying only
                  on placements, it highlights consistency, scoring potential,
                  and performance trends across competitions.
                </p>
                <p className="mt-4 text-white/80 leading-7">
                  Whether you are preparing for a major event or comparing teams
                  across a division, Elite Cheer Stats gives you the data behind
                  the results.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold md:text-3xl">
                  Built for the competitive cheer community
                </h2>
                <ul className="mt-4 space-y-3 text-white/80">
                  <li>Compare teams across divisions and events</li>
                  <li>Track consistency with Hit Zero Rate</li>
                  <li>Evaluate scoring potential with Ceiling Score</li>
                  <li>Follow rankings and performance trends</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* VALUE */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-white/10 bg-[#11182d] p-8 md:p-10">
            <h2 className="text-2xl font-bold md:text-3xl">
              Why Elite Cheer Stats
            </h2>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <Card
                title="See beyond placement"
                description="Understand how teams are actually performing, not just where they finished."
              />
              <Card
                title="Measure consistency"
                description="Track how reliably teams hit and perform under pressure."
              />
              <Card
                title="Understand upside"
                description="Identify which teams have the scoring potential to win if they hit."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-2xl bg-teal-400 px-8 py-10 text-black">
            <h2 className="text-2xl font-extrabold md:text-3xl">
              Start with your team
            </h2>

            <p className="mt-3 max-w-2xl text-black/80">
              Search your team, compare matchups, and explore the performance
              metrics that matter before your next competition.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/team"
                className="rounded-xl bg-black px-6 py-3 text-center font-semibold text-white"
              >
                Search Teams
              </Link>

              <Link
                href="/compare"
                className="rounded-xl border border-black/20 px-6 py-3 text-center font-semibold"
              >
                Compare Teams
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Card({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-3 text-sm text-white/75 leading-6">{description}</p>
    </div>
  );
}