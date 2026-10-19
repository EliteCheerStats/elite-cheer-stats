
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const monthlyPriceId = process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY;
    const annualPriceId = process.env.STRIPE_PRICE_ID_PREMIUM_ANNUAL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !secretKey ||
      !monthlyPriceId ||
      !siteUrl ||
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        { error: "Missing checkout configuration" },
        { status: 500 }
      );
    }

    // Verify the user's Supabase access token.
    const authorization = req.headers.get("authorization");
    const token = authorization?.match(/^Bearer (.+)$/i)?.[1];

    if (!token) {
      return NextResponse.json(
        { error: "Please log in before purchasing Premium." },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: "Your login session is invalid or expired." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const plan = body?.plan ?? "monthly";

    if (plan !== "monthly" && plan !== "annual") {
      return NextResponse.json(
        { error: "Invalid subscription plan" },
        { status: 400 }
      );
    }

    if (plan === "annual" && !annualPriceId) {
      return NextResponse.json(
        { error: "Annual Premium is not configured" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "is_premium, stripe_customer_id, stripe_subscription_id, subscription_status"
        )
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      console.error("Checkout profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Unable to verify your ECS account." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

    // Stripe is the authoritative source for subscription status.
    if (profile.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 100,
      });

      const blockingStatuses = new Set([
        "active",
        "trialing",
        "past_due",
        "unpaid",
        "paused",
      ]);

      const existingSubscription = subscriptions.data.find(
        (subscription) => blockingStatuses.has(subscription.status)
      );

      if (existingSubscription) {
        return NextResponse.json(
          {
            error:
              "You already have a subscription. Please manage your existing billing before purchasing another plan.",
          },
          { status: 409 }
        );
      }
    }

    // Fail closed if the profile references a subscription
    // that could not be verified through the customer lookup.
    if (profile.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id
      );

      if (
        subscription.status !== "canceled" &&
        subscription.status !== "incomplete_expired"
      ) {
        return NextResponse.json(
          {
            error:
              "An existing subscription is associated with your account. Please contact support before purchasing again.",
          },
          { status: 409 }
        );
      }
    }

    if (profile.is_premium) {
      return NextResponse.json(
        {
          error:
            "Your account already has Premium access. Please contact support before purchasing another subscription.",
        },
        { status: 409 }
      );
    }

    const priceId =
      plan === "annual" ? annualPriceId! : monthlyPriceId;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(profile.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email }),
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/billing/success`,
      cancel_url: `${siteUrl}/billing/cancel`,
      metadata: {
        supabase_user_id: user.id,
        user_email: user.email,
        plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          user_email: user.email,
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session",
      },
      { status: 500 }
    );
  }
}
