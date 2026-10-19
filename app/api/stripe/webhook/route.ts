
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

type Profile = {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function isPremiumStatus(status: string) {
  return status === "active" || status === "trialing";
}

function isTerminalStatus(status: string) {
  return status === "canceled" || status === "incomplete_expired";
}

function getCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function getPeriodEnd(subscription: Stripe.Subscription) {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );

  return ends.length
    ? new Date(Math.max(...ends) * 1000).toISOString()
    : null;
}

async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, stripe_customer_id, stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(
      `Unable to find ECS profile ${userId}: ${
        error?.message ?? "No profile"
      }`
    );
  }

  return data as Profile;
}

async function checkOwnershipAndReplacement(
  profile: Profile,
  incoming: Stripe.Subscription
): Promise<"proceed" | "ignore"> {
  const customerId = getCustomerId(incoming);

  if (
    profile.stripe_customer_id &&
    profile.stripe_customer_id !== customerId
  ) {
    throw new Error(
      `Stripe customer mismatch for ECS user ${profile.id}`
    );
  }

  const existingId = profile.stripe_subscription_id;

  if (!existingId || existingId === incoming.id) {
    return "proceed";
  }

  const oldSubscription =
    await stripe.subscriptions.retrieve(existingId);

  if (getCustomerId(oldSubscription) !== customerId) {
    throw new Error(
      `Existing subscription customer mismatch for ECS user ${profile.id}`
    );
  }

  // Older subscriptions must never replace newer ones.
  if (
    incoming.created < oldSubscription.created ||
    (
      incoming.created === oldSubscription.created &&
      incoming.id !== oldSubscription.id
    )
  ) {
    console.log("Ignoring older subscription event:", {
      userId: profile.id,
      existingId,
      incomingId: incoming.id,
    });

    return "ignore";
  }

  // An existing subscription must be fully terminated
  // before another subscription may replace it.
  if (!isTerminalStatus(oldSubscription.status)) {
    console.warn("Refusing replacement of non-terminal subscription:", {
      userId: profile.id,
      existingId,
      existingStatus: oldSubscription.status,
      incomingId: incoming.id,
    });

    return "ignore";
  }

  // Only grant replacement to a paid/trialing subscription.
  if (!isPremiumStatus(incoming.status)) {
    console.log("Ignoring inactive replacement subscription:", {
      userId: profile.id,
      incomingId: incoming.id,
      incomingStatus: incoming.status,
    });

    return "ignore";
  }

  return "proceed";
}

async function updateSubscription(subscriptionId: string) {
  // Read current Stripe state, not the potentially stale
  // subscription object embedded in the webhook event.
  const subscription =
    await stripe.subscriptions.retrieve(subscriptionId);

  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    throw new Error(
      `Subscription ${subscriptionId} has no ECS user ID`
    );
  }

  const customerId = getCustomerId(subscription);

  // Retry only when a concurrent database update changes
  // the expected subscription ID.
  for (let attempt = 0; attempt < 3; attempt++) {
    const profile = await getProfile(userId);

    const decision = await checkOwnershipAndReplacement(
      profile,
      subscription
    );

    if (decision === "ignore") {
      return;
    }

    const existingId = profile.stripe_subscription_id;

    let updateQuery = supabaseAdmin
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        current_period_end: getPeriodEnd(subscription),
        is_premium: isPremiumStatus(subscription.status),
      })
      .eq("id", userId);

    // Compare-and-swap: only update the profile if its
    // subscription ID is still what we inspected.
    if (existingId) {
      updateQuery = updateQuery.eq(
        "stripe_subscription_id",
        existingId
      );
    } else {
      updateQuery = updateQuery.is(
        "stripe_subscription_id",
        null
      );
    }

    const { data, error } = await updateQuery.select("id");

    if (error) {
      throw new Error(
        `Supabase subscription update failed: ${error.message}`
      );
    }

    if (data?.length === 1) {
      console.log("ECS subscription synchronized:", {
        userId,
        subscriptionId,
        status: subscription.status,
      });
      return;
    }

    if (data && data.length > 1) {
      throw new Error(
        `Unexpected multiple profile updates for ${userId}`
      );
    }

    // Zero updated rows can mean another webhook changed
    // the subscription ID after our initial read.
    console.log("Webhook update race detected; rechecking profile:", {
      userId,
      subscriptionId,
      attempt: attempt + 1,
    });
  }

  // After repeated concurrent changes, fail so Stripe can
  // retry rather than silently losing a legitimate update.
  throw new Error(
    `Unable to synchronize subscription ${subscriptionId} after retries`
  );
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        if (
          session.mode !== "subscription" ||
          typeof session.subscription !== "string"
        ) {
          break;
        }

        await updateSubscription(session.subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription =
          event.data.object as Stripe.Subscription;

        await updateSubscription(subscription.id);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
