import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isPremiumStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
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
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  try {
    console.log("Webhook event received:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userEmail = session.metadata?.user_email ?? null;

        console.log("checkout.session.completed email:", userEmail);
        console.log("checkout.session.completed metadata:", session.metadata);

        if (userEmail) {
          const { data, error } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id:
                typeof session.customer === "string" ? session.customer : null,
              stripe_subscription_id:
                typeof session.subscription === "string"
                  ? session.subscription
                  : null,
            })
            .eq("email", userEmail)
            .select();

          console.log("checkout.session.completed update data:", data);
          if (error) {
            console.error("checkout.session.completed update error:", error);
          }
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userEmail = subscription.metadata?.user_email ?? null;

        console.log("subscription event type:", event.type);
        console.log("subscription email:", userEmail);
        console.log("subscription metadata:", subscription.metadata);
        console.log("subscription status:", subscription.status);

        let currentPeriodEnd: string | null = null;
        const unixEnd = (subscription as any).current_period_end;
        if (unixEnd) {
          currentPeriodEnd = new Date(unixEnd * 1000).toISOString();
        }

        if (userEmail) {
          const { data, error } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              current_period_end: currentPeriodEnd,
              is_premium: isPremiumStatus(subscription.status),
            })
            .eq("email", userEmail)
            .select();

          console.log("subscription update data:", data);
          if (error) {
            console.error("subscription update error:", error);
          }
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler failed:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}