import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildClearImpersonateCookie } from "@/lib/admin/impersonate";

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

    // Build redirect URL from the host the browser sees (same fix as impersonate start)
    const host = request.headers.get("host") || new URL(request.url).host;
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      (request.url.startsWith("https") ? "https" : "http");
    const redirectUrl = `${protocol}://${host}/admin/users`;

    const wantsJson =
      request.headers.get("accept")?.includes("application/json") ||
      (request.headers.get("content-type")?.includes("application/json") ?? false);
    if (wantsJson) {
      const res = NextResponse.json({ redirect: redirectUrl }, { status: 200 });
      res.headers.set("Set-Cookie", buildClearImpersonateCookie());
      return res;
    }

    const res = NextResponse.redirect(redirectUrl, { status: 302 });
    res.headers.set("Set-Cookie", buildClearImpersonateCookie());
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
