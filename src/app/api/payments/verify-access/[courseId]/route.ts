import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const supabase = await createClient();
    const { courseId } = params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if the course exists
    const { data: challenge } = await supabase
      .from("challenges")
      .select("id, title, status")
      .eq("id", courseId)
      .single();

    if (!challenge) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Check if there's a product for this challenge
    const { data: product } = await supabase
      .from("products")
      .select("id, price_amount, is_active")
      .eq("challenge_id", courseId)
      .eq("type", "course")
      .single();

    // If no product exists or price is 0, course is free
    if (!product || product.price_amount === 0) {
      return NextResponse.json({
        hasAccess: true,
        purchase: null,
        isFree: true,
      });
    }

    // Check if user has purchased
    const { data: purchase } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .eq("challenge_id", courseId)
      .eq("status", "completed")
      .single();

    // Check if user is admin (admins have access to everything)
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
