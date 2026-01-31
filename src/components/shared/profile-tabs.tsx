"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostCard } from "@/components/feed/post-card";
import { formatDate } from "@/lib/utils";
import { Calendar, Trophy, Grid3X3, Image, Play, Heart, MessageCircle } from "lucide-react";

interface ProfileTabsProps {
  posts: any[];
  enrollments: any[];
  rsvps: any[];
  currentUserId?: string;
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
  enrollments,
  rsvps,
  currentUserId,
}: ProfileTabsProps) {
  const [selectedPost, setSelectedPost] = useState<any>(null);

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
          <TabsTrigger 
            value="events" 
            className="gap-2 text-xs uppercase tracking-widest font-medium data-[state=active]:text-cyan-400 data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 rounded-none px-4 py-4 data-[state=active]:shadow-none data-[state=active]:bg-transparent bg-transparent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Events</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          {posts.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mb-4">
                <Grid3X3 className="h-10 w-10 text-cyan-400/50" />
              </div>
              <p className="text-lg font-medium text-foreground/80">No posts yet</p>
              <p className="text-sm text-muted-foreground mt-1">Posts will appear here</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4 text-center sm:text-left">
                Tap a tile → open post modal with carousel + comments · Long-press / menu → report · Grid supports image/video posts
              </p>
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
                          {isVideo ? (
                            <video
                              src={firstMedia.url}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={firstMedia.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                          {/* Multi-image indicator */}
                          {post.post_media.length > 1 && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-black/70 backdrop-blur-sm rounded-md p-1.5">
                                <Image className="h-3 w-3 text-white" />
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
            <div className="grid gap-3 sm:grid-cols-2">
              {enrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/challenges/${enrollment.challenges.id}`}
                >
                  <Card className="bg-slate-800/30 border-cyan-400/10 hover:border-cyan-400/30 hover:bg-slate-800/50 transition-all group">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
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
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate group-hover:text-cyan-400 transition-colors">
                            {enrollment.challenges.title}
                          </h3>
                          <div className="flex gap-2 mt-1">
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
                          <p className="text-xs text-muted-foreground mt-2">
                            Enrolled {formatDate(enrollment.enrolled_at)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          {rsvps.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mb-4">
                <Calendar className="h-10 w-10 text-cyan-400/50" />
              </div>
              <p className="text-lg font-medium text-foreground/80">No events attended yet</p>
              <p className="text-sm text-muted-foreground mt-1">RSVP to events to see them here</p>
              <Link 
                href="/events"
                className="inline-block mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Browse Events →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rsvps.map((rsvp) => (
                <Link key={rsvp.event_id} href={`/events/${rsvp.events.id}`}>
                  <Card className="bg-slate-800/30 border-cyan-400/10 hover:border-cyan-400/30 hover:bg-slate-800/50 transition-all group">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg p-3 border border-cyan-400/20">
                          <Calendar className="h-6 w-6 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate group-hover:text-cyan-400 transition-colors">
                            {rsvp.events.title}
                          </h3>
                          <Badge variant="outline" className="text-xs mt-1 border-cyan-400/30 text-cyan-400">
                            {rsvp.events.event_type.replace("_", " ")}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-2">
                            {formatDate(rsvp.events.start_time)}
                          </p>
                          {(rsvp.events.location_city || rsvp.events.location_state) && (
                            <p className="text-xs text-muted-foreground">
                              📍 {[rsvp.events.location_city, rsvp.events.location_state]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
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
    </>
  );
}
