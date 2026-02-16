"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingCart, Lock } from "lucide-react";
import { useCourseCheckout, useCourseAccess } from "@/hooks/use-payment";
import { formatPrice } from "@/lib/stripe/types";
import { cn } from "@/lib/utils";

interface PurchaseButtonProps {
  productId: string;
  challengeId?: string;
  price: number;
  currency?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  showPrice?: boolean;
  children?: React.ReactNode;
}

export function PurchaseButton({
  productId,
  challengeId,
  price,
  currency = "usd",
  className,
  variant = "default",
  size = "default",
  showPrice = true,
  children,
}: PurchaseButtonProps) {
  const checkout = useCourseCheckout();
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    setError(null);
    try {
      await checkout.mutateAsync({ productId, challengeId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        size={size}
        className={cn("gap-2", className)}
        onClick={handlePurchase}
        disabled={checkout.isPending}
      >
        {checkout.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" />
            {children || (showPrice ? `Buy Now - ${formatPrice(price, currency)}` : "Buy Now")}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface CoursePurchaseCardProps {
  productId: string;
  challengeId: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
}

export function CoursePurchaseCard({
  productId,
  challengeId,
  title,
  description,
  price,
  currency = "usd",
}: CoursePurchaseCardProps) {
  const { data: access, isLoading } = useCourseAccess(challengeId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-3/4 mb-2" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
      </div>
    );
  }

  if (access?.hasAccess) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6">
        <div className="flex items-center gap-2 text-green-400 mb-2">
          <Lock className="h-4 w-4" />
          <span className="font-medium">Purchased</span>
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
        {description && <p className="text-sm text-white/60 mt-1">{description}</p>}
        <p className="text-sm text-green-400 mt-2">You have access to this course</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-6">
      <h3 className="font-semibold text-white">{title}</h3>
      {description && <p className="text-sm text-white/60 mt-1">{description}</p>}
      <div className="mt-4">
        <PurchaseButton
          productId={productId}
          challengeId={challengeId}
          price={price}
          currency={currency}
          className="w-full"
        />
      </div>
    </div>
  );
}
