import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: messages, error } = await supabase
      .from("suspension_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ messages: messages ?? [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: profile } = (await supabase
      .from("profiles")
      .select("is_suspended")
      .eq("id", user.id)
      .single()) as { data: { is_suspended?: boolean } | null };

    if (!profile?.is_suspended) {
      return NextResponse.json(
        { error: "Your account is not suspended." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    const { data: message, error } = await supabase
      .from("suspension_messages")
      .insert({
        user_id: user.id,
        sender_id: user.id,
        sender_role: "user",
        body: text,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
