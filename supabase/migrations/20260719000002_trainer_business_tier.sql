-- Brief-07 STEP F: Trainer Business subscription tier (price TBD; stripe_price_id null until configured)
INSERT INTO subscription_tiers (
  name,
  display_name,
  description,
  price_amount,
  interval,
  features,
  ai_queries_per_month,
  video_analysis_per_month,
  priority_support,
  sort_order,
  is_active
)
SELECT
  'trainer_business',
  'Trainer Business',
  'Unlimited roster, multi-client dashboard, cross-client analytics, and branded client reports. Price TBD.',
  4900,
  'month',
  '["Unlimited rider roster", "Multi-client dashboard", "Cross-client analytics", "Branded PDF client reports", "Bulk homework / plan assignment"]'::jsonb,
  NULL,
  NULL,
  TRUE,
  10,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_tiers WHERE name = 'trainer_business'
);
