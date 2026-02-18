import Stripe from "stripe";

// Lazy-initialized so build can succeed without STRIPE_SECRET_KEY (e.g. on Vercel)
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Check if customer already exists
  const { data: existingCustomer } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (existingCustomer?.stripe_customer_id) {
    return existingCustomer.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await getStripe().customers.create({
    email,
    name: name || undefined,
    metadata: {
      supabase_user_id: userId,
    },
  });

  // Store the mapping
  await supabase.from("stripe_customers").insert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

/**
 * Create a Checkout Session for a one-time course purchase
 */
export async function createCourseCheckoutSession(params: {
  customerId: string;
  priceId: string;
  productId: string;
  challengeId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const session = await getStripe().checkout.sessions.create({
    customer: params.customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      product_id: params.productId,
      challenge_id: params.challengeId,
      user_id: params.userId,
      type: "course_purchase",
    },
  });

  return session;
}

/**
 * Create a Checkout Session for a subscription
 */
export async function createSubscriptionCheckoutSession(params: {
  customerId: string;
  priceId: string;
  tierId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<Stripe.Checkout.Session> {
  const session = await getStripe().checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: params.trialDays
      ? { trial_period_days: params.trialDays }
      : undefined,
    metadata: {
      tier_id: params.tierId,
      user_id: params.userId,
      type: "subscription",
    },
  });

  return session;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return getStripe().subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return getStripe().subscriptions.cancel(subscriptionId);
  }
}

/**
 * Resume a canceled subscription (if not yet ended)
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId);
}

/**
 * Create a billing portal session for subscription management
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Verify a webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

/**
 * Create a product and price in Stripe (for admin use)
 */
export async function createStripeProduct(params: {
  name: string;
  description?: string;
  priceAmount: number;
  currency?: string;
  type: "one_time" | "recurring";
  interval?: "month" | "year";
}): Promise<{ product: Stripe.Product; price: Stripe.Price }> {
  const product = await getStripe().products.create({
    name: params.name,
    description: params.description,
  });

  const priceData: Stripe.PriceCreateParams = {
    product: product.id,
    unit_amount: params.priceAmount,
    currency: params.currency || "usd",
  };

  if (params.type === "recurring" && params.interval) {
    priceData.recurring = {
      interval: params.interval,
    };
  }

  const price = await getStripe().prices.create(priceData);

  return { product, price };
}
