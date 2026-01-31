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

    // Convert datetime-local format to ISO string for database
    const start_time = new Date(validatedData.start_time).toISOString();
    const end_time = new Date(validatedData.end_time).toISOString();

    // Validate that end time is after start time
    if (new Date(end_time) <= new Date(start_time)) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // Only admins can publish directly, trainers create drafts
    const isAdmin = profile?.role === "admin";
    const status = isAdmin && body.status === "published" ? "published" : "draft";
    const is_published = status === "published";

    const { data: event, error } = await (supabase as any)
      .from("events")
      .insert({
        host_id: user.id,
        ...validatedData,
        start_time,
        end_time,
        status,
        is_published,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return first error message as a string for better UX
      return NextResponse.json(
        { error: error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
