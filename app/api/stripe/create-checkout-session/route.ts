import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    if (!process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_ID_PREMIUM_MONTHLY" },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SITE_URL" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const userId = body?.userId;
    const userEmail = body?.userEmail;

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: "Missing user info. Please log in first." },
        { status: 401 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userEmail,
      allow_promotion_codes: true,
      line_items: [
  {
    price: "price_1TCuwuDk4M7TUmP6j9yCbWrJ", // your LIVE price here
    quantity: 1,
  },
],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/cancel`,
      metadata: {
        supabase_user_id: userId,
        user_email: userEmail,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          user_email: userEmail,
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