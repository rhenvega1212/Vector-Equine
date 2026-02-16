"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { redirectToCheckout } from "@/lib/stripe/client";
import type {
  Product,
  SubscriptionTier,
  UserSubscription,
  Purchase,
} from "@/lib/stripe/types";

// ============================================
// SUBSCRIPTION HOOKS
// ============================================

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const response = await fetch("/api/payments/subscription");
      if (!response.ok) throw new Error("Failed to fetch subscription");
      return response.json();
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (immediate: boolean = false) => {
      const response = await fetch(
        `/api/payments/subscription${immediate ? "?immediate=true" : ""}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/payments/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resume subscription");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

// ============================================
// CHECKOUT HOOKS
// ============================================

export function useCourseCheckout() {
  return useMutation({
    mutationFn: async ({
      productId,
      challengeId,
    }: {
      productId: string;
      challengeId?: string;
    }) => {
      const response = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          challengeId,
          type: "course",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const { url, sessionId } = await response.json();
      
      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else if (sessionId) {
        await redirectToCheckout(sessionId);
      }
    },
  });
}

export function useSubscriptionCheckout() {
  return useMutation({
    mutationFn: async ({ tierId }: { tierId: string }) => {
      const response = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId,
          type: "subscription",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const data = await response.json();
      
      // Handle free tier activation
      if (data.success && data.message) {
        return data;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        await redirectToCheckout(data.sessionId);
      }

      return data;
    },
  });
}

// ============================================
// BILLING PORTAL
// ============================================

export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/payments/billing-portal", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create billing portal session");
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    },
  });
}

// ============================================
// PRODUCTS & TIERS
// ============================================

export function useProducts(type?: "course" | "subscription") {
  return useQuery({
    queryKey: ["products", type],
    queryFn: async () => {
      const url = type
        ? `/api/payments/products?type=${type}`
        : "/api/payments/products";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      return data.products as Product[];
    },
  });
}

export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ["subscription-tiers"],
    queryFn: async () => {
      const response = await fetch("/api/payments/tiers");
      if (!response.ok) throw new Error("Failed to fetch tiers");
      const data = await response.json();
      return data.tiers as SubscriptionTier[];
    },
  });
}

// ============================================
// PURCHASE HISTORY & ACCESS
// ============================================

export function usePurchaseHistory(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["purchase-history", page, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/payments/history?page=${page}&limit=${limit}`
      );
      if (!response.ok) throw new Error("Failed to fetch purchase history");
      return response.json();
    },
  });
}

export function useCourseAccess(courseId: string) {
  return useQuery({
    queryKey: ["course-access", courseId],
    queryFn: async () => {
      const response = await fetch(`/api/payments/verify-access/${courseId}`);
      if (!response.ok) throw new Error("Failed to verify access");
      return response.json();
    },
    enabled: !!courseId,
  });
}
