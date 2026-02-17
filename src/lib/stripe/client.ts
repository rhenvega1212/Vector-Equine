import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

/**
 * Get Stripe.js instance (client-side only)
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}

/**
 * Redirect to Stripe Checkout
 */
export async function redirectToCheckout(sessionId: string): Promise<void> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error("Stripe failed to load");
  }

  // Stripe.js v2+: use session URL redirect (redirectToCheckout deprecated)
  const stripeAny = stripe as { redirectToCheckout?: (opts: { sessionId: string }) => Promise<{ error?: { message: string } }> };
  if (stripeAny.redirectToCheckout) {
    const { error } = await stripeAny.redirectToCheckout({ sessionId });
    if (error) throw new Error(error.message);
    return;
  }
  throw new Error("Stripe Checkout redirect is not available");
}
