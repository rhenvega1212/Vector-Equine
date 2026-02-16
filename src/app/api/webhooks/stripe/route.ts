import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { constructWebhookEvent, stripe } from "@/lib/stripe/server";
import Stripe from "stripe";

// Disable body parsing, we need the raw body for signature verification
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("Missing Stripe signature");
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Import admin client for database operations
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Log the event
  try {
    await supabase.from("payment_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      data: event.data as any,
      processed: false,
    });
  } catch (error) {
    console.error("Failed to log payment event:", error);
  }

  try {
    switch (event.type) {
      // ============================================
      // CHECKOUT SESSION COMPLETED
      // ============================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        console.log("Checkout session completed:", session.id, metadata);

        if (metadata.type === "course_purchase") {
          // Handle course purchase
          await handleCoursePurchase(supabase, session, metadata);
        } else if (metadata.type === "subscription") {
          // Handle subscription creation
          await handleSubscriptionCreated(supabase, session, metadata);
        }
        break;
      }

      // ============================================
      // PAYMENT SUCCEEDED
      // ============================================
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment succeeded:", paymentIntent.id);

        // Update purchase status if exists
        await supabase
          .from("purchases")
          .update({ status: "completed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }

      // ============================================
      // PAYMENT FAILED
      // ============================================
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error("Payment failed:", paymentIntent.id, paymentIntent.last_payment_error?.message);

        await supabase
          .from("purchases")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }

      // ============================================
      // SUBSCRIPTION CREATED
      // ============================================
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription created:", subscription.id);
        // Usually handled in checkout.session.completed
        break;
      }

      // ============================================
      // SUBSCRIPTION UPDATED
      // ============================================
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription updated:", subscription.id, subscription.status);

        await supabase
          .from("user_subscriptions")
          .update({
            status: mapStripeStatus(subscription.status),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      // ============================================
      // SUBSCRIPTION DELETED (Canceled)
      // ============================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription deleted:", subscription.id);

        await supabase
          .from("user_subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      // ============================================
      // INVOICE PAID (Subscription renewal)
      // ============================================
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice paid:", invoice.id);

        if (invoice.subscription) {
          // Reset usage counters on subscription renewal
          await supabase
            .from("user_subscriptions")
            .update({
              ai_queries_used: 0,
              video_analyses_used: 0,
              usage_reset_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", invoice.subscription as string);
        }
        break;
      }

      // ============================================
      // INVOICE PAYMENT FAILED
      // ============================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.error("Invoice payment failed:", invoice.id);

        if (invoice.subscription) {
          await supabase
            .from("user_subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", invoice.subscription as string);
        }
        break;
      }

      // ============================================
      // REFUND CREATED
      // ============================================
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        console.log("Charge refunded:", charge.id);

        if (charge.payment_intent) {
          await supabase
            .from("purchases")
            .update({
              status: "refunded",
              refunded_at: new Date().toISOString(),
            })
            .eq("stripe_payment_intent_id", charge.payment_intent as string);
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    // Mark event as processed
    await supabase
      .from("payment_events")
      .update({ processed: true })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);

    // Log the error
    await supabase
      .from("payment_events")
      .update({ error: String(error) })
      .eq("stripe_event_id", event.id);

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function handleCoursePurchase(
  supabase: any,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>
) {
  const { product_id, challenge_id, user_id } = metadata;

  // Create purchase record
  await supabase.from("purchases").insert({
    user_id,
    product_id,
    challenge_id: challenge_id || null,
    stripe_payment_intent_id: session.payment_intent as string,
    stripe_checkout_session_id: session.id,
    amount: session.amount_total || 0,
    currency: session.currency || "usd",
    status: "completed",
  });

  // Auto-enroll user in the challenge if applicable
  if (challenge_id) {
    // Check if already enrolled
    const { data: existing } = await supabase
      .from("challenge_enrollments")
      .select("id")
      .eq("user_id", user_id)
      .eq("challenge_id", challenge_id)
      .single();

    if (!existing) {
      await supabase.from("challenge_enrollments").insert({
        user_id,
        challenge_id,
      });
    }
  }
}

async function handleSubscriptionCreated(
  supabase: any,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>
) {
  const { tier_id, user_id } = metadata;
  const subscriptionId = session.subscription as string;

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Cancel any existing active subscriptions
  await supabase
    .from("user_subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("user_id", user_id)
    .eq("status", "active");

  // Create new subscription record
  await supabase.from("user_subscriptions").insert({
    user_id,
    tier_id,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: session.customer as string,
    status: mapStripeStatus(subscription.status),
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  });
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const statusMap: Record<string, string> = {
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    unpaid: "unpaid",
    trialing: "trialing",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    paused: "canceled",
  };
  return statusMap[status] || "incomplete";
}
