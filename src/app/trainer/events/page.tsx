import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Plus, Calendar, Users, ArrowLeft } from "lucide-react";

export default async function TrainerEventsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, trainer_approved")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "trainer" || !profile?.trainer_approved) {
    redirect("/feed");
  }

  const { data: events } = await supabase
    .from("events")
    .select(`
      *,
      event_rsvps (id, status)
    `)
    .eq("host_id", user.id)
    .order("start_time", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/feed">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">My Events</h1>
          <p className="text-muted-foreground">
            Manage your hosted events
          </p>
        </div>
        <Link href="/events/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              You haven&apos;t created any events yet.
            </p>
            <Link href="/events/create">
              <Button>Create Your First Event</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const goingCount = event.event_rsvps.filter(
              (r: any) => r.status === "going"
            ).length;
            const isPast = new Date(event.end_time) < new Date();

            return (
              <Link key={event.id} href={`/events/${event.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {event.banner_image_url ? (
                        <img
                          src={event.banner_image_url}
                          alt=""
                          className="w-24 h-24 object-cover rounded"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-muted rounded flex items-center justify-center">
                          <Calendar className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{event.title}</h3>
                          <div className="flex gap-2">
                            {isPast && (
                              <Badge variant="secondary">Past</Badge>
                            )}
                            <Badge
                              variant={event.is_published ? "default" : "outline"}
                            >
                              {event.is_published ? "Published" : "Draft"}
                            </Badge>
                          </div>
                        </div>

                        <Badge variant="outline" className="mt-1 text-xs">
                          {event.event_type.replace("_", " ")}
                        </Badge>

                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDateTime(event.start_time)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {goingCount} going
                            {event.capacity && ` / ${event.capacity}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
