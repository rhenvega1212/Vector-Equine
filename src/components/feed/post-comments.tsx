"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils";
import { Loader2, Reply, Trash2 } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface PostCommentsProps {
  postId: string;
  currentUserId?: string;
}

export function PostComments({ postId, currentUserId }: PostCommentsProps) {
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  async function fetchComments() {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitComment(parentId?: string) {
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !currentUserId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          parent_id: parentId || null,
        }),
      });

      if (response.ok) {
        if (parentId) {
          setReplyContent("");
          setReplyingTo(null);
        } else {
          setNewComment("");
        }
        fetchComments();
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;

    try {
      const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchComments();
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  }

  const topLevelComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  if (isLoading) {
    return (
      <div className="px-6 pb-6 space-y-4">
        <Separator />
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-6 pb-6">
      <Separator className="mb-4" />

      {currentUserId && (
        <div className="flex gap-3 mb-4">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[60px] resize-none"
          />
          <Button
            size="sm"
            onClick={() => handleSubmitComment()}
            disabled={!newComment.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Post"
            )}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {topLevelComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            onReply={() => setReplyingTo(comment.id)}
            onDelete={() => handleDeleteComment(comment.id)}
            replies={getReplies(comment.id)}
            replyingTo={replyingTo}
            replyContent={replyContent}
            onReplyContentChange={setReplyContent}
            onSubmitReply={() => handleSubmitComment(comment.id)}
            onCancelReply={() => {
              setReplyingTo(null);
              setReplyContent("");
            }}
            onDeleteReply={handleDeleteComment}
            isSubmitting={isSubmitting}
          />
        ))}

        {topLevelComments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onDelete: () => void;
  replies: Comment[];
  replyingTo: string | null;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
  onDeleteReply: (id: string) => void;
  isSubmitting: boolean;
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  replies,
  replyingTo,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  onCancelReply,
  onDeleteReply,
  isSubmitting,
}: CommentItemProps) {
  const initials = comment.profiles.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isOwnComment = comment.profiles.id === currentUserId;
  const isReplying = replyingTo === comment.id;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Link href={`/profile/${comment.profiles.username}`}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.profiles.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <div className="bg-muted rounded-lg px-3 py-2">
            <Link
              href={`/profile/${comment.profiles.username}`}
              className="font-medium text-sm hover:underline"
            >
              {comment.profiles.display_name}
            </Link>
            <p className="text-sm">{comment.content}</p>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.created_at)}
            </span>
            {currentUserId && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={onReply}
              >
                Reply
              </button>
            )}
            {isOwnComment && (
              <button
                className="text-xs text-destructive hover:text-destructive/80"
                onClick={onDelete}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-11 space-y-3">
          {replies.map((reply) => {
            const replyInitials = reply.profiles.display_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            const isOwnReply = reply.profiles.id === currentUserId;

            return (
              <div key={reply.id} className="flex gap-3">
                <Link href={`/profile/${reply.profiles.username}`}>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={reply.profiles.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {replyInitials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Link
                      href={`/profile/${reply.profiles.username}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {reply.profiles.display_name}
                    </Link>
                    <p className="text-sm">{reply.content}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(reply.created_at)}
                    </span>
                    {isOwnReply && (
                      <button
                        className="text-xs text-destructive hover:text-destructive/80"
                        onClick={() => onDeleteReply(reply.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply input */}
      {isReplying && (
        <div className="ml-11 flex gap-2">
          <Textarea
            placeholder={`Reply to ${comment.profiles.display_name}...`}
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            className="min-h-[50px] resize-none"
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              onClick={onSubmitReply}
              disabled={!replyContent.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Reply className="h-4 w-4" />
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelReply}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
