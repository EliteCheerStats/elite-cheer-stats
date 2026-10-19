"use client";



import { useEffect, useState } from "react";

import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";



export default function HomePage() {

  const [loading, setLoading] = useState(true);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [isPremium, setIsPremium] = useState(false);



  const [followedTeams, setFollowedTeams] = useState<

    {

      team_id: string;

      team_name: string | null;

      program_name: string | null;

      last_score?: number | null;

    }[]

  >([]);



  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(false);

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");

  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);



  useEffect(() => {

    let mounted = true;



    async function load() {

      setLoading(true);



      const {

        data: { session },

      } = await supabase.auth.getSession();



      if (!mounted) return;



      if (!session?.user) {

        setSessionEmail(null);

        setIsPremium(false);

        setFollowedTeams([]);

        setLoading(false);

        return;

      }



      setSessionEmail(session.user.email ?? null);



      const { data: followed } = await supabase

        .from("v_user_followed_teams")

        .select("team_id, team_name, program_name, created_at")

        .eq("user_id", session.user.id)

        .order("created_at", { ascending: false })

        .limit(3);



      if (followed && followed.length > 0) {

        const { data: scores } = await supabase

          .from("v_team_event_scores")

          .select("team_id, event_score, weekend_date")

          .in(

            "team_id",

            followed.map((t) => t.team_id)

          );



        const latestScores = new Map<string, any>();



        for (const row of scores ?? []) {

          const existing = latestScores.get(row.team_id);



          if (

            !existing ||

            row.weekend_date > existing.weekend_date

          ) {

            latestScores.set(row.team_id, row);

          }

        }



        setFollowedTeams(

          followed.map((t) => ({

            ...t,

            last_score:

              latestScores.get(t.team_id)?.event_score ?? null,

          }))

        );

      } else {

        setFollowedTeams([]);

      }



      const { data } = await supabase

        .from("profiles")

        .select("is_premium")

        .eq("id", session.user.id)

        .maybeSingle();



      if (!mounted) return;



      setIsPremium(!!data?.is_premium);

      setLoading(false);

    }



    load();



    const { data: listener } =

      supabase.auth.onAuthStateChange(() => {

        load();

      });



    return () => {

      mounted = false;

      listener.subscription.unsubscribe();

    };

  }, []);



  async function handleLogout() {

    await supabase.auth.signOut();

    window.location.reload();

  }



  async function handleAuthSubmit(e: React.FormEvent) {

    e.preventDefault();



    setAuthLoading(true);

    setAuthError(null);

    setAuthMessage(null);



    try {

      const cleanEmail = email.trim().toLowerCase();

      const cleanPassword = password;



      if (!cleanEmail || !cleanPassword) {

        setAuthError("Please enter both email and password.");

        setAuthLoading(false);

        return;

      }



      if (authMode === "signup") {

        const {

          data: existingProfile,

          error: profileError,

        } = await supabase

          .from("profiles")

          .select("id")

          .eq("email", cleanEmail)

          .maybeSingle();



        if (profileError) {

          setAuthError(

            "Could not verify account status. Please try again."

          );

          setAuthLoading(false);

          return;

        }



        if (existingProfile) {

          setAuthError(

            "An account with this email already exists. Please log in."

          );

          setAuthMode("login");

          setAuthLoading(false);

          return;

        }



        const { data, error } = await supabase.auth.signUp({

          email: cleanEmail,

          password: cleanPassword,

        });



        if (error) {

          setAuthError(error.message);

          setAuthLoading(false);

          return;

        }



        if (data.session?.user) {

          window.location.reload();

          return;

        }



        setAuthMessage("Account created. Please log in.");

        setAuthMode("login");

        setAuthLoading(false);

        return;

      }



      const { error } =

        await supabase.auth.signInWithPassword({

          email: cleanEmail,

          password: cleanPassword,

        });



      if (error) {

        setAuthError("Invalid email or password.");

        setAuthLoading(false);

        return;

      }



      window.location.reload();

    } catch {

      setAuthError(

        "Something went wrong. Please try again."

      );

      setAuthLoading(false);

    }

  }



  return (

    <main className="min-h-screen bg-[#020b2d] text-white">

      <section className="mx-auto max-w-6xl px-6 py-10">

        <div className="mb-10">

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white">

            Competitive Cheerleading Analytics

          </p>



          <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">

            Elite Cheer Stats

          </h1>



          <p className="mt-6 max-w-3xl text-lg text-white/85">

            National cheer rankings, team comparisons, and competition analytics.

            All in one place.

          </p>



          {!loading && sessionEmail && (

            <div className="mt-7 flex flex-wrap items-center gap-3">

              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm">

                {sessionEmail}

              </span>



              <span

                className={`rounded-full px-3 py-1 text-sm font-semibold ${

                  isPremium

                    ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"

                    : "border border-amber-400/30 bg-amber-500/10 text-amber-300"

                }`}

              >

                {isPremium ? "Premium" : "Free"}

              </span>



              <button

                onClick={handleLogout}

                className="rounded-md border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5"

              >

                Log out

              </button>

            </div>

          )}

        </div>



        {!loading &&

          sessionEmail &&

          followedTeams.length > 0 && (

            <div className="mb-8 rounded-2xl border border-[#14b8a6]/25 bg-gradient-to-br from-[#0b1f4f] via-[#08204a] to-[#05163a] p-6 shadow-[0_0_0_1px_rgba(20,184,166,0.06)]">

              <h2 className="text-2xl font-bold text-white">

                Your Teams

              </h2>



              <p className="mt-1 text-sm text-teal-100/80">

                Your teams (up to 3). Updated weekly.

              </p>



              <div className="mt-4 grid gap-4 md:grid-cols-3">

                {followedTeams.map((team) => (

                  <div

                    key={team.team_id}

                    className="rounded-xl border border-white/10 bg-[#07122f]/80 p-4"

                  >

                    <div className="text-lg font-semibold text-white">

                      {team.team_name}

                    </div>



                    {team.program_name && (

                      <div className="text-sm text-white/70">

                        {team.program_name}

                      </div>

                    )}



                    {team.last_score != null && (

                      <div className="mt-2 text-sm font-semibold text-teal-300">

                        Last score:{" "}

                        {Number(

                          team.last_score

                        ).toFixed(1)}

                      </div>

                    )}



                    <Link

                      href={`/team/${team.team_id}`}

                      className="mt-3 inline-block rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10"

                    >

                      View Team →

                    </Link>

                  </div>

                ))}

              </div>

            </div>

          )}



        {/* ECS Premium promotional section — replaces Gym Dashboard marketing only */}
        <section className="relative mb-8 overflow-hidden rounded-2xl border border-[#18e6dc] bg-[#031329] p-6 shadow-[0_0_28px_rgba(24,230,220,0.12)] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-[56%] bg-cover bg-center opacity-40 [mask-image:linear-gradient(to_right,transparent,black_38%)]"
            style={{ backgroundImage: 'url("/images/ecs-premium-cheer.jpg")' }}
          />
          <div className="relative z-10">
            <div className="max-w-[370px]">
              <img
                src="/images/ecs-logo.jpg"
                alt="Elite Cheer Stats"
                className="h-auto w-full max-w-[310px] rounded-md"
              />
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#49eee4]">
              ECS Premium
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              You know your score.
              <span className="mt-1 block text-[#32e6df]">Now know your competition.</span>
            </h2>
            <p className="mt-5 max-w-2xl border-t border-white/25 pt-4 text-lg text-white/90 sm:text-xl">
              Don&apos;t Wonder. Stop Digging. <strong className="text-[#39efe3]">KNOW.</strong>
            </p>

            {!loading && isPremium ? (
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/compare" className="rounded-xl bg-[#21dfd4] px-6 py-3 font-bold text-[#031329] transition hover:bg-[#6df7ed]">
                  Explore Premium Features →
                </Link>
                <Link href="/account" className="rounded-xl border border-white/35 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
                  My Account
                </Link>
              </div>
            ) : (
              <div className="mt-7 grid max-w-3xl gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/30 bg-[#081a3c]/90 p-5 text-center">
                  <p className="font-bold text-white">Monthly</p>
                  <p className="mt-1 text-4xl font-extrabold text-white">$14.99</p>
                  <p className="text-sm text-white/70">per month</p>
                  <Link href="/upgrade" className="mt-4 block rounded-lg border border-white/40 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                    Go Premium Monthly →
                  </Link>
                </div>
                <div className="relative rounded-xl border border-[#23e6da] bg-[#073b47]/95 p-5 text-center">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#28e8df] px-4 py-1 text-xs font-extrabold text-[#032033]">
                    BEST VALUE · SAVE 44%
                  </span>
                  <p className="font-bold text-white">Annual</p>
                  <p className="mt-1 text-4xl font-extrabold text-white">$99.99</p>
                  <p className="text-sm text-white/70">per year</p>
                  <Link href="/upgrade" className="mt-4 block rounded-lg bg-[#28e8df] px-4 py-3 text-sm font-extrabold text-[#032033] transition hover:bg-[#78fff4]">
                    Go Premium Annual →
                  </Link>
                </div>
              </div>
            )}
            <nav aria-label="Explore ECS features" className="mt-7 grid grid-cols-2 gap-3 border-t border-[#1b777d]/60 pt-5 text-sm font-semibold sm:grid-cols-4">
              <Link href="/rankings" className="rounded-lg px-2 py-3 text-center text-white/90 transition hover:bg-[#0d3b4d] hover:text-[#39efe3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#39efe3]">
                ↗ Deeper Rankings
              </Link>
              <Link href="/compare" className="rounded-lg px-2 py-3 text-center text-white/90 transition hover:bg-[#0d3b4d] hover:text-[#39efe3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#39efe3]">
                ♧ Compare Teams
              </Link>
              <Link href="/comp-builder" className="rounded-lg px-2 py-3 text-center text-white/90 transition hover:bg-[#0d3b4d] hover:text-[#39efe3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#39efe3]">
                ▦ Build Competitions
              </Link>
              <Link href="/team" className="rounded-lg px-2 py-3 text-center text-white/90 transition hover:bg-[#0d3b4d] hover:text-[#39efe3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#39efe3]">
                ♡ Follow Teams
              </Link>
            </nav>
          </div>
        </section>

        {!loading && !sessionEmail && (

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#03123b] p-6">

            <h2 className="text-2xl font-bold">

              {authMode === "signup"

                ? "Create your free account"

                : "Log in"}

            </h2>



            <p className="mt-2 text-white/75">

              {authMode === "signup"

                ? "Create an account to unlock Premium analytics and save your access."

                : "Log in to access your account and Premium features."}

            </p>



            <form

              onSubmit={handleAuthSubmit}

              className="mt-6 space-y-4"

            >

              <div>

                <label className="mb-2 block text-sm text-white/80">

                  Email

                </label>



                <input

                  type="email"

                  value={email}

                  onChange={(e) =>

                    setEmail(e.target.value)

                  }

                  className="w-full rounded-md border border-white/15 bg-[#0b1a3a] px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#18d3c5] focus:ring-1 focus:ring-[#18d3c5]/40"

                  placeholder="you@example.com"

                  autoComplete="email"

                />

              </div>



              <div>

                <label className="mb-2 block text-sm text-white/80">

                  Password

                </label>



                <input

                  type="password"

                  value={password}

                  onChange={(e) =>

                    setPassword(e.target.value)

                  }

                  className="w-full rounded-md border border-white/15 bg-[#0b1a3a] px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#18d3c5] focus:ring-1 focus:ring-[#18d3c5]/40"

                  placeholder="Enter password"

                  autoComplete={

                    authMode === "signup"

                      ? "new-password"

                      : "current-password"

                  }

                />

              </div>



              {authError && (

                <p className="text-sm text-red-400">

                  {authError}

                </p>

              )}



              {authMessage && (

                <p className="text-sm text-emerald-400">

                  {authMessage}

                </p>

              )}



              <button

                type="submit"

                disabled={authLoading}

                className="w-full rounded-md bg-[#18d3c5] px-4 py-3 font-semibold text-[#06253b] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"

              >

                {authLoading

                  ? authMode === "signup"

                    ? "Creating Account..."

                    : "Logging In..."

                  : authMode === "signup"

                    ? "Create Account"

                    : "Log In"}

              </button>

            </form>



            <div className="mt-4 text-sm text-white/65">

              {authMode === "signup" ? (

                <>

                  Already have an account?{" "}

                  <button

                    type="button"

                    onClick={() => {

                      setAuthMode("login");

                      setAuthError(null);

                      setAuthMessage(null);

                    }}

                    className="font-semibold text-[#41f4e1] hover:underline"

                  >

                    Log in

                  </button>

                </>

              ) : (

                <>

                  Need an account?{" "}

                  <button

                    type="button"

                    onClick={() => {

                      setAuthMode("signup");

                      setAuthError(null);

                      setAuthMessage(null);

                    }}

                    className="font-semibold text-[#41f4e1] hover:underline"

                  >

                    Create one

                  </button>

                </>

              )}

            </div>

          </div>

        )}

      </section>

    </main>

  );

}



function FeatureCard({

  title,

  desc,

}: {

  title: string;

  desc: string;

}) {

  return (

    <div className="rounded-2xl border border-white/10 bg-[#021033] p-6">

      <h3 className="text-2xl font-bold">{title}</h3>

      <p className="mt-4 text-lg text-white/85">{desc}</p>

    </div>

  );

}
