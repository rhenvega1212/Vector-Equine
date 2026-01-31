"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PostComments } from "./post-comments";
import { ReportDialog } from "./report-dialog";
import { AdminBadge } from "@/components/shared/admin-badge";
import { formatRelativeTime } from "@/lib/utils";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Flag,
  Trash2,
} from "lucide-react";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    tags: string[];
    created_at: string;
    profiles: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      role?: string;
    };
    post_media: {
      id: string;
      url: string;
      media_type: "image" | "video";
    }[];
    post_likes: { user_id: string }[];
    comments: { id: string }[];
  };
  currentUserId?: string;
}

export function PostCard({ post, currentUserId }: PostCardProps) {
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  
  const isLiked = post.post_likes.some((like) => like.user_id === currentUserId);
  const [liked, setLiked] = useState(isLiked);
  const [likesCount, setLikesCount] = useState(post.post_likes.length);
  const [isLiking, setIsLiking] = useState(false);

  const isOwnPost = post.profiles.id === currentUserId;
  const isAdmin = post.profiles.role === "admin";

  const initials = post.profiles.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleLike() {
    if (!currentUserId || isLiking) return;

    // Optimistic update
    setLiked(!liked);
    setLikesCount((prev) => (liked ? prev - 1 : prev + 1));
    setIsLiking(true);

    try {
      const response = await fetch(`/api/posts/${post.id}/like`, {
        method: liked ? "DELETE" : "POST",
      });

      if (!response.ok) {
        // Revert on error
        setLiked(liked);
        setLikesCount((prev) => (liked ? prev + 1 : prev - 1));
      }
    } catch (error) {
      // Revert on error
      setLiked(liked);
      setLikesCount((prev) => (liked ? prev + 1 : prev - 1));
    } finally {
      setIsLiking(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  }

  const commentCount = post.comments.length;

  return (
    <>
      <Card className="transition-all duration-200 hover:bg-white/[0.02] hover:border-cyan-400/20 hover:shadow-lg hover:shadow-cyan-400/5">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <Link
              href={`/profile/${post.profiles.username}`}
              className="flex items-center gap-3 group"
            >
              <Avatar className="ring-2 ring-transparent group-hover:ring-cyan-400/30 transition-all duration-200">
                <AvatarImage src={post.profiles.avatar_url || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold group-hover:text-cyan-400 transition-colors">
                    {post.profiles.display_name}
                  </p>
                  {isAdmin && <AdminBadge />}
                </div>
                <p className="text-sm text-muted-foreground">
                  @{post.profiles.username} · {formatRelativeTime(post.created_at)}
                </p>
              </div>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwnPost ? (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                    <Flag className="h-4 w-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="mt-4 whitespace-pre-wrap">{post.content}</p>

          {post.post_media.length > 0 && (
            <div
              className={`grid gap-2 mt-4 ${
                post.post_media.length === 1
                  ? "grid-cols-1"
                  : post.post_media.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
              }`}
            >
              {post.post_media.map((media) => (
                <div key={media.id} className="relative aspect-square overflow-hidden rounded-lg">
                  {media.media_type === "image" ? (
                    <img
                      src={media.url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <video
                      src={media.url}
                      controls
                      className="w-full h-full object-cover rounded"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs hover:bg-cyan-400/20 transition-colors cursor-pointer">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* View comments prompt */}
          {commentCount > 0 && !showComments && (
            <button
              onClick={() => setShowComments(true)}
              className="mt-4 text-sm text-muted-foreground hover:text-cyan-400 transition-colors"
            >
              View {commentCount === 1 ? "1 comment" : `all ${commentCount} comments`}
            </button>
          )}
        </CardContent>

        <CardFooter className="flex items-center gap-2 pt-2 pb-4">
          {/* Like button */}
          <button
            onClick={handleLike}
            disabled={!currentUserId}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg
              transition-all duration-200
              ${liked 
                ? "text-red-500 bg-red-500/10 hover:bg-red-500/20" 
                : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              }
              active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <Heart className={`h-5 w-5 transition-transform ${liked ? "fill-current scale-110" : "hover:scale-110"}`} />
            <span className="text-sm font-medium tabular-nums">{likesCount}</span>
          </button>

          {/* Comment button */}
          <button
            onClick={() => setShowComments(!showComments)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg
              transition-all duration-200
              ${showComments 
                ? "text-cyan-400 bg-cyan-400/10" 
                : "text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10"
              }
              active:scale-95
            `}
          >
            <MessageCircle className={`h-5 w-5 transition-transform ${showComments ? "scale-110" : "hover:scale-110"}`} />
            <span className="text-sm font-medium tabular-nums">{commentCount}</span>
          </button>
        </CardFooter>

        {showComments && (
          <PostComments postId={post.id} currentUserId={currentUserId} />
        )}
      </Card>

      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        postId={post.id}
      />
    </>
  );
}
