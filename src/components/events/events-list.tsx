import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { Calendar, MapPin, Users } from "lucide-react";

interface EventsListProps {
  type?: string;
  date?: string;
  userId?: string;
}

export async function EventsList({ type, date, userId }: EventsListProps) {
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select(`
      *,
      profiles!events_host_id_fkey (id, username, display_name, avatar_url),
      event_rsvps (user_id, status)
    `)
    .eq("is_published", true)
    .gte("end_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  // Filter by type
  if (type && type !== "all") {
    query = query.eq("event_type", type);
  }

  // Filter by date
  if (date) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (date) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        query = query.gte("start_time", startDate.toISOString()).lte("start_time", endDate.toISOString());
        break;
      case "this_week":
        startDate = new Date(now);
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 7);
        query = query.gte("start_time", startDate.toISOString()).lte("start_time", endDate.toISOString());
        break;
      case "this_month":
        startDate = new Date(now);
        endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
        query = query.gte("start_time", startDate.toISOString()).lte("start_time", endDate.toISOString());
        break;
    }
  }

  const { data: events, error } = await query.limit(20);

  if (error) {
    return (
      <Card className="mt-6">
        <CardContent className="py-10 text-center text-muted-foreground">
          Failed to load events
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="py-10 text-center text-muted-foreground">
          No upcoming events found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 mt-6">
      {events.map((event) => {
        const goingCount = event.event_rsvps.filter(
          (r: any) => r.status === "going"
        ).length;
        const userRsvp = userId
          ? event.event_rsvps.find((r: any) => r.user_id === userId)
          : null;

        return (
          <Link key={event.id} href={`/events/${event.id}`}>
            <Card className="overflow-hidden hover:bg-muted/50 transition-colors h-full">
              {event.banner_image_url ? (
                <img
                  src={event.banner_image_url}
                  alt=""
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center">
                  <Calendar className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="text-xs">
                    {event.event_type.replace("_", " ")}
                  </Badge>
                  {userRsvp && (
                    <Badge
                      variant={
                        userRsvp.status === "going" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {userRsvp.status}
                    </Badge>
                  )}
                </div>

                <h3 className="font-semibold mt-2 line-clamp-2">
                  {event.title}
                </h3>

                <p className="text-sm text-muted-foreground mt-1">
                  Hosted by {event.profiles.display_name}
                </p>

                <div className="space-y-1 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDateTime(event.start_time)}
                  </div>

                  {(event.location_city || event.location_state) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {[event.location_city, event.location_state]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {goingCount} going
                    {event.capacity && ` · ${event.capacity} spots`}
                  </div>
                </div>

                {event.price_display && (
                  <p className="text-sm font-medium mt-3 text-primary">
                    {event.price_display}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
