import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateStripeCustomer,
  createCourseCheckoutSession,
  createSubscriptionCheckoutSession,
} from "@/lib/stripe/server";
import { z } from "zod";

const checkoutSchema = z.object({
  productId: z.string().uuid().optional(),
  challengeId: z.string().uuid().optional(),
  tierId: z.string().uuid().optional(),
  type: z.enum(["course", "subscription"]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const { productId, challengeId, tierId, type } = validation.data;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      profile.email,
      profile.display_name
    );

    if (type === "course") {
      // Course purchase flow
      if (!productId) {
        return NextResponse.json(
          { error: "Product ID required for course purchase" },
          { status: 400 }
        );
      }

      // Get product details
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("type", "course")
        .eq("is_active", true)
        .single();

      if (!product) {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 404 }
        );
      }

      if (!product.stripe_price_id) {
        return NextResponse.json(
          { error: "Product not configured for payment" },
          { status: 400 }
        );
      }

      // Check if already purchased
      const { data: existingPurchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .eq("status", "completed")
        .single();

      if (existingPurchase) {
        return NextResponse.json(
          { error: "You have already purchased this course" },
          { status: 400 }
        );
      }

      const session = await createCourseCheckoutSession({
        customerId,
        priceId: product.stripe_price_id,
        productId: product.id,
        challengeId: product.challenge_id || challengeId || "",
        userId: user.id,
        successUrl: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/payments/canceled`,
      });

      return NextResponse.json({
        sessionId: session.id,
        url: session.url,
      });
    } else {
      // Subscription flow
      if (!tierId) {
        return NextResponse.json(
          { error: "Tier ID required for subscription" },
          { status: 400 }
        );
      }

      // Get tier details
      const { data: tier } = await supabase
        .from("subscription_tiers")
        .select("*")
        .eq("id", tierId)
        .eq("is_active", true)
        .single();

      if (!tier) {
        return NextResponse.json(
          { error: "Subscription tier not found" },
          { status: 404 }
        );
      }

      // Free tier doesn't need Stripe
      if (tier.price_amount === 0) {
        // Create free subscription directly
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const adminSupabase = createAdminClient();
        
        // Cancel any existing subscriptions
        await adminSupabase
          .from("user_subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("status", "active");

        // Create new free subscription
        await adminSupabase.from("user_subscriptions").insert({
          user_id: user.id,
          tier_id: tier.id,
          status: "active",
          current_period_start: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          message: "Free subscription activated",
        });
      }

      if (!tier.stripe_price_id) {
        return NextResponse.json(
          { error: "Subscription tier not configured for payment" },
          { status: 400 }
        );
      }

      // Check for existing active subscription
      const { data: existingSub } = await supabase
        .from("user_subscriptions")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (existingSub) {
        return NextResponse.json(
          { error: "You already have an active subscription. Please cancel it first to change plans." },
          { status: 400 }
        );
      }

      const session = await createSubscriptionCheckoutSession({
        customerId,
        priceId: tier.stripe_price_id,
        tierId: tier.id,
        userId: user.id,
        successUrl: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/payments/canceled`,
      });

      return NextResponse.json({
        sessionId: session.id,
        url: session.url,
      });
    }
  } catch (error) {
    console.error("Checkout session error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
