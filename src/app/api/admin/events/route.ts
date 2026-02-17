import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

    // Use admin client to bypass RLS and fetch ALL events
    const adminClient = createAdminClient();
    const { data: events, error } = await adminClient
      .from("events")
      .select(`
        *,
        event_rsvps (user_id, status)
      `)
      .order("start_time", { ascending: false }) as { data: any[]; error: any };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // Get host profiles separately to avoid join issues
    const hostIds = Array.from(new Set(events.map((e: any) => e.host_id)));
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, username, display_name")
      .in("id", hostIds) as { data: any[] };

    const profilesMap = new Map(
      (profiles || []).map((p: any) => [p.id, p])
    );

    // Format events with host info and RSVP count
    const formattedEvents = events.map((event: any) => ({
      ...event,
      host: profilesMap.get(event.host_id) || { username: "unknown", display_name: "Unknown" },
      rsvp_count: (event.event_rsvps || []).filter((r: any) => r.status === "going").length,
      event_rsvps: undefined,
    }));

    return NextResponse.json({ events: formattedEvents });
  } catch (error) {
    console.error("Admin events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
