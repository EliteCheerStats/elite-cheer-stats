
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type SubscriptionInfo = {
  plan: "free" | "monthly" | "annual" | "unknown";
  subscription_status?: string | null;
  renewal_date: string | null;
  cancellation_scheduled: boolean;
  cancellation_date: string | null;
  scheduled_upgrade: boolean;
  can_upgrade: boolean;
};

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [subscription, setSubscription] =
    useState<SubscriptionInfo | null>(null);

  const [subscriptionLoading, setSubscriptionLoading] =
    useState(false);

  const [subscriptionError, setSubscriptionError] =
    useState("");

  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      setLoading(true);

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);
      setSubscription(null);
      setSubscriptionError("");

      if (!currentSession?.user) {
        setIsPremium(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", currentSession.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("account profile fetch error:", error);
        setIsPremium(false);
        setLoading(false);
        return;
      }

      const premium = !!data?.is_premium;
      setIsPremium(premium);
      setLoading(false);

      if (!premium) return;

      setSubscriptionLoading(true);

      try {
        const response = await fetch(
          "/api/stripe/subscription-status",
          {
            headers: {
              Authorization: `Bearer ${currentSession.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load subscription details"
          );
        }

        if (mounted) {
          setSubscription(result as SubscriptionInfo);
        }
      } catch (err) {
        console.error("subscription status error:", err);

        if (mounted) {
          setSubscriptionError(
            "Subscription details are temporarily unavailable."
          );
        }
      } finally {
        if (mounted) setSubscriptionLoading(false);
      }
    }

    loadAccount();

    const { data: listener } =
      supabase.auth.onAuthStateChange(() => {
        loadAccount();
      });

    const handleFocus = () => {
      loadAccount();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleManageSubscription() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("You must be signed in.");
        return;
      }

      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      alert(
        data?.error ||
          "Unable to open billing portal right now."
      );
    } catch (err) {
      console.error("portal session error:", err);
      alert("Unable to open billing portal right now.");
    }
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "Unavailable";

    return new Date(value).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  async function handleAnnualUpgrade() {
    if (
      upgrading ||
      !subscription?.can_upgrade ||
      subscription.scheduled_upgrade ||
      subscription.cancellation_scheduled
    ) {
      return;
    }

    const renewalDate = formatDate(
      subscription.renewal_date
    );

    const confirmed = window.confirm(
      `Switch to ECS Premium Annual?\n\n` +
        `Your Monthly subscription will continue until ${renewalDate}.\n\n` +
        `On that date, your subscription will switch to ` +
        `$99.99/year.\n\n` +
        `You will not be charged today.\n\n` +
        `Confirm this change?`
    );

    if (!confirmed) return;

    setUpgrading(true);
    setUpgradeMessage("");

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        throw new Error("You must be signed in.");
      }

      const response = await fetch(
        "/api/stripe/schedule-annual-upgrade",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to schedule Annual upgrade."
        );
      }

      // Read back the actual state from Stripe.
      const statusResponse = await fetch(
        "/api/stripe/subscription-status",
        {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          cache: "no-store",
        }
      );

      if (!statusResponse.ok) {
        throw new Error(
          "The upgrade request was accepted, but we could not " +
            "verify its status. Please refresh your Account page."
        );
      }

      const updatedStatus =
        (await statusResponse.json()) as SubscriptionInfo;

      setSubscription(updatedStatus);

      if (updatedStatus.scheduled_upgrade) {
        setUpgradeMessage(
          `Your Annual upgrade is scheduled for ` +
            `${formatDate(updatedStatus.renewal_date)}. ` +
            `No charge was made today.`
        );
      } else {
        setUpgradeMessage(
          "Your upgrade request was received. " +
            "Please refresh to confirm its status."
        );
      }
    } catch (err) {
      console.error("annual upgrade error:", err);

      alert(
        err instanceof Error
          ? err.message
          : "Unable to schedule Annual upgrade."
      );
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-extrabold text-white">
            Account
          </h1>
          <p className="mt-3 text-slate-300">Loading…</p>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-extrabold text-white">
            Account
          </h1>

          <p className="mt-3 text-slate-300">
            You’re not signed in.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const planLabel = !isPremium
    ? "Free"
    : subscription?.plan === "monthly"
      ? "Premium Monthly"
      : subscription?.plan === "annual"
        ? "Premium Annual"
        : "Premium";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-extrabold text-white">
          Account
        </h1>

        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Email
            </div>

            <div className="mt-2 text-lg font-semibold text-white">
              {session.user.email}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Plan
            </div>

            <div className="mt-2 text-lg font-semibold text-white">
              {planLabel}
            </div>

            {isPremium && subscriptionLoading && (
              <p className="mt-2 text-sm text-slate-400">
                Loading subscription details…
              </p>
            )}

            {isPremium && subscriptionError && (
              <p className="mt-2 text-sm text-amber-300">
                {subscriptionError}
              </p>
            )}

            {isPremium &&
              subscription?.cancellation_scheduled &&
              subscription.cancellation_date && (
                <p className="mt-2 text-sm font-semibold text-amber-300">
                  Premium active until{" "}
                  {formatDate(
                    subscription.cancellation_date
                  )}
                </p>
              )}

            {isPremium &&
              !subscription?.cancellation_scheduled &&
              subscription?.renewal_date && (
                <p className="mt-2 text-sm text-slate-300">
                  Next renewal:{" "}
                  {formatDate(
                    subscription.renewal_date
                  )}
                </p>
              )}

            {isPremium &&
              !subscription?.cancellation_scheduled &&
              subscription?.scheduled_upgrade && (
                <p className="mt-3 text-sm font-semibold text-teal-300">
                  Annual upgrade scheduled for{" "}
                  {formatDate(
                    subscription.renewal_date
                  )}
                </p>
              )}
          </div>
        </div>

        {isPremium &&
          subscription?.can_upgrade &&
          !subscription.scheduled_upgrade &&
          !subscription.cancellation_scheduled && (
            <div className="mt-6 rounded-xl border border-teal-400/30 bg-teal-400/5 p-4">
              <h2 className="text-lg font-bold text-white">
                Switch to Annual
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                Get ECS Premium for $99.99/year instead
                of $14.99/month.
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Your Annual plan will begin on{" "}
                <strong>
                  {formatDate(
                    subscription.renewal_date
                  )}
                </strong>
                . No charge today.
              </p>

              <button
                type="button"
                onClick={handleAnnualUpgrade}
                disabled={upgrading}
                className="mt-4 rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {upgrading
                  ? "Scheduling Upgrade…"
                  : "Switch to Annual — $99.99/year"}
              </button>
            </div>
          )}

        {upgradeMessage && (
          <p
            role="status"
            className="mt-4 text-sm font-medium text-teal-300"
          >
            {upgradeMessage}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {isPremium ? (
            <>
              <button
                onClick={handleManageSubscription}
                className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
              >
                Manage Subscription
              </button>

              <a
                href={`mailto:contactus@elitecheerstats.com?subject=${encodeURIComponent(
                  "Refund Request - Elite Cheer Stats"
                )}&body=${encodeURIComponent(
                  `Hi,\n\nI would like to request a refund.\n\nAccount email: ${session.user.email}\nReason: My team is not included / product did not meet expectations.\n\nThank you.`
                )}`}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                Request a Refund
              </a>
            </>
          ) : (
            <Link
              href="/upgrade"
              className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
            >
              Go Premium
            </Link>
          )}

          <button
            onClick={handleSignOut}
            className="rounded-md border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            Sign Out
          </button>
        </div>

        {isPremium && (
          <p className="mt-4 text-xs text-white/60">
            If your team is not included, you may
            request a full refund within 24 hours
            of signup.
          </p>
        )}
      </div>
    </main>
  );
}
