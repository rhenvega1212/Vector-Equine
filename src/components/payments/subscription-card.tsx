"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Sparkles, Crown, Zap } from "lucide-react";
import { useSubscriptionCheckout, useSubscription } from "@/hooks/use-payment";
import { formatPrice, formatInterval } from "@/lib/stripe/types";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/lib/stripe/types";

interface SubscriptionCardProps {
  tier: SubscriptionTier;
  isPopular?: boolean;
  className?: string;
}

export function SubscriptionCard({ tier, isPopular, className }: SubscriptionCardProps) {
  const checkout = useSubscriptionCheckout();
  const { data: subscription } = useSubscription();
  const [error, setError] = useState<string | null>(null);

  const isCurrentTier = subscription?.tier?.id === tier.id && subscription?.hasActiveSubscription;
  const isFreeTier = tier.price_amount === 0;

  const handleSubscribe = async () => {
    setError(null);
    try {
      await checkout.mutateAsync({ tierId: tier.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subscribe");
    }
  };

  const Icon = isFreeTier ? Zap : isPopular ? Crown : Sparkles;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        isPopular && "border-blue-500/50 shadow-lg shadow-blue-500/10",
        isCurrentTier && "border-green-500/50",
        className
      )}
    >
      {isPopular && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
          Most Popular
        </div>
      )}
      {isCurrentTier && (
        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
          Current Plan
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "p-2 rounded-lg",
            isPopular ? "bg-blue-500/20" : "bg-white/10"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              isPopular ? "text-blue-400" : "text-white/60"
            )} />
          </div>
          <CardTitle className="text-xl">{tier.display_name}</CardTitle>
        </div>
        <CardDescription>{tier.description}</CardDescription>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="mb-6">
          <span className="text-4xl font-bold text-white">
            {isFreeTier ? "Free" : formatPrice(tier.price_amount, tier.currency)}
          </span>
          {!isFreeTier && tier.interval && (
            <span className="text-white/60">
              {formatInterval(tier.interval)}
            </span>
          )}
        </div>

        <ul className="space-y-3">
          {tier.features?.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-white/80">{feature}</span>
            </li>
          ))}
          {tier.ai_queries_per_month !== null && (
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-white/80">
                {tier.ai_queries_per_month === null
                  ? "Unlimited AI queries"
                  : `${tier.ai_queries_per_month} AI queries/month`}
              </span>
            </li>
          )}
          {tier.video_analysis_per_month !== null && (
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-white/80">
                {tier.video_analysis_per_month === null
                  ? "Unlimited video analysis"
                  : `${tier.video_analysis_per_month} video analyses/month`}
              </span>
            </li>
          )}
          {tier.priority_support && (
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-white/80">Priority support</span>
            </li>
          )}
        </ul>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          variant={isPopular ? "default" : "outline"}
          className={cn(
            "w-full",
            isPopular && "bg-blue-500 hover:bg-blue-600"
          )}
          onClick={handleSubscribe}
          disabled={checkout.isPending || isCurrentTier}
        >
          {checkout.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : isCurrentTier ? (
            "Current Plan"
          ) : isFreeTier ? (
            "Get Started"
          ) : (
            "Subscribe"
          )}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </CardFooter>
    </Card>
  );
}
