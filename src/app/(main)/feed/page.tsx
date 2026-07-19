import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { CreatePost } from "@/components/feed/create-post";
import { Skeleton } from "@/components/ui/skeleton";
import { getImpersonateCookieName } from "@/lib/admin/impersonate";
import { SOCIAL_CONFIG } from "@/lib/social/config";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single() as { data: { role?: string } | null };

  const cookieStore = await cookies();
  const impersonateId = cookieStore.get(getImpersonateCookieName())?.value;
  const effectiveUserId =
    user && profile?.role === "admin" && impersonateId
      ? impersonateId
      : user?.id ?? "";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Community
        </p>
        <h1 className="font-serif text-2xl">Your barn & connections</h1>
        <p className="text-sm text-muted-foreground">
          {SOCIAL_CONFIG.SOCIAL_MODE === "light"
            ? "A lighter feed from people you follow — not a global town square."
            : "Community"}
        </p>
        {!SOCIAL_CONFIG.COMMUNITY_ENABLED && (
          <p className="text-xs text-muted-foreground">
            Deeper community features stay gated for now.{" "}
            <Link href="/train" className="text-gold hover:text-gold-bright">
              Back to Vector
            </Link>
          </p>
        )}
      </header>
      <CreatePost />
      <Suspense fallback={<FeedSkeleton />}>
        <FeedTabs userId={effectiveUserId} />
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
