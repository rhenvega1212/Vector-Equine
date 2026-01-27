import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEventSchema } from "@/lib/validations/event";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("events")
      .select(`
        *,
        profiles!events_host_id_fkey (id, username, display_name, avatar_url),
        event_rsvps (user_id, status)
      `)
      .eq("is_published", true)
      .gte("end_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .range(offset, offset + limit - 1);

    if (type && type !== "all") {
      query = query.eq("event_type", type);
    }

    const { data: events, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user can create events
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, trainer_approved")
      .eq("id", user.id)
      .single() as { data: any };

    if (
      profile?.role !== "admin" &&
      !(profile?.role === "trainer" && profile?.trainer_approved)
    ) {
      return NextResponse.json(
        { error: "Not authorized to create events" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createEventSchema.parse(body);

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        host_id: user.id,
        ...validatedData,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
