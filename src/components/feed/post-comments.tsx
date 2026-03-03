"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminBadge } from "@/components/shared/admin-badge";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import {
  uploadFileWithProgress,
  isValidImageType,
  isValidVideoType,
} from "@/lib/uploads/storage";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Reply,
  Image as ImageIcon,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FeedVideoPlayer } from "./feed-video-player";

interface CommentMedia {
  id: string;
  url: string;
  media_type: "image" | "video";
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  reply_to_id: string | null;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    role?: string;
  };
  comment_media: CommentMedia[];
}

interface MediaAttachment {
  file: File;
  url: string;
  media_type: "image" | "video";
}

interface PostCommentsProps {
  postId: string;
  currentUserId?: string;
}

export function PostComments({ postId, currentUserId }: PostCommentsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment input state
  const [newComment, setNewComment] = useState("");
  const [newMedia, setNewMedia] = useState<MediaAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reply state
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    replyToId: string;
    replyToName: string;
  } | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyMedia, setReplyMedia] = useState<MediaAttachment[]>([]);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyUploadProgress, setReplyUploadProgress] = useState(0);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Thread collapse state
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    fetchComments();
  }, [postId]);

  async function fetchComments() {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFileSelect(
    event: React.ChangeEvent<HTMLInputElement>,
    target: "new" | "reply"
  ) {
    const files = event.target.files;
    if (!files) return;

    const current = target === "new" ? newMedia : replyMedia;
    const setter = target === "new" ? setNewMedia : setReplyMedia;

    const added: MediaAttachment[] = [];
    for (const file of Array.from(files)) {
      if (current.length + added.length >= 4) {
        toast({
          title: "Too many files",
          description: "Maximum 4 media items per comment.",
          variant: "destructive",
        });
        break;
      }
      if (isValidImageType(file)) {
        added.push({
          file,
          url: URL.createObjectURL(file),
          media_type: "image",
        });
      } else if (isValidVideoType(file)) {
        added.push({
          file,
          url: URL.createObjectURL(file),
          media_type: "video",
        });
      } else {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported format.`,
          variant: "destructive",
        });
      }
    }

    setter((prev) => [...prev, ...added]);
    event.target.value = "";
  }

  function removeAttachment(
    index: number,
    target: "new" | "reply"
  ) {
    const setter = target === "new" ? setNewMedia : setReplyMedia;
    setter((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  }

  async function uploadMedia(
    attachments: MediaAttachment[],
    onProgress: (p: number) => void
  ): Promise<{ url: string; media_type: "image" | "video" }[]> {
    if (attachments.length === 0) return [];

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const results: { url: string; media_type: "image" | "video" }[] = [];
    let completed = 0;

    for (const item of attachments) {
      const path = `${user.id}/comments/${Date.now()}-${item.file.name}`;
      const { url } = await uploadFileWithProgress(
        "post-media",
        item.file,
        path,
        (pct) => {
          const base = (completed / attachments.length) * 100;
          const share = (1 / attachments.length) * pct;
          onProgress(Math.round(base + share));
        }
      );
      results.push({ url, media_type: item.media_type });
      completed++;
    }
    onProgress(100);
    return results;
  }

  async function handleSubmitComment() {
    if (!newComment.trim() && newMedia.length === 0) return;
    if (!currentUserId) return;

    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);

    try {
      const uploadedMedia = await uploadMedia(newMedia, setUploadProgress);

      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
          parent_id: null,
          media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        }),
      });

      if (response.ok) {
        setNewComment("");
        newMedia.forEach((m) => URL.revokeObjectURL(m.url));
        setNewMedia([]);
        setUploadProgress(0);
        fetchComments();
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      } else {
        const data = await response.json();
        const msg =
          typeof data.error === "string"
            ? data.error
            : Array.isArray(data.error)
              ? data.error[0]?.message
              : "Failed to post comment";
        setError(msg || "Failed to post comment");
      }
    } catch {
      setError("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitReply() {
    if (!replyTarget) return;
    if (!replyContent.trim() && replyMedia.length === 0) return;
    if (!currentUserId) return;

    setIsSubmittingReply(true);
    setReplyUploadProgress(0);

    try {
      const uploadedMedia = await uploadMedia(
        replyMedia,
        setReplyUploadProgress
      );

      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent.trim(),
          parent_id: replyTarget.parentId,
          reply_to_id: replyTarget.replyToId,
          media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        }),
      });

      if (response.ok) {
        setReplyContent("");
        replyMedia.forEach((m) => URL.revokeObjectURL(m.url));
        setReplyMedia([]);
        setReplyTarget(null);
        setReplyUploadProgress(0);
        fetchComments();
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to post reply.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReply(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    try {
      const response = await fetch(
        `/api/posts/${postId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        fetchComments();
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      }
    } catch {
      console.error("Failed to delete comment");
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content || "");
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditContent("");
        fetchComments();
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save edit.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  }

  function startReply(comment: Comment) {
    const rootId = comment.parent_id || comment.id;
    setReplyTarget({
      parentId: rootId,
      replyToId: comment.id,
      replyToName: comment.profiles.display_name,
    });
    setReplyContent("");
    replyMedia.forEach((m) => URL.revokeObjectURL(m.url));
    setReplyMedia([]);
    setTimeout(() => replyInputRef.current?.focus(), 50);
  }

  function toggleThread(threadId: string) {
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const getReplies = (rootId: string) =>
    comments
      .filter((c) => c.parent_id === rootId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

  const commentMap = new Map(comments.map((c) => [c.id, c]));
  function getReplyToName(comment: Comment): string | undefined {
    if (!comment.reply_to_id) return undefined;
    return commentMap.get(comment.reply_to_id)?.profiles.display_name;
  }

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

      {/* New comment input */}
      {currentUserId && (
        <div className="space-y-2 mb-4">
          {error && (
            <div className="p-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md">
              {error}
            </div>
          )}
          <CommentInput
            placeholder="Write a comment..."
            value={newComment}
            onChange={setNewComment}
            media={newMedia}
            onRemoveMedia={(i) => removeAttachment(i, "new")}
            onFileSelect={() => fileInputRef.current?.click()}
            onSubmit={handleSubmitComment}
            isSubmitting={isSubmitting}
            uploadProgress={uploadProgress}
            disabled={!newComment.trim() && newMedia.length === 0}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, "new")}
          />
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-4">
        {topLevel.map((comment) => {
          const replies = getReplies(comment.id);
          const isCollapsed = collapsedThreads.has(comment.id);
          const isReplyingHere =
            replyTarget?.parentId === comment.id ||
            replyTarget?.replyToId === comment.id;

          return (
            <div key={comment.id} className="space-y-2">
              <CommentBubble
                comment={comment}
                currentUserId={currentUserId}
                onReply={() => startReply(comment)}
                onDelete={() => handleDeleteComment(comment.id)}
                onEdit={() => startEdit(comment)}
                replyToName={getReplyToName(comment)}
                isEditing={editingId === comment.id}
                editContent={editingId === comment.id ? editContent : ""}
                onEditContentChange={setEditContent}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => { setEditingId(null); setEditContent(""); }}
                isSavingEdit={isSavingEdit}
              />

              {/* Thread replies */}
              {replies.length > 0 && (
                <div className="ml-11">
                  <button
                    type="button"
                    onClick={() => toggleThread(comment.id)}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mb-2 transition-colors"
                  >
                    {isCollapsed ? (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show {replies.length}{" "}
                        {replies.length === 1 ? "reply" : "replies"}
                      </>
                    ) : (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Hide replies
                      </>
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-2 border-l-2 border-white/5 pl-3">
                      {replies.map((reply) => (
                        <CommentBubble
                          key={reply.id}
                          comment={reply}
                          currentUserId={currentUserId}
                          onReply={() => startReply(reply)}
                          onDelete={() => handleDeleteComment(reply.id)}
                          onEdit={() => startEdit(reply)}
                          replyToName={getReplyToName(reply)}
                          isReply
                          isEditing={editingId === reply.id}
                          editContent={editingId === reply.id ? editContent : ""}
                          onEditContentChange={setEditContent}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={() => { setEditingId(null); setEditContent(""); }}
                          isSavingEdit={isSavingEdit}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reply input for this thread */}
              {isReplyingHere && currentUserId && (
                <div className="ml-11 space-y-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Reply className="h-3 w-3" />
                    Replying to{" "}
                    <span className="font-medium text-cyan-400">
                      {replyTarget!.replyToName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyTarget(null)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <CommentInput
                    ref={replyInputRef}
                    placeholder={`Reply to ${replyTarget!.replyToName}...`}
                    value={replyContent}
                    onChange={setReplyContent}
                    media={replyMedia}
                    onRemoveMedia={(i) => removeAttachment(i, "reply")}
                    onFileSelect={() => replyFileInputRef.current?.click()}
                    onSubmit={handleSubmitReply}
                    isSubmitting={isSubmittingReply}
                    uploadProgress={replyUploadProgress}
                    disabled={
                      !replyContent.trim() && replyMedia.length === 0
                    }
                  />
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, "reply")}
                  />
                </div>
              )}
            </div>
          );
        })}

        {topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Reusable comment input ─────────────────────────────────────────────────

interface CommentInputProps {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  media: MediaAttachment[];
  onRemoveMedia: (index: number) => void;
  onFileSelect: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  uploadProgress: number;
  disabled: boolean;
}

const CommentInput = ({
  ref,
  placeholder,
  value,
  onChange,
  media,
  onRemoveMedia,
  onFileSelect,
  onSubmit,
  isSubmitting,
  uploadProgress,
  disabled,
}: CommentInputProps & { ref?: React.Ref<HTMLTextAreaElement> }) => (
  <div className="space-y-2">
    {/* Media preview strip */}
    {media.length > 0 && (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {media.map((item, i) => (
          <div
            key={i}
            className="relative shrink-0 w-16 h-16 rounded-md overflow-hidden bg-black/20"
          >
            {item.media_type === "image" ? (
              <img
                src={item.url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={item.url}
                className="w-full h-full object-cover"
                muted
              />
            )}
            <button
              type="button"
              onClick={() => onRemoveMedia(i)}
              className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
      </div>
    )}

    <div className="flex gap-2">
      <div className="flex-1 relative">
        <Textarea
          ref={ref}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[50px] resize-none pr-10"
          maxLength={1000}
        />
        <button
          type="button"
          onClick={onFileSelect}
          className="absolute bottom-2 right-2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Attach media"
          disabled={media.length >= 4}
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      </div>
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={disabled || isSubmitting}
        className="self-end"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Post"
        )}
      </Button>
    </div>

    {/* Upload progress */}
    {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-cyan-400 transition-all duration-300"
          style={{ width: `${uploadProgress}%` }}
        />
      </div>
    )}
  </div>
);

// ─── Comment bubble ─────────────────────────────────────────────────────────

interface CommentBubbleProps {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  replyToName?: string;
  isReply?: boolean;
  isEditing?: boolean;
  editContent?: string;
  onEditContentChange?: (v: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  isSavingEdit?: boolean;
}

function CommentBubble({
  comment,
  currentUserId,
  onReply,
  onDelete,
  onEdit,
  replyToName,
  isReply = false,
  isEditing = false,
  editContent = "",
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  isSavingEdit = false,
}: CommentBubbleProps) {
  const initials = comment.profiles.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isOwn = comment.profiles.id === currentUserId;
  const isAdmin = comment.profiles.role === "admin";

  return (
    <div className="flex gap-3">
      <Link href={`/profile/${comment.profiles.username}`}>
        <Avatar className={isReply ? "h-6 w-6" : "h-8 w-8"}>
          <AvatarImage src={comment.profiles.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-muted rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/profile/${comment.profiles.username}`}
              className="font-medium text-sm hover:underline"
            >
              {comment.profiles.display_name}
            </Link>
            {isAdmin && <AdminBadge />}
            {replyToName && (
              <span className="text-xs text-muted-foreground">
                <Reply className="inline h-3 w-3 mr-0.5" />
                {replyToName}
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-1 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => onEditContentChange?.(e.target.value)}
                className="min-h-[40px] resize-none text-sm"
                maxLength={1000}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={onSaveEdit} disabled={isSavingEdit || !editContent.trim()}>
                  {isSavingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit} disabled={isSavingEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {comment.content && (
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              )}
            </>
          )}

          {/* Media in comment */}
          {!isEditing && comment.comment_media && comment.comment_media.length > 0 && (
            <div
              className={`mt-2 ${
                comment.comment_media.length === 1
                  ? ""
                  : "grid grid-cols-2 gap-1"
              }`}
            >
              {comment.comment_media.map((media) => (
                <div
                  key={media.id}
                  className="rounded-md overflow-hidden"
                >
                  {media.media_type === "image" ? (
                    <img
                      src={media.url}
                      alt=""
                      className="w-full max-h-[300px] object-contain bg-black/10 rounded-md"
                    />
                  ) : (
                    <FeedVideoPlayer
                      src={media.url}
                      maxHeight="300px"
                      className="w-full rounded-md"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.created_at)}
            </span>
            {currentUserId && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
                onClick={onReply}
              >
                Reply
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
                onClick={onEdit}
              >
                Edit
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                onClick={onDelete}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
