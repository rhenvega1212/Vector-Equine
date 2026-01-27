import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: events, error } = await supabase
      .from("events")
      .select(`
        *,
        profiles!events_host_id_fkey (username, display_name),
        event_rsvps (id, status)
      `)
      .order("start_time", { ascending: false }) as { data: any[]; error: any };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Format events with host info and RSVP count
    const formattedEvents = events.map((event: any) => ({
      ...event,
      host: event.profiles,
      rsvp_count: event.event_rsvps.filter((r: any) => r.status === "going").length,
      profiles: undefined,
      event_rsvps: undefined,
    }));

    return NextResponse.json({ events: formattedEvents });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
