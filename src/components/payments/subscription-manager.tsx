"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, CreditCard, AlertTriangle, ExternalLink, Sparkles } from "lucide-react";
import {
  useSubscription,
  useCancelSubscription,
  useResumeSubscription,
  useBillingPortal,
} from "@/hooks/use-payment";
import { formatPrice } from "@/lib/stripe/types";
import { format } from "date-fns";

export function SubscriptionManager() {
  const { data: subscription, isLoading, error } = useSubscription();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();
  const billingPortal = useBillingPortal();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-red-400">Failed to load subscription</p>
        </CardContent>
      </Card>
    );
  }

  const tier = subscription?.tier;
  const usage = subscription?.usage;
  const isActive = subscription?.hasActiveSubscription;
  const isCanceling = subscription?.subscription?.cancelAtPeriodEnd;

  const aiUsagePercent = usage?.aiQueriesLimit
    ? (usage.aiQueriesUsed / usage.aiQueriesLimit) * 100
    : 0;
  const videoUsagePercent = usage?.videoAnalysesLimit
    ? (usage.videoAnalysesUsed / usage.videoAnalysesLimit) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-400" />
                {tier?.display_name || "Free"}
                {isActive && tier?.price_amount > 0 && (
                  <Badge variant="outline" className="ml-2">
                    Active
                  </Badge>
                )}
                {isCanceling && (
                  <Badge variant="destructive" className="ml-2">
                    Canceling
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {tier?.description || "Basic access to Vector Equine features"}
              </CardDescription>
            </div>
            {tier?.price_amount > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {formatPrice(tier.price_amount, tier.currency)}
                </div>
                <div className="text-sm text-white/60">/{tier.interval}</div>
              </div>
            )}
          </div>
        </CardHeader>

        {isActive && subscription?.subscription && (
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">Current period ends</span>
                <span className="text-sm font-medium text-white">
                  {format(new Date(subscription.subscription.currentPeriodEnd), "MMMM d, yyyy")}
                </span>
              </div>
              {isCanceling && (
                <p className="text-sm text-yellow-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Your subscription will end on this date
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage */}
      {usage && (usage.aiQueriesLimit || usage.videoAnalysesLimit) && (
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>Your current usage and limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {usage.aiQueriesLimit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">AI Queries</span>
                  <span className="text-white/60">
                    {usage.aiQueriesUsed} / {usage.aiQueriesLimit}
                  </span>
                </div>
                <Progress value={aiUsagePercent} className="h-2" />
              </div>
            )}
            {usage.videoAnalysesLimit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">Video Analyses</span>
                  <span className="text-white/60">
                    {usage.videoAnalysesUsed} / {usage.videoAnalysesLimit}
                  </span>
                </div>
                <Progress value={videoUsagePercent} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tier?.price_amount > 0 && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => billingPortal.mutate()}
              disabled={billingPortal.isPending}
            >
              {billingPortal.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Manage Billing
                  <ExternalLink className="h-3 w-3" />
                </>
              )}
            </Button>
          )}

          {isActive && tier?.price_amount > 0 && !isCanceling && (
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Cancel Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Subscription?</DialogTitle>
                  <DialogDescription>
                    Your subscription will remain active until the end of your current billing
                    period. After that, you&apos;ll lose access to premium features.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setShowCancelDialog(false)}>
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      cancelSubscription.mutate(false);
                      setShowCancelDialog(false);
                    }}
                    disabled={cancelSubscription.isPending}
                  >
                    {cancelSubscription.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Cancel at Period End"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {isCanceling && (
            <Button
              variant="default"
              className="w-full"
              onClick={() => resumeSubscription.mutate()}
              disabled={resumeSubscription.isPending}
            >
              {resumeSubscription.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Resume Subscription"
              )}
            </Button>
          )}

          {!isActive && (
            <div className="text-center">
              <p className="text-sm text-white/60 mb-4">
                Upgrade to unlock premium features like unlimited AI coaching and video analysis.
              </p>
              <Button
                variant="default"
                className="bg-blue-500 hover:bg-blue-600"
                onClick={() => (window.location.href = "/pricing")}
              >
                View Plans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
