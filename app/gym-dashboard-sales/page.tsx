import Image from "next/image";
import Link from "next/link";

const modules = [
  {
    eyebrow: "Gym Overview",
    title: "Know what happened across your entire program.",
    description:
      "Get an instant weekly recap of your teams, including top scores, biggest movers, recent competitions, division leaders, and performance trends.",
    highlights: [
      "Weekly gym recap",
      "Top scoring teams",
      "Biggest risers and fallers",
      "Division performance",
    ],
    image: "/GymOverview2.png",
  },
  {
    eyebrow: "Team Intelligence",
    title: "See the story behind every team.",
    description:
      "Move beyond a single score. Track each team's season, performance ceiling, event history, national standing, consistency, and progress over time.",
    highlights: [
      "Season performance",
      "Score trends",
      "National percentile",
      "Competition history",
    ],
    image: "/TeamIntelligence.png",
  },
  {
    eyebrow: "Division Intelligence",
    title: "Understand where your teams really stand.",
    description:
      "See your teams in the context of their divisions and compare performance against the national field instead of evaluating scores in isolation.",
    highlights: [
      "Division leaders",
      "National context",
      "Competitive positioning",
      "Performance gaps",
    ],
    image: "/Division_Intelligence2.png",
  },
  {
    eyebrow: "Competition Intelligence",
    title: "Know the field before you compete.",
    description:
      "Build a competition field, scout opponents, compare strengths, and generate a complete competition intelligence report before event day.",
    highlights: [
      "Opponent scouting",
      "Field analysis",
      "Focused team comparisons",
      "Saved competition reports",
    ],
    image: "/CompIntelligence2.png",
  },
];

