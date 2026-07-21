"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/feed/post-card";
import { CreatePost } from "@/components/feed/create-post";
import { Grid3X3, Image as ImageIcon, Play, Heart, MessageCircle, Plus } from "lucide-react";

interface ProfileTabsProps {
  posts: any[];
  rsvps: any[];
  currentUserId?: string;
  isOwnProfile?: boolean;
  profileUserId?: string;
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return count.toString();
}

export function ProfileTabs({
  posts,
  currentUserId,
  isOwnProfile = false,
}: ProfileTabsProps) {
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visiblePosts = posts.filter((p: any) => !deletedIds.has(p.id));

  return (
    <>
      <div className="w-full border-y border-border">
        <div className="flex justify-center h-12 sm:h-14 items-center gap-2 text-xs uppercase tracking-widest font-medium text-primary border-b-2 border-primary">
          <Grid3X3 className="h-4 w-4" />
          <span>Posts</span>
        </div>
      </div>

      <div className="mt-4">
        {isOwnProfile && (
          <div className="mb-4 flex justify-center">
            <Button
              onClick={() => setShowCreatePost(true)}
              className="gap-2 bg-gold text-navy font-semibold hover:bg-gold/90"
            >
              <Plus className="h-4 w-4" />
              Create Post
            </Button>
          </div>
        )}

        {visiblePosts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Grid3X3 className="h-10 w-10 text-primary/50" />
            </div>
            <p className="text-lg font-medium text-foreground/80">No posts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isOwnProfile ? "Share your first post!" : "Posts will appear here"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
            {visiblePosts.map((post) => {
              const hasMedia = post.post_media && post.post_media.length > 0;
              const firstMedia = hasMedia ? post.post_media[0] : null;
              const isVideo = firstMedia?.media_type === "video";
              const likesCount = post.post_likes?.length || 0;
              const commentsCount = post.comments?.length || 0;

              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="relative aspect-square bg-muted overflow-hidden group rounded-lg border border-border hover:border-primary/30 transition-all"
                >
                  {hasMedia ? (
                    <>
                      {isVideo && firstMedia?.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstMedia.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : isVideo ? (
                        <video
                          src={firstMedia!.url}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstMedia!.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      {post.post_media.length > 1 && (
                        <div className="absolute top-2 right-2">
                          <div className="bg-black/70 backdrop-blur-sm rounded-md p-1.5">
                            <ImageIcon className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                      {isVideo && (
                        <div className="absolute top-2 right-2">
                          <div className="bg-black/70 backdrop-blur-sm rounded-md p-1.5">
                            <Play className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-muted to-muted/80">
                      <p className="text-xs text-muted-foreground line-clamp-4 text-center">
                        {post.content}
                      </p>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2">
                    <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                      <Heart className="h-3 w-3 text-red-400 fill-red-400" />
                      <span className="text-xs text-white font-medium">
                        {formatCount(likesCount)}
                      </span>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-1.5">
                      <Heart className="h-5 w-5 text-white fill-white" />
                      <span className="text-white font-semibold">
                        {formatCount(likesCount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="h-5 w-5 text-white fill-white" />
                      <span className="text-white font-semibold">
                        {formatCount(commentsCount)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-background/95 backdrop-blur-xl border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="p-4">
              <PostCard
                post={selectedPost}
                currentUserId={currentUserId}
                onDeleted={(postId) => {
                  setDeletedIds((prev) => new Set(prev).add(postId));
                  setSelectedPost(null);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isOwnProfile && (
        <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
          <DialogContent className="max-w-lg p-0 bg-background/95 backdrop-blur-xl border-border">
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle>Create Post</DialogTitle>
            </DialogHeader>
            <div className="px-2 pb-2">
              <CreatePost />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
