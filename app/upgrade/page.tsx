
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Plan = "monthly" | "annual";

export default function UpgradePage() {
  const [message, setMessage] = useState("Checking your account...");
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  useEffect(() => {
    async function checkAccount() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !user.email) {
        window.location.replace("/login?next=/upgrade");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Profile fetch error:", profileError);
        setMessage("Unable to verify account status.");
        return;
      }

      if (profile.is_premium) {
        window.location.replace("/compare");
        return;
      }

      setLoading(false);
      setMessage("");
    }

    checkAccount();
  }, []);

  async function startCheckout(plan: Plan) {
    if (checkoutPlan) return;

    setCheckoutPlan(plan);
    setMessage("Redirecting to secure checkout...");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !user.email) {
        window.location.replace("/login?next=/upgrade");
        return;
      }

      
const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession();

if (sessionError || !session?.access_token) {
  window.location.replace("/login?next=/upgrade");
  return;
}

const res = await fetch("/api/stripe/create-checkout-session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ plan }),
});


      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout.");
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error("Checkout error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to start checkout."
      );
      setCheckoutPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1020] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-center">
          Unlock ECS Premium
        </h1>

        <p className="mt-2 text-white/60 text-sm text-center">
          Choose the plan that works best for you.
        </p>

        {loading ? (
          <p className="mt-8 text-center text-white/70 text-sm">
            {message}
          </p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/20 bg-white/5 p-5 flex flex-col">
                <h2 className="text-lg font-semibold">Monthly</h2>

                <div className="mt-4">
                  <span className="text-3xl font-bold">$14.99</span>
                  <span className="text-white/60 text-sm"> / month</span>
                </div>

                <p className="mt-3 text-white/60 text-sm flex-1">
                  Flexible monthly access to ECS Premium.
                </p>

                <button
                  type="button"
                  disabled={checkoutPlan !== null}
                  onClick={() => startCheckout("monthly")}
                  className="mt-6 w-full rounded-lg bg-white/15 hover:bg-white/25 px-4 py-3 font-semibold transition disabled:opacity-50"
                >
                  {checkoutPlan === "monthly"
                    ? "Loading..."
                    : "Choose Monthly"}
                </button>
              </div>

              <div className="relative rounded-xl border-2 border-blue-400 bg-blue-500/10 p-5 flex flex-col">
                <div className="absolute -top-3 right-3 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold">
                  Best Value
                </div>

                <h2 className="text-lg font-semibold">Annual</h2>

                <div className="mt-4">
                  <span className="text-3xl font-bold">$99.99</span>
                  <span className="text-white/60 text-sm"> / year</span>
                </div>

                <p className="mt-3 text-white/60 text-sm flex-1">
                  Save over 44% compared with 12 monthly payments.
                </p>

                <button
                  type="button"
                  disabled={checkoutPlan !== null}
                  onClick={() => startCheckout("annual")}
                  className="mt-6 w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-3 font-semibold transition disabled:opacity-50"
                >
                  {checkoutPlan === "annual"
                    ? "Loading..."
                    : "Choose Annual"}
                </button>
              </div>
            </div>

            <p className="mt-6 text-xs text-center text-white/50">
              Subscriptions renew automatically.
              Secure checkout powered by Stripe.
            </p>

            {message && (
              <p className="mt-4 text-center text-sm text-yellow-300">
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
