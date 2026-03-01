"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostCard } from "@/components/feed/post-card";
import { UserCard } from "./user-card";
import { PostGridTile } from "./post-grid-tile";
import { AdCard } from "./ad-card";
import {
  Search,
  Compass,
  Users,
  Loader2,
  LayoutGrid,
  List,
  TrendingUp,
  Heart,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInView } from "react-intersection-observer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ExploreItem = {
  type: "post" | "ad" | "account_suggestion";
  id: string;
  post?: any;
  ad?: any;
  account?: any;
  reason?: string;
  source?: "suggested" | "nearby" | "trending" | "admin";
};

interface ExploreClientProps {
  userId: string;
}

export function ExploreClient({ userId }: ExploreClientProps) {
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const { ref: sentinelRef, inView } = useInView({ threshold: 0 });
  const loadingRef = useRef(false);

  const fetchSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/explore/users?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSearch(searchQ), 300);
    return () => clearTimeout(t);
  }, [searchQ, fetchSearch]);

  const loadFeed = useCallback(
    async (cursorVal: string | null, append: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (cursorVal) params.set("cursor", cursorVal);

        const res = await fetch(`/api/explore/feed?${params}`);
        const data = await res.json();

        if (data.items) {
          setItems((prev) =>
            append ? [...prev, ...data.items] : data.items
          );
          setCursor(data.nextCursor);
          setHasMore(data.hasMore);

          fetch("/api/explore/feed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: data.items }),
          }).catch(() => {});
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    loadFeed(null, false);
  }, [loadFeed]);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/explore/trending?limit=12");
        const data = await res.json();
        setTrendingPosts(data.posts ?? []);
      } catch {
        setTrendingPosts([]);
      } finally {
        setTrendingLoading(false);
      }
    }
    fetchTrending();
  }, []);

  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      loadFeed(cursor, true);
    }
  }, [inView, hasMore, loading, loadingMore, cursor, loadFeed]);

  // Separate items by type for rendering
  const postItems = items.filter((i) => i.type === "post");
  const accountItems = items.filter((i) => i.type === "account_suggestion");

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Search riders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name or @username..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="bg-white/5 border-white/10"
          />
          {searchLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}
          {searchQ.length >= 2 && !searchLoading && (
            <div className="space-y-2">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No users found for &quot;{searchQ}&quot;
                </p>
              ) : (
                searchResults.map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    currentUserId={userId}
                    onFollowSuccess={() =>
                      setFollowingIds((prev) => new Set(prev).add(u.id))
                    }
                  />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested accounts (top section) */}
      {accountItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Suggested for you
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accountItems.map((item) => (
                <div key={item.id} className="relative">
                  <UserCard
                    user={item.account}
                    currentUserId={userId}
                    onFollowSuccess={() =>
                      setFollowingIds((prev) =>
                        new Set(prev).add(item.account.id)
                      )
                    }
                  />
                  {item.reason && item.reason !== "Suggested for you" && (
                    <span className="absolute top-2 right-20 text-[10px] text-cyan-400/80 bg-cyan-400/10 px-1.5 py-0.5 rounded-full">
                      {item.reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explore feed - unified grid/list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Compass className="h-5 w-5" />
              Explore
            </CardTitle>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                className="h-8 w-8 p-0"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                className="h-8 w-8 p-0"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Trending, team picks, and posts from the feed to discover
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            )
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing to explore right now. Check back later!
            </p>
          ) : viewMode === "grid" ? (
            <GridView
              items={items}
              userId={userId}
              onPostClick={setSelectedPost}
              followingIds={followingIds}
            />
          ) : (
            <ListView
              items={items}
              userId={userId}
              followingIds={followingIds}
              onFollowSuccess={(id) =>
                setFollowingIds((prev) => new Set(prev).add(id))
              }
            />
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && !loading && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-amber-400" />
            Trending
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Popular posts from the community
          </p>
        </CardHeader>
        <CardContent>
          {trendingLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
              ))}
            </div>
          ) : trendingPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No trending posts yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {trendingPosts.map((post) => {
                const firstImage = post.post_media?.find(
                  (m: any) => m.media_type === "image"
                );
                const likesCount = post.post_likes?.length ?? 0;
                const commentsCount = post.comments?.length ?? 0;
                const initials = post.profiles?.display_name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?";

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPost(post)}
                    className="group relative rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-amber-400/30 hover:bg-white/[0.07] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-left"
                  >
                    <div className={firstImage ? "aspect-[4/5]" : "aspect-[4/5]"}>
                      {firstImage ? (
                        <img
                          src={firstImage.url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900">
                          <p className="text-sm text-white/70 line-clamp-5">
                            {post.content?.slice(0, 120) || "No content"}
                          </p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                      {/* Trending badge */}
                      <span className="absolute top-2 right-2 text-[10px] font-medium text-amber-400 bg-amber-400/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                        Trending
                      </span>

                      {/* Bottom info */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 ring-2 ring-background">
                            <AvatarImage src={post.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate text-white drop-shadow-md">
                            {post.profiles?.display_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-white/80 text-xs">
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3 fill-current text-red-400" />
                            {likesCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {commentsCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post detail modal */}
      <Dialog
        open={!!selectedPost}
        onOpenChange={(open) => !open && setSelectedPost(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogTitle className="sr-only">Post</DialogTitle>
          {selectedPost && (
            <div className="p-4">
              <PostCard
                post={selectedPost}
                currentUserId={userId}
                isSuggested={!followingIds.has(selectedPost.profiles?.id ?? selectedPost.author_id)}
                onFollowSuccess={() => {
                  const id =
                    selectedPost.profiles?.id ?? selectedPost.author_id;
                  if (id)
                    setFollowingIds((prev) => new Set(prev).add(id));
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GridView({
  items,
  userId,
  onPostClick,
  followingIds,
}: {
  items: ExploreItem[];
  userId: string;
  onPostClick: (post: any) => void;
  followingIds: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      {items.map((item) => {
        if (item.type === "post") {
          const badge =
            item.source === "trending"
              ? "trending"
              : item.source === "admin"
                ? "admin"
                : undefined;
          return (
            <PostGridTile
              key={item.id}
              post={item.post}
              onClick={() => onPostClick(item.post)}
              badge={badge}
            />
          );
        }
        if (item.type === "ad") {
          return (
            <div key={item.id} className="col-span-2 sm:col-span-1">
              <AdCard ad={item.ad} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function ListView({
  items,
  userId,
  followingIds,
  onFollowSuccess,
}: {
  items: ExploreItem[];
  userId: string;
  followingIds: Set<string>;
  onFollowSuccess: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        if (item.type === "post") {
          const authorId = item.post?.profiles?.id ?? item.post?.author_id;
          const isTrending = item.source === "trending";
          const isAdmin = item.source === "admin";
          return (
            <div key={item.id} className="relative">
              {(isTrending || isAdmin) && (
                <span
                  className={
                    isTrending
                      ? "absolute top-2 right-2 z-10 text-[10px] font-medium text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded-full"
                      : "absolute top-2 right-2 z-10 text-[10px] font-medium text-cyan-400 bg-cyan-400/20 px-2 py-0.5 rounded-full"
                  }
                >
                  {isTrending ? "Trending" : "From the team"}
                </span>
              )}
              <PostCard
                post={item.post}
                currentUserId={userId}
                isSuggested={!followingIds.has(authorId)}
                onFollowSuccess={() => onFollowSuccess(authorId)}
              />
            </div>
          );
        }
        if (item.type === "ad") {
          return <AdCard key={item.id} ad={item.ad} />;
        }
        if (item.type === "account_suggestion") {
          return (
            <UserCard
              key={item.id}
              user={item.account}
              currentUserId={userId}
              onFollowSuccess={() => onFollowSuccess(item.account.id)}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
