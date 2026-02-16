import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelSubscription, resumeSubscription, createBillingPortalSession } from "@/lib/stripe/server";

// GET - Get current subscription status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's subscription with tier details
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select(`
        *,
        tier:subscription_tiers(*)
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!subscription) {
      // Return free tier info
      const { data: freeTier } = await supabase
        .from("subscription_tiers")
        .select("*")
        .eq("name", "free")
        .single();

      return NextResponse.json({
        hasActiveSubscription: false,
        subscription: null,
        tier: freeTier,
        usage: null,
      });
    }

    return NextResponse.json({
      hasActiveSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      tier: subscription.tier,
      usage: {
        aiQueriesUsed: subscription.ai_queries_used,
        aiQueriesLimit: (subscription.tier as any)?.ai_queries_per_month || null,
        videoAnalysesUsed: subscription.video_analyses_used,
        videoAnalysesLimit: (subscription.tier as any)?.video_analysis_per_month || null,
      },
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel subscription
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const immediate = searchParams.get("immediate") === "true";

    // Get user's active subscription
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // If it's a free subscription, just cancel it directly
    if (!subscription.stripe_subscription_id) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminSupabase = createAdminClient();
      
      await adminSupabase
        .from("user_subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      return NextResponse.json({ success: true, message: "Subscription canceled" });
    }

    // Cancel in Stripe
    await cancelSubscription(subscription.stripe_subscription_id, !immediate);

    // Update local record
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();
    
    if (immediate) {
      await adminSupabase
        .from("user_subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
    } else {
      await adminSupabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: true,
        })
        .eq("id", subscription.id);
    }

    return NextResponse.json({
      success: true,
      message: immediate
        ? "Subscription canceled immediately"
        : "Subscription will be canceled at the end of the billing period",
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}

// PATCH - Resume canceled subscription or update
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "resume") {
      // Get subscription that's set to cancel
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("cancel_at_period_end", true)
        .single();

      if (!subscription || !subscription.stripe_subscription_id) {
        return NextResponse.json(
          { error: "No subscription to resume" },
          { status: 404 }
        );
      }

      // Resume in Stripe
      await resumeSubscription(subscription.stripe_subscription_id);

      // Update local record
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminSupabase = createAdminClient();
      
      await adminSupabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: false })
        .eq("id", subscription.id);

      return NextResponse.json({
        success: true,
        message: "Subscription resumed",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Update subscription error:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
