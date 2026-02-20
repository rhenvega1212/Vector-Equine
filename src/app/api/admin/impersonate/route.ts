import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getImpersonateCookieName,
  buildImpersonateCookie,
} from "@/lib/admin/impersonate";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: { role?: string } | null };

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    let userId: string | null = null;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      userId = typeof body?.userId === "string" ? body.userId.trim() : null;
    } else {
      const formData = await request.formData();
      userId = (formData.get("userId") as string)?.trim() || null;
    }
    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!target) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Build redirect URL from the host the browser sees (avoids internal URLs that cause "connection refused")
    const host = request.headers.get("host") || new URL(request.url).host;
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      (request.url.startsWith("https") ? "https" : "http");
    const baseUrl = `${protocol}://${host}`;
    const redirectUrl = `${baseUrl}/feed`;

    // If client expects JSON (e.g. fetch), return 200 + redirect URL so they can navigate client-side
    const wantsJson =
      request.headers.get("accept")?.includes("application/json") ||
      (request.headers.get("content-type")?.includes("application/json") ?? false);
    if (wantsJson) {
      const res = NextResponse.json({ redirect: redirectUrl }, { status: 200 });
      res.headers.set("Set-Cookie", buildImpersonateCookie(userId));
      return res;
    }

    const res = NextResponse.redirect(redirectUrl, { status: 302 });
    res.headers.set("Set-Cookie", buildImpersonateCookie(userId));
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
