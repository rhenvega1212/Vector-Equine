// Payment-related types

export interface Product {
  id: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  name: string;
  description: string | null;
  type: "course" | "subscription";
  price_amount: number;
  currency: string;
  interval: "month" | "year" | null;
  interval_count: number | null;
  challenge_id: string | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  price_amount: number;
  currency: string;
  interval: "month" | "year" | null;
  interval_count: number | null;
  features: string[];
  ai_queries_per_month: number | null;
  video_analysis_per_month: number | null;
  priority_support: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  ai_queries_used: number;
  video_analyses_used: number;
  usage_reset_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  tier?: SubscriptionTier;
}

export interface Purchase {
  id: string;
  user_id: string;
  product_id: string;
  challenge_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  refunded_at: string | null;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: Product;
}

export interface StripeCustomer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCheckoutSessionRequest {
  productId?: string;
  challengeId?: string;
  tierId?: string;
  type: "course" | "subscription";
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface SubscriptionStatusResponse {
  hasActiveSubscription: boolean;
  subscription: UserSubscription | null;
  tier: SubscriptionTier | null;
  usage: {
    aiQueriesUsed: number;
    aiQueriesLimit: number | null;
    videoAnalysesUsed: number;
    videoAnalysesLimit: number | null;
  } | null;
}

export interface CourseAccessResponse {
  hasAccess: boolean;
  purchase: Purchase | null;
  isFree: boolean;
}

// Format price for display
export function formatPrice(
  amount: number,
  currency: string = "usd"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

// Format subscription interval for display
export function formatInterval(
  interval: "month" | "year" | null,
  count: number = 1
): string {
  if (!interval) return "";
  if (count === 1) {
    return interval === "month" ? "/month" : "/year";
  }
  return `every ${count} ${interval}s`;
}
