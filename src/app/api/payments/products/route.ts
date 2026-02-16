import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all active products
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'course' or 'subscription'

    let query = supabase
      .from("products")
      .select(`
        *,
        challenge:challenges(id, title, description, difficulty, duration_days)
      `)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (type) {
      query = query.eq("type", type);
    }

    const { data: products, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ products: products || [] });
  } catch (error) {
    console.error("Get products error:", error);
    return NextResponse.json(
      { error: "Failed to get products" },
      { status: 500 }
    );
  }
}

// POST - Create a new product (admin only)
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
      description,
      type,
      priceAmount,
      currency = "usd",
      interval,
      intervalCount,
      challengeId,
      features = [],
    } = body;

    // Create product in Stripe first
    const { createStripeProduct } = await import("@/lib/stripe/server");
    
    const { product: stripeProduct, price: stripePrice } = await createStripeProduct({
      name,
      description,
      priceAmount,
      currency,
      type: type === "subscription" ? "recurring" : "one_time",
      interval,
    });

    // Create product in database
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();

    const { data: product, error } = await adminSupabase
      .from("products")
      .insert({
        name,
        description,
        type,
        price_amount: priceAmount,
        currency,
        interval,
        interval_count: intervalCount,
        challenge_id: challengeId,
        features,
        stripe_product_id: stripeProduct.id,
        stripe_price_id: stripePrice.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
