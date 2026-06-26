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
import { useCanModerate } from "@/lib/auth/current-user-context";
import { formatRelativeTime } from "@/lib/utils";
import {
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Flag,
  Trash2,
  UserPlus,
  Trophy,
  Pencil,
} from "lucide-react";
import { FeedVideoPlayer } from "./feed-video-player";
import { EditPostDialog } from "./edit-post-dialog";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    tags: string[];
    created_at: string;
    author_id?: string;
    challenge_id?: string | null;
    block_id?: string | null;
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
      thumbnail_url?: string | null;
    }[];
    post_likes: { user_id: string }[];
    comments: { id: string }[];
    challenges?: {
      id: string;
      title: string;
      cover_image_url?: string | null;
    } | null;
  };
  currentUserId?: string;
  isSuggested?: boolean;
  onFollowSuccess?: () => void;
  hideChallengeBadge?: boolean;
  /** Notified after a like toggles so parents (e.g. grids) can stay in sync. */
  onLikeChange?: (postId: string, liked: boolean, likesCount: number) => void;
  /** Notified after a post is deleted so parents can close modals / drop tiles. */
  onDeleted?: (postId: string) => void;
}

export function PostCard({
  post,
  currentUserId,
  isSuggested = false,
  onFollowSuccess,
  hideChallengeBadge = false,
  onLikeChange,
  onDeleted,
}: PostCardProps) {
  const queryClient = useQueryClient();
  const canModerate = useCanModerate();
  const [showComments, setShowComments] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isFollowing, setIsFollowing] = useState(!isSuggested);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const isLiked = post.post_likes.some((like) => like.user_id === currentUserId);
  const [liked, setLiked] = useState(isLiked);
  const [likesCount, setLikesCount] = useState(post.post_likes.length);
  const [isLiking, setIsLiking] = useState(false);

  const isOwnPost = post.profiles.id === currentUserId;
  const canDelete = isOwnPost || canModerate;
  const isAdmin = post.profiles.role === "admin";
  const authorId = post.profiles.id;

  const initials = post.profiles.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleLike() {
    if (!currentUserId || isLiking) return;

    const wasLiked = liked;
    const nextLiked = !wasLiked;
    const nextCount = wasLiked ? likesCount - 1 : likesCount + 1;

    // Optimistic update
    setLiked(nextLiked);
    setLikesCount(nextCount);
    onLikeChange?.(post.id, nextLiked, nextCount);
    setIsLiking(true);

    try {
      const response = await fetch(`/api/posts/${post.id}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });

      if (!response.ok) {
        // Revert on error
        setLiked(wasLiked);
        setLikesCount(likesCount);
        onLikeChange?.(post.id, wasLiked, likesCount);
      }
    } catch (error) {
      // Revert on error
      setLiked(wasLiked);
      setLikesCount(likesCount);
      onLikeChange?.(post.id, wasLiked, likesCount);
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
        onDeleted?.(post.id);
        // Refresh any active list (feed, explore, profile, etc.)
        queryClient.invalidateQueries();
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  }

  const commentCount = post.comments.length;

  async function handleFollow() {
    if (!authorId || !currentUserId || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      const res = await fetch(`/api/profiles/${authorId}/follow`, {
        method: "POST",
      });
      if (res.ok) {
        setIsFollowing(true);
        onFollowSuccess?.();
      }
    } finally {
      setIsFollowLoading(false);
    }
  }

  return (
    <>
      <Card className="transition-all duration-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
        <CardContent className="px-3 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Link
                href={`/profile/${post.profiles.username}`}
                className="flex items-center gap-2 sm:gap-3 group shrink-0"
              >
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-transparent group-hover:ring-primary/30 transition-all duration-200">
                  <AvatarImage src={post.profiles.avatar_url || undefined} />
                  <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <p className="text-sm sm:text-base font-semibold group-hover:text-primary transition-colors truncate max-w-[120px] sm:max-w-none">
                      {post.profiles.display_name}
                    </p>
                    {isSuggested && (
                      <Badge variant="secondary" className="text-xs font-normal shrink-0">
                        Suggested
                      </Badge>
                    )}
                    {isAdmin && <AdminBadge />}
                    {isSuggested && authorId && currentUserId && !isOwnPost && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 shrink-0 text-primary border-primary/40 hover:bg-primary/10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFollow();
                        }}
                        disabled={isFollowLoading || isFollowing}
                      >
                        {isFollowLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <UserPlus className="h-3 w-3" />
                        )}
                        {isFollowing ? "Following" : "Follow"}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    @{post.profiles.username} · {formatRelativeTime(post.created_at)}
                  </p>
                </div>
              </Link>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwnPost && (
                  <>
                    <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {!isOwnPost && (
                  <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                    <Flag className="h-4 w-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    {!isOwnPost && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete{!isOwnPost ? " (moderate)" : ""}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {!hideChallengeBadge && post.challenge_id && post.challenges && (
            <Link
              href={`/challenges/${post.challenges.id}`}
              className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Trophy className="h-3 w-3" />
              <span>in {post.challenges.title}</span>
            </Link>
          )}

          <p className="mt-3 sm:mt-4 text-sm sm:text-base whitespace-pre-wrap break-words">{post.content}</p>

          {post.post_media.length > 0 && (
            post.post_media.length === 1 ? (
              <div className="mt-4 rounded-lg">
                {post.post_media[0].media_type === "image" ? (
                  <img
                    src={post.post_media[0].url}
                    alt=""
                    className="w-full max-h-[600px] object-contain bg-black/20 rounded-lg"
                  />
                ) : (
                  <FeedVideoPlayer
                    src={post.post_media[0].url}
                    thumbnailUrl={post.post_media[0].thumbnail_url}
                    maxHeight="600px"
                    className="w-full rounded-lg"
                  />
                )}
              </div>
            ) : (
              <div
                className={`grid gap-2 mt-4 ${
                  post.post_media.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
                }`}
              >
                {post.post_media.map((media) => (
                  <div
                    key={media.id}
                    className={`relative overflow-hidden rounded-lg ${
                      media.media_type === "image" ? "aspect-square" : ""
                    }`}
                  >
                    {media.media_type === "image" ? (
                      <img
                        src={media.url}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <FeedVideoPlayer
                        src={media.url}
                        thumbnailUrl={media.thumbnail_url}
                        className="w-full rounded"
                      />
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs hover:bg-primary/20 transition-colors cursor-pointer">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* View comments prompt */}
          {commentCount > 0 && !showComments && (
            <button
              onClick={() => setShowComments(true)}
              className="mt-4 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              View {commentCount === 1 ? "1 comment" : `all ${commentCount} comments`}
            </button>
          )}
        </CardContent>

        <CardFooter className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 pt-1 sm:pt-2 pb-3 sm:pb-4">
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
                ? "text-primary bg-primary/10" 
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
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

      {showEditDialog && (
        <EditPostDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          post={{
            id: post.id,
            content: post.content,
            tags: post.tags,
            post_media: post.post_media,
          }}
        />
      )}
    </>
  );
}
