export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-400">
            About
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            About Elite Cheer Stats
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            <span className="font-semibold text-white">
              Elite Cheer Stats is a competitive cheer analytics platform built
              for All-Star cheerleading.
            </span>{" "}
            We provide data-driven insights that help parents, athletes, and
            coaches understand how teams perform, compare competitors, and track
            results across the season.
          </p>

          <p className="mt-4 text-lg leading-8 text-slate-300">
            From rankings to team comparisons, Elite Cheer Stats turns
            competition results into clear, actionable analytics.
          </p>
        </div>

        <div className="mt-12 space-y-10">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              What you can do with Elite Cheer Stats
            </h2>

            <p className="mt-4 text-slate-300">
              With Elite Cheer Stats, you can:
            </p>

            <ul className="mt-4 space-y-3 text-slate-300">
              <li>• Compare teams head-to-head across scores, ceiling, and consistency</li>
              <li>• Track division rankings and top-performing programs</li>
              <li>• Analyze performance trends across competitions</li>
              <li>
                • Build custom matchups with Comp Builder to see how teams stack
                up before they compete
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Why Elite Cheer Stats exists
            </h2>

            <p className="mt-4 text-slate-300">
              Competitive cheer is one of the most data-rich — and least
              transparent — sports.
            </p>

            <p className="mt-4 text-slate-300">
              Scores, rankings, and results are scattered across events, making
              it difficult to understand:
            </p>

            <ul className="mt-4 space-y-3 text-slate-300">
              <li>• How strong a team really is</li>
              <li>• Who the top competitors are</li>
              <li>• What it takes to win at major competitions like NCA or The Summit</li>
            </ul>

            <p className="mt-4 text-slate-300">
              Elite Cheer Stats brings that data together into one place —
              making the sport more transparent, measurable, and understandable.
            </p>
          </section>

          <section className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              What makes Elite Cheer Stats different
            </h2>

            <p className="mt-4 text-slate-300">
              <span className="font-semibold text-white">
                Elite Cheer Stats goes beyond traditional rankings.
              </span>
            </p>

            <p className="mt-4 text-slate-300">
              Most platforms only show final scores. Elite Cheer Stats
              introduces deeper performance insights, including:
            </p>

            <ul className="mt-4 space-y-3 text-slate-300">
              <li>
                • <span className="font-semibold text-white">Ceiling Score</span>{" "}
                — a team’s highest scoring potential
              </li>
              <li>
                • <span className="font-semibold text-white">Consistency (Hit Zero Rate)</span>{" "}
                — how often a team performs without deductions
              </li>
            </ul>

            <p className="mt-4 text-slate-300">
              These metrics help answer the questions that matter most:
            </p>

            <ul className="mt-4 space-y-3 text-slate-300">
              <li>• Can this team keep up with the top of the division?</li>
              <li>• How consistent are they across the season?</li>
              <li>• Which teams have the highest potential when they hit?</li>
            </ul>

            <p className="mt-4 text-slate-300">
              Elite Cheer Stats is designed to surface insights you won’t find
              anywhere else in the sport.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Who it’s for
            </h2>

            <p className="mt-4 text-slate-300">
              Elite Cheer Stats is built for the cheer community:
            </p>

            <ul className="mt-4 space-y-3 text-slate-300">
              <li>
                • Parents who want to understand how their athlete’s team
                compares
              </li>
              <li>
                • Athletes who want to track progress and competition
                performance
              </li>
              <li>
                • Coaches and gym owners looking for deeper insights into
                divisions and competitors
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Our approach
            </h2>

            <p className="mt-4 text-slate-300">
              Elite Cheer Stats is built to make competitive cheer more
              measurable, more transparent, and easier to understand.
            </p>

            <p className="mt-4 text-slate-300">
              We do not replace the sport’s emotion, pressure, or excitement —
              we give the cheer community better tools to see the full picture.
            </p>

            <p className="mt-6 text-xl font-semibold text-white">
              Compare cheer teams before they compete.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              What’s next
            </h2>

            <p className="mt-4 text-slate-300">
              Elite Cheer Stats is continuously evolving, with new data,
              features, and tools being added throughout the season.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}