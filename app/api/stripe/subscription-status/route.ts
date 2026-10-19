
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7).trim();

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "stripe_customer_id, stripe_subscription_id, is_premium"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({
        plan: "free",
        subscription_status: null,
        renewal_date: null,
        cancellation_scheduled: false,
        cancellation_date: null,
        scheduled_upgrade: false,
        can_upgrade: false,
      });
    }

    const subscription = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    );

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    if (
      profile.stripe_customer_id !== customerId ||
      subscription.metadata.supabase_user_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Subscription ownership could not be verified" },
        { status: 403 }
      );
    }

    const monthlyPrice =
      process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY!;

    const annualPrice =
      process.env.STRIPE_PRICE_ID_PREMIUM_ANNUAL!;

    const item = subscription.items.data[0];
    const priceId = item?.price.id;

    let plan: "monthly" | "annual" | "unknown" = "unknown";

    if (priceId === monthlyPrice) {
      plan = "monthly";
    } else if (priceId === annualPrice) {
      plan = "annual";
    }

    const renewalDate = item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null;

    // Stripe may represent a scheduled cancellation using
    // cancel_at, cancel_at_period_end, or both.
    const cancellationScheduled =
      subscription.status === "active" &&
      Boolean(
        subscription.cancel_at ||
        subscription.cancel_at_period_end
      );

    const cancellationTimestamp =
      subscription.cancel_at ??
      (subscription.cancel_at_period_end
        ? item?.current_period_end
        : null);

    const cancellationDate =
      cancellationScheduled && cancellationTimestamp
        ? new Date(cancellationTimestamp * 1000).toISOString()
        : null;

    let scheduledUpgrade = false;

    if (subscription.schedule) {
      const scheduleId =
        typeof subscription.schedule === "string"
          ? subscription.schedule
          : subscription.schedule.id;

      const schedule =
        await stripe.subscriptionSchedules.retrieve(scheduleId);

      scheduledUpgrade = schedule.phases.some(
        (phase) =>
          phase.start_date > Math.floor(Date.now() / 1000) &&
          phase.items.some((phaseItem) => {
            const price =
              typeof phaseItem.price === "string"
                ? phaseItem.price
                : phaseItem.price?.id;

            return price === annualPrice;
          })
      );
    }

    const canUpgrade =
      profile.is_premium === true &&
      subscription.status === "active" &&
      plan === "monthly" &&
      !cancellationScheduled &&
      !subscription.schedule;

    return NextResponse.json({
      plan,
      subscription_status: subscription.status,
      renewal_date: renewalDate,
      cancellation_scheduled: cancellationScheduled,
      cancellation_date: cancellationDate,
      scheduled_upgrade: scheduledUpgrade,
      can_upgrade: canUpgrade,
    });
  } catch (error) {
    console.error("subscription-status error:", error);

    return NextResponse.json(
      { error: "Unable to load subscription status" },
      { status: 500 }
    );
  }
}
