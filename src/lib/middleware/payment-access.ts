import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: string;
  subscription?: {
    tierName: string;
    currentUsage: {
      aiQueries: number;
      videoAnalyses: number;
    };
    limits: {
      aiQueries: number | null;
      videoAnalyses: number | null;
    };
  } | null;
}

/**
 * Check if a user has access to a specific course/challenge
 */
export async function checkCourseAccess(
  userId: string,
  courseId: string
): Promise<AccessCheckResult> {
  const supabase = await createClient();

  // Check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") {
    return { hasAccess: true };
  }

  // Check if course requires payment
  const { data: product } = await supabase
    .from("products")
    .select("id, price_amount, is_active")
    .eq("challenge_id", courseId)
    .eq("type", "course")
    .single();

  // If no product or free course
  if (!product || product.price_amount === 0) {
    return { hasAccess: true };
  }

  // Check if user has purchased
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("challenge_id", courseId)
    .eq("status", "completed")
    .single();

  if (purchase) {
    return { hasAccess: true };
  }

  return {
    hasAccess: false,
    reason: "Course purchase required",
  };
}

/**
 * Check if a user has access to AI features
 */
export async function checkAIAccess(
  userId: string,
  feature: "query" | "video_analysis" = "query"
): Promise<AccessCheckResult> {
  const supabase = await createClient();

  // Check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") {
    return { hasAccess: true };
  }

  // Get user's subscription
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select(`
      *,
      tier:subscription_tiers(*)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  // If no subscription, default to free tier limits
  if (!subscription) {
    const { data: freeTier } = await supabase
      .from("subscription_tiers")
      .select("*")
      .eq("name", "free")
      .single();

    if (!freeTier) {
      return {
        hasAccess: false,
        reason: "No subscription found",
      };
    }

    // Free tier with default usage of 0
    const tier = freeTier;
    const aiLimit = tier.ai_queries_per_month;
    const videoLimit = tier.video_analysis_per_month;

    if (feature === "query") {
      // For free tier without a subscription record, allow the limit
      if (aiLimit && aiLimit > 0) {
        return {
          hasAccess: true,
          subscription: {
            tierName: tier.display_name || tier.name,
            currentUsage: { aiQueries: 0, videoAnalyses: 0 },
            limits: { aiQueries: aiLimit, videoAnalyses: videoLimit },
          },
        };
      }
    }

    if (feature === "video_analysis") {
      if (videoLimit && videoLimit > 0) {
        return {
          hasAccess: true,
          subscription: {
            tierName: tier.display_name || tier.name,
            currentUsage: { aiQueries: 0, videoAnalyses: 0 },
            limits: { aiQueries: aiLimit, videoAnalyses: videoLimit },
          },
        };
      }
    }

    return {
      hasAccess: false,
      reason: "Feature not available on free tier",
    };
  }

  const tier = subscription.tier as any;
  const aiLimit = tier?.ai_queries_per_month;
  const videoLimit = tier?.video_analysis_per_month;

  const currentUsage = {
    aiQueries: subscription.ai_queries_used || 0,
    videoAnalyses: subscription.video_analyses_used || 0,
  };

  // Check specific feature limits
  if (feature === "query") {
    if (aiLimit === null) {
      // Unlimited
      return {
        hasAccess: true,
        subscription: {
          tierName: tier?.display_name || tier?.name || "Unknown",
          currentUsage,
          limits: { aiQueries: null, videoAnalyses: videoLimit },
        },
      };
    }

    if (currentUsage.aiQueries >= aiLimit) {
      return {
        hasAccess: false,
        reason: `AI query limit reached (${aiLimit} per month)`,
        subscription: {
          tierName: tier?.display_name || tier?.name || "Unknown",
          currentUsage,
          limits: { aiQueries: aiLimit, videoAnalyses: videoLimit },
        },
      };
    }
  }

  if (feature === "video_analysis") {
    if (videoLimit === null) {
      // Unlimited
      return {
        hasAccess: true,
        subscription: {
          tierName: tier?.display_name || tier?.name || "Unknown",
          currentUsage,
          limits: { aiQueries: aiLimit, videoAnalyses: null },
        },
      };
    }

    if (currentUsage.videoAnalyses >= videoLimit) {
      return {
        hasAccess: false,
        reason: `Video analysis limit reached (${videoLimit} per month)`,
        subscription: {
          tierName: tier?.display_name || tier?.name || "Unknown",
          currentUsage,
          limits: { aiQueries: aiLimit, videoAnalyses: videoLimit },
        },
      };
    }
  }

  return {
    hasAccess: true,
    subscription: {
      tierName: tier?.display_name || tier?.name || "Unknown",
      currentUsage,
      limits: { aiQueries: aiLimit, videoAnalyses: videoLimit },
    },
  };
}

/**
 * Increment AI usage counter
 */
export async function incrementAIUsage(
  userId: string,
  feature: "query" | "video_analysis"
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Get current subscription
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("id, ai_queries_used, video_analyses_used")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!subscription) return;

  if (feature === "query") {
    await supabase
      .from("user_subscriptions")
      .update({ ai_queries_used: (subscription.ai_queries_used || 0) + 1 })
      .eq("id", subscription.id);
  } else {
    await supabase
      .from("user_subscriptions")
      .update({ video_analyses_used: (subscription.video_analyses_used || 0) + 1 })
      .eq("id", subscription.id);
  }
}

/**
 * Higher-order function to wrap API routes with course access check
 */
export function withCourseAccess(
  handler: (request: NextRequest, context: any, userId: string) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { params: { courseId: string } }) => {
    const supabase = await createClient();
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courseId = context.params.courseId;
    const access = await checkCourseAccess(user.id, courseId);

    if (!access.hasAccess) {
      return NextResponse.json(
        { error: access.reason || "Access denied", requiresPurchase: true },
        { status: 403 }
      );
    }

    return handler(request, context, user.id);
  };
}

/**
 * Higher-order function to wrap API routes with AI access check
 */
export function withAIAccess(
  feature: "query" | "video_analysis",
  handler: (request: NextRequest, userId: string, access: AccessCheckResult) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const supabase = await createClient();
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkAIAccess(user.id, feature);

    if (!access.hasAccess) {
      return NextResponse.json(
        {
          error: access.reason || "Access denied",
          requiresUpgrade: true,
          subscription: access.subscription,
        },
        { status: 403 }
      );
    }

    return handler(request, user.id, access);
  };
}
