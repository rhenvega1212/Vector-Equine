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

    const res = NextResponse.redirect(
      new URL("/feed", request.url),
      { status: 302 }
    );
    res.headers.set("Set-Cookie", buildImpersonateCookie(userId));
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
