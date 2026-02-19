import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/admin/impersonate";
import { getHomeFeed, recordHomeFeedSeen } from "@/lib/feed/feed-algorithm";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitExceededResponse,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateCheck = checkRateLimit(`home-feed:${clientId}`, RATE_LIMITS.read);
  if (!rateCheck.success) {
    return rateLimitExceededResponse(rateCheck);
  }

  try {
    const supabase = await createClient();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor") || null;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const result = await getHomeFeed(supabase, effectiveUserId, cursor, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Home feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateCheck = checkRateLimit(
    `home-feed-seen:${clientId}`,
    RATE_LIMITS.write
  );
  if (!rateCheck.success) {
    return rateLimitExceededResponse(rateCheck);
  }

  try {
    const supabase = await createClient();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "items array required" },
        { status: 400 }
      );
    }

    await recordHomeFeedSeen(supabase, effectiveUserId, body.items);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Record home feed seen error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
