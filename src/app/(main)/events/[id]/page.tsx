import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventRsvp } from "@/components/events/event-rsvp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { Calendar, MapPin, Users, DollarSign, ArrowLeft } from "lucide-react";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user is admin
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };
    isAdmin = profile?.role === "admin";
  }

  const { data: event } = await supabase
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
    .single() as { data: any };

  if (!event) {
    notFound();
  }

  // Check if event is draft - only admins can view draft events
  const isDraft = event.status === "draft" || event.is_published === false;
  if (isDraft && !isAdmin) {
    notFound();
  }

  const goingRsvps = event.event_rsvps.filter((r: any) => r.status === "going");
  const interestedRsvps = event.event_rsvps.filter(
    (r: any) => r.status === "interested"
  );
  const userRsvp = user
    ? event.event_rsvps.find((r: any) => r.user_id === user.id)
    : null;

  const hostInitials = event.profiles.display_name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/events">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
      </Link>

      {/* Draft indicator for admins */}
      {isDraft && isAdmin && (
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-yellow-500 text-black">Draft</Badge>
            <span className="text-sm text-yellow-200">This event is not yet published. Only admins can see it.</span>
          </div>
          <Link href={`/admin/events/${event.id}/edit`}>
            <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20">
              Edit & Publish
            </Button>
          </Link>
        </div>
      )}

      {event.banner_image_url && (
        <img
          src={event.banner_image_url}
          alt=""
          className="w-full h-64 md:h-80 object-cover rounded-lg mb-6"
        />
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div>
            <Badge variant="outline" className="mb-2">
              {event.event_type.replace("_", " ")}
            </Badge>
            <h1 className="text-3xl font-bold">{event.title}</h1>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{formatDateTime(event.start_time)}</p>
                <p className="text-muted-foreground">
                  to {formatDateTime(event.end_time)}
                </p>
              </div>
            </div>

            {(event.location_city ||
              event.location_state ||
              event.location_address) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  {event.location_address && (
                    <p className="font-medium">{event.location_address}</p>
                  )}
                  <p className="text-muted-foreground">
                    {[event.location_city, event.location_state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
            )}

            {event.capacity && (
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{goingRsvps.length} going</p>
                  <p className="text-muted-foreground">
                    {event.capacity} spots total
                  </p>
                </div>
              </div>
            )}

            {event.price_display && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <p className="font-medium">{event.price_display}</p>
              </div>
            )}
          </div>

          <Separator />

          {event.description && (
            <div>
              <h2 className="text-xl font-semibold mb-3">About this event</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {event.description}
              </p>
            </div>
          )}

          <Separator />

          <div>
            <h2 className="text-xl font-semibold mb-3">Host</h2>
            <Link
              href={`/profile/${event.profiles.username}`}
              className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={event.profiles.avatar_url || undefined} />
                <AvatarFallback>{hostInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{event.profiles.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  @{event.profiles.username}
                </p>
              </div>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          {user && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your RSVP</CardTitle>
              </CardHeader>
              <CardContent>
                <EventRsvp
                  eventId={event.id}
                  currentStatus={userRsvp?.status}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Going ({goingRsvps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {goingRsvps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one has RSVP&apos;d yet
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {goingRsvps.slice(0, 10).map((rsvp: any) => {
                    const initials = rsvp.profiles.display_name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <Link
                        key={rsvp.user_id}
                        href={`/profile/${rsvp.profiles.username}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={rsvp.profiles.avatar_url || undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    );
                  })}
                  {goingRsvps.length > 10 && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
                      +{goingRsvps.length - 10}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {interestedRsvps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Interested ({interestedRsvps.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {interestedRsvps.slice(0, 10).map((rsvp: any) => {
                    const initials = rsvp.profiles.display_name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <Link
                        key={rsvp.user_id}
                        href={`/profile/${rsvp.profiles.username}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={rsvp.profiles.avatar_url || undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    );
                  })}
                  {interestedRsvps.length > 10 && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
                      +{interestedRsvps.length - 10}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
