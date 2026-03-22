import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("profile lookup error:", profileError);
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account" },
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("create-portal-session error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}