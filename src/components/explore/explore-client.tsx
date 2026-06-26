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
import {
  Search,
  Users,
  Loader2,
  TrendingUp,
  Heart,
  MessageCircle,
} from "lucide-react";
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
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [selectedPost, setSelectedPost] = useState<any>(null);

  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

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

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (cursorVal) params.set("cursor", cursorVal);

        const res = await fetch(`/api/explore/feed?${params}`);
        const data = await res.json();

        if (data.items) {
          setItems((prev) =>
            append ? [...prev, ...data.items] : data.items
          );

          fetch("/api/explore/feed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: data.items }),
          }).catch(() => {});
        }
      } catch {
        // fail silently
      } finally {
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

  const applyLikeChange = useCallback(
    (postId: string, liked: boolean) => {
      const syncLikes = (likes: { user_id: string }[] | undefined) => {
        const next = (likes ?? []).filter((l) => l.user_id !== userId);
        if (liked) next.push({ user_id: userId });
        return next;
      };
      setTrendingPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, post_likes: syncLikes(p.post_likes) } : p
        )
      );
      setSelectedPost((prev: any) =>
        prev && prev.id === postId
          ? { ...prev, post_likes: syncLikes(prev.post_likes) }
          : prev
      );
    },
    [userId]
  );

  const accountItems = items.filter((i) => i.type === "account_suggestion");

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 pb-8">
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
            className="bg-muted/30 border-border"
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
                    className="group relative rounded-xl overflow-hidden border border-border bg-muted/30 hover:border-amber-400/30 hover:bg-muted/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-left"
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

      {/* Suggested for you (bottom section) */}
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
                    <span className="absolute top-2 right-20 text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                      {item.reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                onLikeChange={applyLikeChange}
                onDeleted={(postId) => {
                  setTrendingPosts((prev) =>
                    prev.filter((p) => p.id !== postId)
                  );
                  setSelectedPost(null);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
