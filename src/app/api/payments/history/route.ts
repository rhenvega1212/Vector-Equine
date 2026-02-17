import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Get purchases with product details
    const { data: purchases, error: purchasesError, count } = await supabase
      .from("purchases")
      .select(`
        *,
        product:products(name, description, type)
      `, { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (purchasesError) {
      throw purchasesError;
    }

    // Get subscription history
    const { data: subscriptions } = await supabase
      .from("user_subscriptions")
      .select(`
        *,
        tier:subscription_tiers(name, display_name, price_amount, interval)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      purchases: purchases || [],
      subscriptions: subscriptions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Get purchase history error:", error);
    return NextResponse.json(
      { error: "Failed to get purchase history" },
      { status: 500 }
    );
  }
}
