"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Receipt, ShoppingCart, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import { usePurchaseHistory } from "@/hooks/use-payment";
import { formatPrice } from "@/lib/stripe/types";
import { format } from "date-fns";

export function PurchaseHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePurchaseHistory(page);

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
          <p className="text-center text-red-400">Failed to load purchase history</p>
        </CardContent>
      </Card>
    );
  }

  const purchases = data?.purchases || [];
  const subscriptions = data?.subscriptions || [];
  const pagination = data?.pagination;

  const statusColors: Record<string, string> = {
    completed: "bg-green-500/20 text-green-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    failed: "bg-red-500/20 text-red-400",
    refunded: "bg-gray-500/20 text-gray-400",
    active: "bg-green-500/20 text-green-400",
    canceled: "bg-red-500/20 text-red-400",
    past_due: "bg-yellow-500/20 text-yellow-400",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Purchase History
        </CardTitle>
        <CardDescription>View your past purchases and subscriptions</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="purchases" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Purchases
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Subscriptions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="mt-4 space-y-3">
            {purchases.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-white/20 mb-4" />
                <p className="text-white/60">No purchases yet</p>
              </div>
            ) : (
              <>
                {purchases.map((purchase: any) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {purchase.product?.name || "Course Purchase"}
                      </p>
                      <p className="text-sm text-white/60">
                        {format(new Date(purchase.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">
                        {formatPrice(purchase.amount, purchase.currency)}
                      </p>
                      <Badge className={statusColors[purchase.status] || "bg-gray-500/20"}>
                        {purchase.status}
                      </Badge>
                    </div>
                  </div>
                ))}

                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-white/60">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-4 space-y-3">
            {subscriptions.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto text-white/20 mb-4" />
                <p className="text-white/60">No subscription history</p>
              </div>
            ) : (
              subscriptions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5"
                >
                  <div>
                    <p className="font-medium text-white">
                      {sub.tier?.display_name || "Subscription"}
                    </p>
                    <p className="text-sm text-white/60">
                      {format(new Date(sub.created_at), "MMM d, yyyy")}
                      {sub.current_period_end && (
                        <> - Renews {format(new Date(sub.current_period_end), "MMM d, yyyy")}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    {sub.tier?.price_amount > 0 && (
                      <p className="font-medium text-white">
                        {formatPrice(sub.tier.price_amount, sub.tier.currency)}/{sub.tier.interval}
                      </p>
                    )}
                    <Badge className={statusColors[sub.status] || "bg-gray-500/20"}>
                      {sub.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
