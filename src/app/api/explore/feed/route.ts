import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/admin/impersonate";
import { getExploreFeed, recordSeenItems } from "@/lib/explore/feed-algorithm";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitExceededResponse,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateCheck = checkRateLimit(`explore:${clientId}`, RATE_LIMITS.read);
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
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await getExploreFeed(
      supabase,
      effectiveUserId,
      cursor,
      limit
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Explore feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateCheck = checkRateLimit(`explore-seen:${clientId}`, RATE_LIMITS.write);
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

    await recordSeenItems(supabase, effectiveUserId, body.items);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Record seen error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
