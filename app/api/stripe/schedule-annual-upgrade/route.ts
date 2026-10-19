
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user.
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

    // 2. Find the user's existing subscription.
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "stripe_customer_id, stripe_subscription_id, is_premium"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to load account" },
        { status: 500 }
      );
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No Premium subscription found" },
        { status: 400 }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    );

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    // 3. Verify ownership.
    if (
      !profile.is_premium ||
      profile.stripe_customer_id !== customerId ||
      subscription.metadata.supabase_user_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Subscription ownership could not be verified" },
        { status: 403 }
      );
    }

    // 4. Verify upgrade eligibility.
    if (
      subscription.status !== "active" ||
      subscription.cancel_at_period_end ||
      subscription.cancel_at
    ) {
      return NextResponse.json(
        { error: "Subscription is not eligible for an upgrade" },
        { status: 409 }
      );
    }

    if (subscription.schedule) {
      return NextResponse.json(
        { error: "This subscription already has a schedule" },
        { status: 409 }
      );
    }

    const monthlyPrice =
      process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY!;

    const annualPrice =
      process.env.STRIPE_PRICE_ID_PREMIUM_ANNUAL!;

    const item = subscription.items.data[0];

    if (
      subscription.items.data.length !== 1 ||
      !item ||
      item.price.id !== monthlyPrice ||
      item.quantity !== 1
    ) {
      return NextResponse.json(
        { error: "This is not an eligible Monthly subscription" },
        { status: 409 }
      );
    }

    const renewalDate = item.current_period_end;

    if (renewalDate <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "Subscription renewal is already in progress" },
        { status: 409 }
      );
    }

    // 5. Create a schedule FROM the existing subscription.
    // This does not create another subscription or charge now.
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscription.id,
    });

    try {
      // Stripe establishes the current phase's start date.
      // Preserve that exact timestamp when updating phases.
      const currentPhase = schedule.phases[0];

      if (
        !currentPhase ||
        currentPhase.start_date >= renewalDate
      ) {
        throw new Error(
          "Stripe returned an invalid current schedule phase"
        );
      }

      // 6. Keep Monthly until renewal, then use Annual.
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        proration_behavior: "none",
        phases: [
          {
            items: [
              {
                price: monthlyPrice,
                quantity: 1,
              },
            ],
            start_date: currentPhase.start_date,
            end_date: renewalDate,
            proration_behavior: "none",
          },
          {
            items: [
              {
                price: annualPrice,
                quantity: 1,
              },
            ],
            start_date: renewalDate,
            duration: {
              interval: "year",
              interval_count: 1,
            },
            proration_behavior: "none",
          },
        ],
      });

      // 7. Verify the saved schedule directly from Stripe.
      const verifiedSchedule =
        await stripe.subscriptionSchedules.retrieve(schedule.id);

      const monthlyPhase = verifiedSchedule.phases[0];
      const annualPhase = verifiedSchedule.phases[1];

      const phaseHasPrice = (
        phase: Stripe.SubscriptionSchedule.Phase,
        priceId: string
      ) =>
        phase.items.some((phaseItem) => {
          const price =
            typeof phaseItem.price === "string"
              ? phaseItem.price
              : phaseItem.price?.id;

          return price === priceId;
        });

      if (
        verifiedSchedule.status !== "active" ||
        verifiedSchedule.end_behavior !== "release" ||
        !monthlyPhase ||
        !annualPhase ||
        monthlyPhase.end_date !== renewalDate ||
        annualPhase.start_date !== renewalDate ||
        !phaseHasPrice(monthlyPhase, monthlyPrice) ||
        !phaseHasPrice(annualPhase, annualPrice)
      ) {
        throw new Error(
          "Stripe schedule verification failed"
        );
      }

      return NextResponse.json({
        success: true,
        message: "Annual upgrade scheduled successfully",
        effective_date: new Date(
          renewalDate * 1000
        ).toISOString(),
        annual_price: 99.99,
      });
    } catch (scheduleError) {
      console.error(
        "Annual schedule configuration failed:",
        scheduleError
      );

      // Release the schedule if configuration or verification
      // fails. This preserves the existing subscription.
      try {
        await stripe.subscriptionSchedules.release(schedule.id);
      } catch (releaseError) {
        console.error(
          "CRITICAL: Failed to release incomplete schedule:",
          releaseError
        );
      }

      throw scheduleError;
    }
  } catch (error: unknown) {
    console.error("schedule-annual-upgrade error:", error);

    return NextResponse.json(
      { error: "Unable to schedule Annual upgrade" },
      { status: 500 }
    );
  }
}
