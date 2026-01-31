import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateEventSchema } from "@/lib/validations/event";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: event, error } = await supabase
      .from("events")
      .select(`
        *,
        profiles!events_host_id_fkey (id, username, display_name, avatar_url, bio),
        event_rsvps (
          user_id,
          status,
          profiles!event_rsvps_user_id_fkey (id, username, display_name, avatar_url)
        )
      `)
      .eq("id", id)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user owns the event or is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    const { data: event } = await supabase
      .from("events")
      .select("host_id")
      .eq("id", id)
      .single() as { data: any };

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.host_id !== user.id && profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Not authorized to update this event" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateEventSchema.parse(body);

    // Convert datetime-local format to ISO string for database if provided
    const updateData: any = {
      ...validatedData,
      updated_at: new Date().toISOString(),
    };

    if (validatedData.start_time) {
      updateData.start_time = new Date(validatedData.start_time).toISOString();
    }
    if (validatedData.end_time) {
      updateData.end_time = new Date(validatedData.end_time).toISOString();
    }

    // Validate that end time is after start time if both are provided
    if (updateData.start_time && updateData.end_time) {
      if (new Date(updateData.end_time) <= new Date(updateData.start_time)) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }
    }

    const { data: updatedEvent, error } = await supabase
      .from("events")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(updatedEvent);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user owns the event or is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    const { data: event } = await supabase
      .from("events")
      .select("host_id")
      .eq("id", id)
      .single() as { data: any };

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.host_id !== user.id && profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Not authorized to delete this event" },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
