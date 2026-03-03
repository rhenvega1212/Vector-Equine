"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostCard } from "@/components/feed/post-card";
import { CreatePost } from "@/components/feed/create-post";
import { formatDate } from "@/lib/utils";
import { Trophy, Grid3X3, Image as ImageIcon, Play, Heart, MessageCircle, Plus, ChevronDown, ChevronUp, MessagesSquare } from "lucide-react";

interface ProfileTabsProps {
  posts: any[];
  enrollments: any[];
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

function ChallengeActivityPreview({
  challengeId,
  profileUserId,
  currentUserId,
}: {
  challengeId: string;
  profileUserId: string;
  currentUserId?: string;
}) {
  const { data, isLoading } = useQuery<{ posts: any[]; total: number }>({
    queryKey: ["challenge-activity", challengeId, profileUserId],
    queryFn: async () => {
      const res = await fetch(
        `/api/challenges/${challengeId}/activity?user_id=${profileUserId}&limit=5`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-2">Loading activity...</p>;
  }

  const activityPosts = data?.posts ?? [];

  if (activityPosts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No discussion posts in this challenge yet.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {activityPosts.map((post: any) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} hideChallengeBadge />
      ))}
      {(data?.total ?? 0) > 5 && (
        <Link
          href={`/challenges/${challengeId}`}
          className="block text-center text-xs text-cyan-400 hover:text-cyan-300 transition-colors py-1"
        >
          View all {data?.total} posts in this challenge
        </Link>
      )}
    </div>
  );
}

export function ProfileTabs({
  posts,
  enrollments,
  rsvps,
  currentUserId,
  isOwnProfile = false,
  profileUserId,
}: ProfileTabsProps) {
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);

  const challengePostCounts = new Map<string, number>();
  for (const post of posts) {
    if (post.challenge_id) {
      challengePostCounts.set(
        post.challenge_id,
        (challengePostCounts.get(post.challenge_id) ?? 0) + 1
      );
    }
  }

  return (
    <>
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full justify-center gap-4 sm:gap-8 bg-transparent border-y border-cyan-400/20 rounded-none h-14 p-0">
          <TabsTrigger 
            value="posts" 
            className="gap-2 text-xs uppercase tracking-widest font-medium data-[state=active]:text-cyan-400 data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 rounded-none px-4 py-4 data-[state=active]:shadow-none data-[state=active]:bg-transparent bg-transparent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
          <TabsTrigger 
            value="challenges" 
            className="gap-2 text-xs uppercase tracking-widest font-medium data-[state=active]:text-cyan-400 data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 rounded-none px-4 py-4 data-[state=active]:shadow-none data-[state=active]:bg-transparent bg-transparent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Challenges</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          {isOwnProfile && (
            <div className="mb-4 flex justify-center">
              <Button
                onClick={() => setShowCreatePost(true)}
                className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-semibold shadow-lg shadow-cyan-500/25"
              >
                <Plus className="h-4 w-4" />
                Create Post
              </Button>
            </div>
          )}

