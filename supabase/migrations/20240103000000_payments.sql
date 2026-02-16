-- ============================================================================
-- PAYMENTS & SUBSCRIPTIONS SCHEMA
-- ============================================================================

-- ============================================================================
-- PRODUCTS TABLE (Courses and Subscription Plans)
-- ============================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT UNIQUE,
  stripe_price_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('course', 'subscription')),
  price_amount INTEGER NOT NULL, -- Price in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  -- For subscriptions
  interval TEXT CHECK (interval IN ('month', 'year')),
  interval_count INTEGER DEFAULT 1,
  -- For courses
  challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
  -- Metadata
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_stripe_product_id ON products(stripe_product_id);
CREATE INDEX idx_products_active ON products(is_active);

-- ============================================================================
-- SUBSCRIPTION TIERS TABLE (AI Horse Trainer Plans)
-- ============================================================================
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'free', 'pro_monthly', 'pro_annual'
  display_name TEXT NOT NULL,
  description TEXT,
  stripe_product_id TEXT UNIQUE,
  stripe_price_id TEXT,
  price_amount INTEGER NOT NULL DEFAULT 0, -- Price in cents (0 for free)
  currency TEXT NOT NULL DEFAULT 'usd',
  interval TEXT CHECK (interval IN ('month', 'year')),
  interval_count INTEGER DEFAULT 1,
  features JSONB DEFAULT '[]',
  -- Limits
  ai_queries_per_month INTEGER, -- NULL = unlimited
  video_analysis_per_month INTEGER,
  priority_support BOOLEAN DEFAULT FALSE,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_tiers_name ON subscription_tiers(name);

-- ============================================================================
-- USER SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  -- Usage tracking
  ai_queries_used INTEGER DEFAULT 0,
  video_analyses_used INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE UNIQUE INDEX idx_user_subscriptions_active ON user_subscriptions(user_id) WHERE status = 'active';

-- ============================================================================
-- PURCHASES TABLE (One-time Course Purchases)
-- ============================================================================
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  amount INTEGER NOT NULL, -- Amount paid in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchases_product ON purchases(product_id);
CREATE INDEX idx_purchases_challenge ON purchases(challenge_id);
CREATE INDEX idx_purchases_stripe_payment ON purchases(stripe_payment_intent_id);
CREATE INDEX idx_purchases_status ON purchases(status);

-- ============================================================================
-- STRIPE CUSTOMERS TABLE (Link Supabase users to Stripe)
-- ============================================================================
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_customers_user ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);

-- ============================================================================
-- PAYMENT EVENTS TABLE (Webhook Event Log)
-- ============================================================================
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_events_stripe_id ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_processed ON payment_events(processed);

-- ============================================================================
-- COURSE ACCESS VIEW (Easy way to check if user has access)
-- ============================================================================
CREATE OR REPLACE VIEW user_course_access AS
SELECT 
  p.user_id,
  p.challenge_id,
  p.status as purchase_status,
  p.created_at as purchased_at,
  pr.name as product_name,
  pr.price_amount
FROM purchases p
JOIN products pr ON p.product_id = pr.id
WHERE p.status = 'completed'
  AND p.challenge_id IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user has purchased a course
CREATE OR REPLACE FUNCTION has_purchased_course(p_user_id UUID, p_challenge_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM purchases
    WHERE user_id = p_user_id
      AND challenge_id = p_challenge_id
      AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's subscription tier
CREATE OR REPLACE FUNCTION get_user_subscription_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  tier_name TEXT;
BEGIN
  SELECT st.name INTO tier_name
  FROM user_subscriptions us
  JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
  LIMIT 1;
  
  RETURN COALESCE(tier_name, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Products: Everyone can view active products
CREATE POLICY "Products viewable by everyone"
  ON products FOR SELECT
  USING (is_active = TRUE OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (is_admin(auth.uid()));

-- Subscription Tiers: Everyone can view active tiers
CREATE POLICY "Subscription tiers viewable by everyone"
  ON subscription_tiers FOR SELECT
  USING (is_active = TRUE OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage subscription tiers"
  ON subscription_tiers FOR ALL
  USING (is_admin(auth.uid()));

-- User Subscriptions: Users can view their own, admins can view all
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "System can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (is_admin(auth.uid()));

-- Allow service role to manage subscriptions (for webhooks)
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.uid() IS NULL); -- Service role doesn't have auth.uid()

-- Purchases: Users can view their own, admins can view all
CREATE POLICY "Users can view own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "System can manage purchases"
  ON purchases FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage purchases"
  ON purchases FOR ALL
  USING (auth.uid() IS NULL);

-- Stripe Customers: Users can view their own
CREATE POLICY "Users can view own stripe customer"
  ON stripe_customers FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Service role can manage stripe customers"
  ON stripe_customers FOR ALL
  USING (auth.uid() IS NULL OR is_admin(auth.uid()));

-- Payment Events: Only admins and service role
CREATE POLICY "Admins can view payment events"
  ON payment_events FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage payment events"
  ON payment_events FOR ALL
  USING (auth.uid() IS NULL);

-- ============================================================================
-- SEED DATA: Subscription Tiers
-- ============================================================================
INSERT INTO subscription_tiers (name, display_name, description, price_amount, interval, features, ai_queries_per_month, video_analysis_per_month, priority_support, sort_order) VALUES
  ('free', 'Free', 'Basic access to the AI Horse Trainer', 0, NULL, '["Basic riding tips", "Community access", "Limited AI queries (10/month)"]', 10, 0, FALSE, 0),
  ('pro_monthly', 'Pro Monthly', 'Full access to all AI Horse Trainer features', 1999, 'month', '["Unlimited AI queries", "Video analysis (5/month)", "Personalized training plans", "Priority support"]', NULL, 5, TRUE, 1),
  ('pro_annual', 'Pro Annual', 'Best value - save 20% with annual billing', 19999, 'year', '["Everything in Pro Monthly", "Unlimited video analysis", "Early access to new features", "1-on-1 coaching session"]', NULL, NULL, TRUE, 2);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
