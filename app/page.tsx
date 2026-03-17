import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">
          Elite Cheer Stats
        </h1>
<h1 className="text-3xl font-bold tracking-tight">
  All-Star Cheer Analytics Platform
</h1>
        <p className="text-slate-400 mb-10 text-lg">
          The most advanced cheer analytics platform ever built.
        </p>

        <div className="grid md:grid-cols-2 gap-6">

          <Link href="/rankings" className="p-6 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
            <h2 className="text-2xl font-semibold">Division Rankings</h2>
            <p className="text-slate-400 mt-2">
              See top-performing teams by division.
            </p>
          </Link>

          <Link href="/team" className="p-6 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
            <h2 className="text-2xl font-semibold">Team Search</h2>
            <p className="text-slate-400 mt-2">
              Track any team's scores, trends, and performance over time
            </p>
          </Link>

          <Link href="/compare" className="p-6 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
            <h2 className="text-2xl font-semibold">Team Comparison</h2>
            <p className="text-slate-400 mt-2">
              Compare teams head-to-head across scores, ceilings, and consistency
            </p>
          </Link>

          <Link href="/comp-builder" className="p-6 bg-teal-700 rounded-xl hover:bg-teal-600 transition">
            <h2 className="text-2xl font-semibold">Comp Builder</h2>
            <p className="mt-2">
              See how your team stacks up before they compete.
            </p>
          </Link>

        </div>
      </div>
    </main>
  );
}