          {posts.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mb-4">
                <Grid3X3 className="h-10 w-10 text-cyan-400/50" />
              </div>
              <p className="text-lg font-medium text-foreground/80">No posts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isOwnProfile ? "Share your first post!" : "Posts will appear here"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-1">
                {posts.map((post) => {
                  const hasMedia = post.post_media && post.post_media.length > 0;
                  const firstMedia = hasMedia ? post.post_media[0] : null;
                  const isVideo = firstMedia?.media_type === "video";
                  const likesCount = post.post_likes?.length || 0;
                  const commentsCount = post.comments?.length || 0;

                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="relative aspect-square bg-slate-800/50 overflow-hidden group rounded-lg border border-cyan-400/10 hover:border-cyan-400/30 transition-all"
                    >
                      {hasMedia ? (
                        <>
                          {isVideo && firstMedia?.thumbnail_url ? (
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
                            <img
                              src={firstMedia!.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                          {/* Multi-image indicator */}
                          {post.post_media.length > 1 && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-black/70 backdrop-blur-sm rounded-md p-1.5">
                                <ImageIcon className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                          {/* Video indicator */}
                          {isVideo && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-black/70 backdrop-blur-sm rounded-md p-1.5">
                                <Play className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-slate-800 to-slate-900">
                          <p className="text-xs text-muted-foreground line-clamp-4 text-center">
                            {post.content}
                          </p>
                        </div>
                      )}
                      
                      {/* Persistent like count badge */}
                      <div className="absolute bottom-2 left-2">
                        <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                          <Heart className="h-3 w-3 text-red-400 fill-red-400" />
                          <span className="text-xs text-white font-medium">{formatCount(likesCount)}</span>
                        </div>
                      </div>
                      
                      {/* Hover overlay with full stats */}
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-6">
                        <div className="flex items-center gap-1.5">
                          <Heart className="h-5 w-5 text-white fill-white" />
                          <span className="text-white font-semibold">{formatCount(likesCount)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="h-5 w-5 text-white fill-white" />
                          <span className="text-white font-semibold">{formatCount(commentsCount)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="challenges" className="mt-4">
          {enrollments.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mb-4">
                <Trophy className="h-10 w-10 text-cyan-400/50" />
              </div>
              <p className="text-lg font-medium text-foreground/80">No challenges joined yet</p>
              <p className="text-sm text-muted-foreground mt-1">Explore challenges to get started</p>
              <Link 
                href="/challenges"
                className="inline-block mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Browse Challenges →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {enrollments.map((enrollment) => {
                const cId = enrollment.challenges.id;
                const postCount = challengePostCounts.get(cId) ?? 0;
                const isExpanded = expandedChallenge === cId;

                return (
                  <div key={enrollment.id}>
                    <Card className="bg-slate-800/30 border-cyan-400/10 hover:border-cyan-400/30 hover:bg-slate-800/50 transition-all group">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <Link
                            href={`/challenges/${cId}`}
                            className="shrink-0"
                          >
                            {enrollment.challenges.cover_image_url ? (
                              <img
                                src={enrollment.challenges.cover_image_url}
                                alt=""
                                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-cyan-400/20"
                              />
                            ) : (
                              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-400/20">
                                <Trophy className="h-8 w-8 text-cyan-400/50" />
                              </div>
                            )}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link href={`/challenges/${cId}`}>
                              <h3 className="font-semibold truncate group-hover:text-cyan-400 transition-colors">
                                {enrollment.challenges.title}
                              </h3>
                            </Link>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {enrollment.challenges.difficulty && (
                                <Badge variant="outline" className="text-xs border-cyan-400/30 text-cyan-400">
                                  {enrollment.challenges.difficulty}
                                </Badge>
                              )}
                              {enrollment.completed_at && (
                                <Badge className="text-xs bg-green-500/20 text-green-400 border-green-400/30">
                                  Completed
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <p className="text-xs text-muted-foreground">
                                Enrolled {formatDate(enrollment.enrolled_at)}
                              </p>
                              {postCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedChallenge(isExpanded ? null : cId)
                                  }
                                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                  <MessagesSquare className="h-3 w-3" />
                                  {postCount} {postCount === 1 ? "post" : "posts"}
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded && profileUserId && (
                          <ChallengeActivityPreview
                            challengeId={cId}
                            profileUserId={profileUserId}
                            currentUserId={currentUserId}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

      </Tabs>

      {/* Post Detail Modal */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-slate-900/95 backdrop-blur-xl border-cyan-400/20">
          <DialogHeader className="sr-only">
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="p-4">
              <PostCard post={selectedPost} currentUserId={currentUserId} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Post Dialog (own profile) */}
      {isOwnProfile && (
        <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
          <DialogContent className="max-w-lg p-0 bg-slate-900/95 backdrop-blur-xl border-cyan-400/20">
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
