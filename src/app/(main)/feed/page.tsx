import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { CreatePost } from "@/components/feed/create-post";
import { Skeleton } from "@/components/ui/skeleton";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="max-w-2xl mx-auto">
      <CreatePost />
      <Suspense fallback={<FeedSkeleton />}>
        <FeedTabs userId={user?.id || ""} />
      </Suspense>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4 mt-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-lg border p-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-20 w-full mt-4" />
          <div className="flex gap-4 mt-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
