"use client";

import { Sparkles, Zap, CheckCircle, ArrowRight } from "lucide-react";
import { SubscriptionCard } from "@/components/payments";
import { useSubscriptionTiers, useProducts } from "@/hooks/use-payment";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PricingPage() {
  const { data: tiers, isLoading: tiersLoading } = useSubscriptionTiers();
  const { data: products, isLoading: productsLoading } = useProducts("course");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0f2847]">
      {/* Hero Section */}
      <div className="relative py-16 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-blue-300">AI-Powered Horse Training</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Unlock the full potential of AI-assisted equestrian training. From video analysis
            to personalized coaching, find the plan that fits your goals.
          </p>
        </div>
      </div>

      {/* Subscription Tiers */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-400" />
          AI Horse Trainer Subscriptions
        </h2>

        {tiersLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {tiers?.map((tier, index) => (
              <SubscriptionCard
                key={tier.id}
                tier={tier}
                isPopular={index === 1} // Middle tier is popular
              />
            ))}
          </div>
        )}
      </div>

      {/* Features Comparison */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-6">What&apos;s Included</h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
                Free Features
              </h4>
              <ul className="space-y-3">
                {[
                  "Access to community challenges",
                  "Basic progress tracking",
                  "Social feed and events",
                  "3 AI coaching queries/month",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
                Pro Features
              </h4>
              <ul className="space-y-3">
                {[
                  "Unlimited AI coaching queries",
                  "Video analysis feedback",
                  "Personalized training plans",
                  "Priority support",
                  "Access to premium courses",
                  "Detailed progress analytics",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80">
                    <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Course Catalog Section */}
      {products && products.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold text-white mb-8">Premium Courses</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-blue-500/30 transition-colors"
              >
                <h3 className="font-semibold text-white mb-2">{product.name}</h3>
                <p className="text-sm text-white/60 mb-4 line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-white">
                    ${(product.price_amount / 100).toFixed(2)}
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/challenges/${(product as any).challenge?.id}`}>
                      View Course
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">
          Frequently Asked Questions
        </h2>
        
        <div className="space-y-4">
          {[
            {
              q: "Can I cancel my subscription anytime?",
              a: "Yes! You can cancel at any time. Your access will continue until the end of your billing period.",
            },
            {
              q: "What payment methods do you accept?",
              a: "We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.",
            },
            {
              q: "Is there a free trial?",
              a: "New users start with our free tier which includes 3 AI coaching queries per month. Upgrade anytime to unlock more features.",
            },
            {
              q: "What happens to my data if I downgrade?",
              a: "Your data is always safe. If you downgrade, you'll keep access to all your progress and content, but premium features will be limited.",
            },
          ].map((faq, i) => (
            <div
              key={i}
              className="bg-white/5 rounded-xl p-6 border border-white/10"
            >
              <h3 className="font-medium text-white mb-2">{faq.q}</h3>
              <p className="text-sm text-white/60">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
