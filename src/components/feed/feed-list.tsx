"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useEffect, useRef, useCallback } from "react";
import { PostCard } from "./post-card";
import { HomeAdCard } from "./home-ad-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

interface FeedListProps {
  type: "feed" | "following" | "explore";
  userId: string;
}

async function fetchHomeFeed(cursor: string | null) {
  const params = new URLSearchParams({ limit: "10" });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/feed/home?${params}`);
  if (!response.ok) throw new Error("Failed to fetch ranked feed");
  return response.json();
}

async function fetchLegacyPosts(type: string, offset: number) {
  const response = await fetch(
    `/api/posts?type=${type}&offset=${offset}&limit=10`
  );
  if (!response.ok) throw new Error("Failed to fetch posts");
  return response.json();
}

function recordSeen(items: any[]) {
  fetch("/api/feed/home", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  }).catch(() => {});
}

export function FeedList({ type, userId }: FeedListProps) {
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();
  const seenRef = useRef(new Set<string>());
  const [rankedFeedFailed, setRankedFeedFailed] = useState(false);

  const useRankedFeed = type === "feed" && !rankedFeedFailed;

  // Home feed: cursor-based ranked feed (with fallback on failure)
  const homeQuery = useInfiniteQuery({
    queryKey: ["home-feed"],
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchHomeFeed(pageParam);
      } catch {
        setRankedFeedFailed(true);
        throw new Error("Ranked feed unavailable");
      }
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
    enabled: useRankedFeed,
    retry: false,
  });

  // Legacy/fallback feed: offset-based chronological
  const legacyQuery = useInfiniteQuery({
    queryKey: ["feed", rankedFeedFailed ? "feed" : type],
    queryFn: ({ pageParam }) =>
      fetchLegacyPosts(rankedFeedFailed ? "feed" : type, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.posts.length < 10) return undefined;
      return allPages.length * 10;
    },
    initialPageParam: 0,
    enabled: !useRankedFeed,
  });

  const activeQuery = useRankedFeed ? homeQuery : legacyQuery;

  useEffect(() => {
    if (inView && activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
      activeQuery.fetchNextPage();
    }
  }, [inView, activeQuery.hasNextPage, activeQuery.isFetchingNextPage, activeQuery.fetchNextPage]);

  const onItemVisible = useCallback(
    (items: any[]) => {
      if (!useRankedFeed) return;
      const unseen = items.filter((i) => !seenRef.current.has(i.id));
      if (unseen.length === 0) return;
      for (const i of unseen) seenRef.current.add(i.id);
      recordSeen(unseen);
    },
    [useRankedFeed]
  );

  useEffect(() => {
    if (!useRankedFeed || !homeQuery.data) return;
    const lastPage = homeQuery.data.pages[homeQuery.data.pages.length - 1];
    if (lastPage?.items) {
      onItemVisible(lastPage.items);
    }
  }, [useRankedFeed, homeQuery.data?.pages.length, onItemVisible]);

  // If ranked feed returns empty on first page, fall back to legacy so existing posts always show
  useEffect(() => {
    if (!homeQuery.data?.pages.length) return;
    const firstPage = homeQuery.data.pages[0];
    const firstPageItems = firstPage?.items ?? [];
    if (firstPageItems.length === 0) {
      setRankedFeedFailed(true);
    }
  }, [homeQuery.data?.pages]);

  if (activeQuery.isLoading) {
    return (
      <div className="space-y-4">
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
          </div>
        ))}
      </div>
    );
  }

  if (activeQuery.isError && !rankedFeedFailed) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground mb-4">Failed to load feed</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  // Render ranked home feed
  if (useRankedFeed && homeQuery.data) {
    const allItems =
      homeQuery.data?.pages.flatMap((page) => page.items) || [];

    if (allItems.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              No posts yet. Follow some riders or be the first to share!
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {allItems.map((item: any) => {
          if (item.type === "ad") {
            return <HomeAdCard key={item.id} ad={item.ad} />;
          }

          const isSuggested = item.source === "suggested";
          return (
            <PostCard
              key={item.id}
              post={item.post}
              currentUserId={userId}
              isSuggested={isSuggested}
              onFollowSuccess={() =>
                queryClient.invalidateQueries({ queryKey: ["home-feed"] })
              }
            />
          );
        })}

        <div ref={ref} className="py-4 flex justify-center">
          {homeQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
    );
  }

  // Render legacy/fallback feed (chronological)
  const allPosts = legacyQuery.data?.pages.flatMap((page) => page.posts) || [];
  const followingAuthorIds = new Set<string>(
    legacyQuery.data?.pages.flatMap((p) => p.following_author_ids ?? []) ?? []
  );

  if (allPosts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">
            {type === "following"
              ? "No posts from people you follow yet. Follow some riders to see their posts here!"
              : "No posts yet. Be the first to share!"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {allPosts.map((post: any) => {
        const authorId = post.profiles?.id ?? post.author_id;
        const isSuggested =
          !!userId &&
          !!authorId &&
          authorId !== userId &&
          !followingAuthorIds.has(authorId);
        return (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={userId}
            isSuggested={isSuggested}
            onFollowSuccess={() =>
              queryClient.invalidateQueries({ queryKey: ["feed"] })
            }
          />
        );
      })}

      <div ref={ref} className="py-4 flex justify-center">
        {legacyQuery.isFetchingNextPage && (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
