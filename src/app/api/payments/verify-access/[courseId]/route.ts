import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Verify purchase access by product id (courseId param kept for URL compat). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabase = await createClient();
    const { courseId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, price_amount, is_active")
      .eq("id", courseId)
      .eq("type", "course")
      .maybeSingle();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.is_active || product.price_amount === 0) {
      return NextResponse.json({
        hasAccess: true,
        purchase: null,
        isFree: true,
      });
    }

    const { data: purchase } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_id", courseId)
      .eq("status", "completed")
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    return NextResponse.json({
      hasAccess: !!purchase || isAdmin,
      purchase: purchase || null,
      isFree: false,
      isAdmin,
    });
  } catch (error) {
    console.error("Verify access error:", error);
    return NextResponse.json(
      { error: "Failed to verify access" },
      { status: 500 }
    );
  }
}
