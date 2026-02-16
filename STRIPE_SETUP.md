# Stripe Payment Integration Setup

This guide explains how to set up and configure Stripe payments for Vector Equine.

## Overview

Vector Equine uses Stripe for:
- **One-time purchases**: Course/challenge access
- **Subscriptions**: AI Horse Trainer tiers (Free, Pro Monthly, Pro Annual)
- **Billing management**: Customer portal for subscription management

## Prerequisites

- [Stripe account](https://stripe.com) (test mode works for development)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhook testing)

## Setup Steps

### 1. Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API keys**
3. Copy your **Publishable key** and **Secret key**
4. For production, use live keys; for development, use test keys

### 2. Configure Environment Variables

Add to your `.env.local`:

```env
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 3. Set Up Webhooks

#### For Local Development:

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows (with scoop)
   scoop install stripe

   # Or download from https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Copy the webhook signing secret (starts with `whsec_`) to your `.env.local`

#### For Production (Vercel):

1. Go to **Stripe Dashboard > Developers > Webhooks**
2. Click **Add endpoint**
3. Enter your production URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
5. Copy the **Signing secret** to your Vercel environment variables

### 4. Run Database Migration

Apply the payment schema migration:

```bash
supabase db push
```

This creates the following tables:
- `products` - Course products with Stripe references
- `subscription_tiers` - AI trainer subscription plans
- `user_subscriptions` - Active subscriptions
- `purchases` - One-time course purchases
- `stripe_customers` - Supabase to Stripe customer mapping
- `payment_events` - Webhook event log

### 5. Create Products in Stripe

Products and prices need to be created in Stripe and linked to your database.

#### Option A: Via Stripe Dashboard

1. Go to **Products** in Stripe Dashboard
2. Create products for your courses and subscription tiers
3. Create prices for each product
4. Copy the `price_xxx` IDs to your database

#### Option B: Via Admin API (Recommended)

Use the admin API endpoint to create products:

```bash
# Create a course product
curl -X POST http://localhost:3000/api/payments/products \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "name": "Beginner Groundwork Course",
    "description": "Learn essential groundwork techniques",
    "type": "course",
    "priceAmount": 4999,
    "currency": "usd",
    "challengeId": "your-challenge-uuid"
  }'
```

## Architecture

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-checkout-session` | POST | Create Stripe checkout for courses or subscriptions |
| `/api/payments/subscription` | GET | Get current subscription status |
| `/api/payments/subscription` | DELETE | Cancel subscription |
| `/api/payments/subscription` | PATCH | Resume canceled subscription |
| `/api/payments/billing-portal` | POST | Get Stripe billing portal URL |
| `/api/payments/history` | GET | Get purchase history |
| `/api/payments/verify-access/:courseId` | GET | Check if user has course access |
| `/api/payments/products` | GET/POST | List/create products |
| `/api/payments/tiers` | GET/POST | List/create subscription tiers |
| `/api/webhooks/stripe` | POST | Stripe webhook handler |

### React Hooks

```tsx
// Subscription management
const { data } = useSubscription();
const cancel = useCancelSubscription();
const resume = useResumeSubscription();
const portal = useBillingPortal();

// Checkout
const courseCheckout = useCourseCheckout();
const subscriptionCheckout = useSubscriptionCheckout();

// Data fetching
const { data: products } = useProducts();
const { data: tiers } = useSubscriptionTiers();
const { data: history } = usePurchaseHistory();
const { data: access } = useCourseAccess(courseId);
```

### Components

```tsx
import {
  PurchaseButton,      // Buy course button
  CoursePurchaseCard,  // Course card with purchase flow
  SubscriptionCard,    // Subscription tier card
  SubscriptionManager, // Full subscription management UI
  PurchaseHistory,     // Purchase history list
  PaymentSuccess,      // Success confirmation
  PaymentCanceled,     // Canceled payment notice
} from "@/components/payments";
```

### Access Control

Use the payment access middleware to protect routes:

```tsx
import { checkCourseAccess, checkAIAccess, withAIAccess } from "@/lib/middleware/payment-access";

// In API routes
const access = await checkCourseAccess(userId, courseId);
if (!access.hasAccess) {
  return NextResponse.json({ error: access.reason }, { status: 403 });
}

// For AI features
const access = await checkAIAccess(userId, "query");
if (!access.hasAccess) {
  return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
}
```

## Testing

### Test Cards

Stripe provides test card numbers:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 3220` | 3D Secure authentication |

Use any future expiry date and any 3-digit CVC.

### Test Webhooks

```bash
# Trigger a test webhook event
stripe trigger checkout.session.completed

# Listen and forward to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe --events checkout.session.completed,customer.subscription.created
```

## Subscription Tiers

Default tiers (created by migration):

| Tier | Price | Features |
|------|-------|----------|
| Free | $0/mo | 3 AI queries, 1 video analysis |
| Pro Monthly | $19.99/mo | Unlimited AI, 10 videos, priority support |
| Pro Annual | $199.99/yr | Everything in Pro, best value |

## Security Checklist

- [ ] Never expose `STRIPE_SECRET_KEY` to the client
- [ ] Always verify webhook signatures
- [ ] Use HTTPS in production
- [ ] Store webhook secret in environment variables
- [ ] Enable Stripe Radar for fraud protection
- [ ] Set up webhook retry behavior
- [ ] Monitor failed payments in Stripe Dashboard

## Troubleshooting

### Webhook signature verification failed

- Ensure you're using the correct webhook secret
- For local development, use the secret from `stripe listen` output
- For production, use the secret from Stripe Dashboard

### Checkout session not creating

- Verify products have valid Stripe price IDs
- Check that the user is authenticated
- Ensure the product is active (`is_active: true`)

### Subscription not updating

- Check webhook logs in Stripe Dashboard
- Verify webhook endpoint is receiving events
- Check `payment_events` table for errors

## Support

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Discord](https://discord.gg/stripe)
- [Stripe API Reference](https://stripe.com/docs/api)
