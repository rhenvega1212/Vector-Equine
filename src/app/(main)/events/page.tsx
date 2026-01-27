import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventsList } from "@/components/events/events-list";
import { EventFilters } from "@/components/events/event-filters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

interface EventsPageProps {
  searchParams: Promise<{ type?: string; date?: string }>;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user can create events
  let canCreateEvents = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, trainer_approved")
      .eq("id", user.id)
      .single() as { data: any };

    canCreateEvents =
      profile?.role === "admin" ||
      (profile?.role === "trainer" && profile?.trainer_approved);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Discover clinics, shows, and meetups near you
          </p>
        </div>
        {canCreateEvents && (
          <Link href="/events/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </Link>
        )}
      </div>

      <EventFilters currentType={params.type} currentDate={params.date} />

      <Suspense fallback={<EventsListSkeleton />}>
        <EventsList
          type={params.type}
          date={params.date}
          userId={user?.id}
        />
      </Suspense>
    </div>
  );
}

function EventsListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 mt-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-card rounded-lg border overflow-hidden">
          <Skeleton className="h-40 w-full" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