export default function GymDashboardSalesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(6,182,212,0.12),transparent_38%),radial-gradient(circle_at_right,rgba(147,51,234,0.16),transparent_38%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          {/* LOGO */}
          <div className="flex items-center justify-center">
            <Image
              src="/ecs-gym-dashboard-logo.png"
              alt="ECS Gym Dashboard"
              width={900}
              height={900}
              priority
              className="h-auto w-full max-w-[650px] object-contain"
            />
          </div>

          {/* HERO COPY */}
          <div className="text-center lg:text-left">
            <div className="text-sm font-bold uppercase tracking-[0.22em] text-blue-400">
              Elite Cheer Stats
            </div>

            <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">
              Your Gym.
              <br />
              Your Teams.
              <br />
              <span className="text-purple-400">Your Data.</span>
            </h1>

            <p className="mt-7 text-lg leading-8 text-slate-300 sm:text-xl">
              ECS Gym Dashboard turns competition results into actionable
              intelligence for gym owners, directors, and coaches — across
              every team in your program.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row lg:justify-start">
              <Link
                href="/gym-dashboard/trial"
                className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-7 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-purple-500"
              >
                Start Your Free 7-Day Trial
              </Link>

              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-7 py-4 text-lg font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Explore the Dashboard
              </a>
            </div>

            <p className="mt-4 text-sm text-slate-400">
              No credit card required. Your trial begins when your dashboard
              is ready.
            </p>
          </div>
        </div>
      </section>

      {/* POSITIONING */}
      <section className="bg-white text-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-purple-600">
              More Than Scores
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Stop digging through results.
              <br />
              Start understanding them.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Competition results tell you what happened. Gym Dashboard helps
              you understand what it means — across your teams, divisions,
              season, and upcoming competition fields.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <ValueCard
              value="One View"
              title="Your entire gym"
              text="Move from team-by-team score checking to a program-level view of performance."
            />

            <ValueCard
              value="National Context"
              title="Know where you stand"
              text="Put team performance into context with division-level analytics and national comparisons."
            />

            <ValueCard
              value="Competition Ready"
              title="Scout before event day"
              text="Build competition fields and understand the teams your athletes will actually face."
            />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="border-y border-slate-800 bg-slate-950"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400">
              Four Intelligence Modules
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Built for the decisions gym leaders actually make.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-400">
              From the big-picture health of your program to the teams standing
              across the mat from you next weekend.
            </p>
          </div>

          <div className="mt-12 space-y-6">
            {modules.map((module) => (
              <section
                key={module.eyebrow}
                className="grid overflow-visible rounded-3xl border border-slate-800 bg-slate-900 lg:grid-cols-[1fr_0.9fr]"
              >
                <div className="p-7 sm:p-10">
                  <div className="text-sm font-bold uppercase tracking-[0.18em] text-purple-400">
                    {module.eyebrow}
                  </div>

                  <h3 className="mt-3 max-w-xl text-2xl font-black sm:text-3xl">
                    {module.title}
                  </h3>

                  <p className="mt-5 max-w-xl leading-7 text-slate-400">
                    {module.description}
                  </p>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {module.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-200"
                      >
                        ✓ {highlight}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center border-t border-slate-800 bg-slate-950/50 p-3 lg:border-l lg:border-t-0">
  <div className="relative z-10 w-full transition-transform duration-300 ease-out hover:z-50 hover:scale-125">
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl hover:shadow-2xl">
      <Image
        src={module.image}
        alt={`${module.eyebrow} Screenshot`}
        width={1600}
        height={900}
        className="h-auto w-full object-contain"
      />
    </div>
  </div>
</div>
              </section>
            ))}
          </div>
        </div>
      </section>

      {/* COMPETITION INTELLIGENCE */}
      <section className="bg-white text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-purple-600">
              Competition Intelligence
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Who are you competing against this weekend?
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Build the field before you arrive. Compare your team to the
              competition using season performance, ceiling, consistency,
              national positioning, and other competitive indicators.
            </p>

            <p className="mt-5 text-base leading-7 text-slate-600">
              Save the field as a Competition Intelligence report and return
              to it throughout the week.
            </p>

            <Link
              href="/gym-dashboard/trial"
              className="mt-8 inline-flex rounded-xl bg-slate-950 px-6 py-3.5 font-bold text-white transition hover:bg-slate-800"
            >
              Try Competition Intelligence
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
  <Image
    src="/CompIntelligence_3.png"
    alt="Competition Intelligence Dashboard"
    width={1600}
    height={900}
    className="h-auto w-full rounded-2xl border border-slate-200 shadow-lg"
    priority
  />
</div>
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="border-y border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400">
              Competitive Intelligence
            </div>

            <h2 className="mt-4 text-3xl font-black">
              Give decision-makers the full picture.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-400">
              Explore the same competitive data used across Elite Cheer Stats
              through a dashboard built to turn results into actionable
              insights.
            </p>
          </div>
        </div>
      </section>

      {/* TRIAL CTA */}
      <section className="bg-white text-slate-950">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-slate-950 px-7 py-12 text-center text-white shadow-xl sm:px-12">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-purple-400">
              See Your Own Data
            </div>

            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
              Put your gym inside the dashboard.
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Start a free 7-day trial and we&apos;ll build your Gym Dashboard
              using your gym&apos;s competition data.
            </p>

            <Link
              href="/gym-dashboard/trial"
              className="mt-8 inline-flex rounded-xl bg-purple-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-purple-500"
            >
              Start Your Free 7-Day Trial
            </Link>

            <p className="mt-4 text-sm text-slate-400">
              No credit card required. We&apos;ll notify you as soon as your
              dashboard is ready.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-10 text-center text-sm text-slate-500 lg:px-8">
          Elite Cheer Stats — Gym Dashboard
        </div>
      </section>
    </main>
  );
}

function ValueCard({
  value,
  title,
  text,
}: {
  value: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-purple-600">
        {value}
      </div>

      <h3 className="mt-2 text-xl font-bold text-slate-950">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {text}
      </p>
    </div>
  );
}