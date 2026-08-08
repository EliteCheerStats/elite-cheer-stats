"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function GymDashboardTrialPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);

  const [gymName, setGymName] = useState("");
  const [gymLocation, setGymLocation] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterRole, setRequesterRole] = useState("");
  const [isMultiLocation, setIsMultiLocation] =
    useState<boolean | null>(null);
  const [teamListText, setTeamListText] = useState("");

  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error || !session?.user) {
        router.replace(
          `/login?redirect=${encodeURIComponent(
            "/gym-dashboard/trial"
          )}`
        );
        return;
      }

      setRequesterEmail(session.user.email ?? "");
      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();

    router.push(
      `/login?redirect=${encodeURIComponent(
        "/gym-dashboard/trial"
      )}`
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setStatus("submitting");
    setMessage(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.user ||
        !session.access_token
      ) {
        router.replace(
          `/login?redirect=${encodeURIComponent(
            "/gym-dashboard/trial"
          )}`
        );
        return;
      }

      const response = await fetch(
        "/api/gym-dashboard/trial-request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            gymName,
            gymLocation,
            requesterName,
            requesterRole,
            isMultiLocation: isMultiLocation === true,
            teamListText,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to submit trial request."
        );
      }

      setStatus("success");
      setMessage(
        payload.message ||
          "Your trial request has been received. We’ll email you when your dashboard is ready."
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit trial request."
      );
    }
  }

  if (checkingSession) {
    return (
      <section className="grid min-h-[60vh] place-items-center rounded-3xl bg-slate-50 px-4 text-slate-950">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">
            Checking your ECS account...
          </div>

          <p className="mt-2 text-sm text-slate-500">
            An Elite Cheer Stats account is required to start a Gym
            Dashboard trial.
          </p>
        </div>
      </section>
    );
  }

  if (status === "success") {
    return (
      <section className="min-h-[60vh] bg-slate-50 px-4 py-12 text-slate-950">
        <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="text-sm font-bold uppercase tracking-wide text-emerald-700">
            Request received
          </div>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Thank you! We’ll let you know when your dashboard is
            ready.
          </h1>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            {message}
          </p>

          <p className="mt-4 text-sm leading-6 text-slate-500">
            Your seven-day trial will not begin until setup is
            complete.
          </p>

          <div className="mt-7">
            <Link
              href="/"
              className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Return to Elite Cheer Stats
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[60vh] bg-slate-50 px-4 py-12 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide text-purple-700">
            ECS Gym Dashboard
          </div>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
            Start Your Free 7-Day Trial
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Tell us about your gym. We’ll review the information,
            set up your dashboard, and email you as soon as it is
            ready.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Gym Name">
              <input
                required
                type="text"
                value={gymName}
                onChange={(event) =>
                  setGymName(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-purple-500 transition focus:ring-2"
                placeholder="Top Gun Savannah"
              />
            </Field>

            <Field label="Gym City / Location">
              <input
                required
                type="text"
                value={gymLocation}
                onChange={(event) =>
                  setGymLocation(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-purple-500 transition focus:ring-2"
                placeholder="Savannah, GA"
              />
            </Field>

            <Field label="Your Name">
              <input
                required
                type="text"
                value={requesterName}
                onChange={(event) =>
                  setRequesterName(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-purple-500 transition focus:ring-2"
                placeholder="Your name"
              />
            </Field>

            <Field label="ECS Account Email">
              <input
                required
                readOnly
                type="email"
                value={requesterEmail}
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 outline-none"
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Your trial will be connected to this Elite Cheer
                  Stats account.
                </p>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="text-xs font-bold text-purple-700 hover:text-purple-900"
                >
                  Wrong account? Sign out
                </button>
              </div>
            </Field>
          </div>

          <div className="mt-6">
            <Field label="Role">
              <select
                required
                value={requesterRole}
                onChange={(event) =>
                  setRequesterRole(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none ring-purple-500 transition focus:ring-2"
              >
                <option value="">Select your role</option>
                <option value="Owner">Owner</option>
                <option value="Director">Director</option>
                <option value="Coach">Coach</option>
                <option value="Parent">Parent</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-800">
              Is your gym part of a franchise or organization with
              multiple locations?
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Examples include Top Gun, Cheer Athletics, Stingray,
              or Rockstar.
            </p>

            <div className="mt-3 flex gap-6">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  required
                  type="radio"
                  name="multiLocation"
                  checked={isMultiLocation === true}
                  onChange={() =>
                    setIsMultiLocation(true)
                  }
                />
                Yes
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  required
                  type="radio"
                  name="multiLocation"
                  checked={isMultiLocation === false}
                  onChange={() => {
                    setIsMultiLocation(false);
                    setTeamListText("");
                  }}
                />
                No
              </label>
            </div>
          </div>

          {isMultiLocation === true && (
            <div className="mt-6">
              <Field label="List Your Teams">
                <textarea
                  required
                  value={teamListText}
                  onChange={(event) =>
                    setTeamListText(event.target.value)
                  }
                  rows={7}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-purple-500 transition focus:ring-2"
                  placeholder={
                    "Black Ops\nLady Jags\nRevelation"
                  }
                />
              </Field>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter each team on a separate line, or separate
                team names with commas.
              </p>
            </div>
          )}

          {message && status === "error" && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="mt-8 w-full rounded-xl bg-purple-600 px-5 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "submitting"
              ? "Submitting Request..."
              : "Start Free Trial"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            No credit card required. Your trial begins when your
            dashboard is ready.
          </p>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </span>

      {children}
    </label>
  );
}