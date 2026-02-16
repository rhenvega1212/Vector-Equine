import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all active subscription tiers
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: tiers, error } = await supabase
      .from("subscription_tiers")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ tiers: tiers || [] });
  } catch (error) {
    console.error("Get subscription tiers error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription tiers" },
      { status: 500 }
    );
  }
}

// POST - Create a new subscription tier (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      displayName,
      description,
      priceAmount,
      currency = "usd",
      interval,
      features = [],
      aiQueriesPerMonth,
      videoAnalysisPerMonth,
      prioritySupport = false,
    } = body;

    // Create in Stripe if not free
    let stripeProductId = null;
    let stripePriceId = null;

    if (priceAmount > 0) {
      const { createStripeProduct } = await import("@/lib/stripe/server");
      
      const { product, price } = await createStripeProduct({
        name: displayName,
        description,
        priceAmount,
        currency,
        type: "recurring",
        interval,
      });

      stripeProductId = product.id;
      stripePriceId = price.id;
    }

    // Create in database
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();

    const { data: tier, error } = await adminSupabase
      .from("subscription_tiers")
      .insert({
        name,
        display_name: displayName,
        description,
        price_amount: priceAmount,
        currency,
        interval,
        features,
        ai_queries_per_month: aiQueriesPerMonth,
        video_analysis_per_month: videoAnalysisPerMonth,
        priority_support: prioritySupport,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ tier }, { status: 201 });
  } catch (error) {
    console.error("Create subscription tier error:", error);
    return NextResponse.json(
      { error: "Failed to create subscription tier" },
      { status: 500 }
    );
  }
}
