"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageSquare,
  Reply,
  Trash2,
  Pin,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  BlockRendererProps,
  DiscussionSettings,
} from "@/lib/blocks/types";
import { formatDistanceToNow } from "date-fns";

interface PostProfile {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

interface DiscussionPost {
  id: string;
  block_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  is_pinned: boolean;
  created_at: string;
  profiles: PostProfile;
  reply_count: number;
  reaction_count: number;
  user_has_reacted: boolean;
}

async function fetchPosts(blockId: string, sort: string) {
  const res = await fetch(
    `/api/challenges/blocks/${blockId}/discussions?sort=${sort}`
  );
  if (!res.ok) throw new Error("Failed to fetch posts");
  const data = await res.json();
  return data.posts as DiscussionPost[];
}

async function createPost(
  blockId: string,
  body: { content: string; parent_id?: string }
) {
  const res = await fetch(`/api/challenges/blocks/${blockId}/discussions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create post");
  return res.json();
}

async function deletePost(blockId: string, postId: string) {
  const res = await fetch(
    `/api/challenges/blocks/${blockId}/discussions/${postId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to delete post");
  return res.json();
}

async function toggleReaction(blockId: string, postId: string) {
  const res = await fetch(
    `/api/challenges/blocks/${blockId}/discussions/${postId}/react`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Failed to toggle reaction");
  return res.json() as Promise<{ liked: boolean }>;
}

export function DiscussionBlockRenderer({
  block,
  currentUserId,
  onComplete,
}: BlockRendererProps) {
  const settings = block.settings as DiscussionSettings;
  const prompt = settings.prompt ?? "";
  const sortDefault = settings.sortDefault ?? "newest";
  const minParticipation = settings.minParticipation ?? 0;

  const [sort, setSort] = useState<"newest" | "top">(sortDefault);
  const [newContent, setNewContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );

  const queryClient = useQueryClient();
  const queryKey = ["discussion", block.id, sort];

  const { data: posts = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchPosts(block.id, sort),
  });

  const topLevelPosts = posts.filter((p) => !p.parent_id);
  const repliesByParent = new Map<string, DiscussionPost[]>();
  for (const p of posts) {
    if (p.parent_id) {
      const arr = repliesByParent.get(p.parent_id) ?? [];
      arr.push(p);
      repliesByParent.set(p.parent_id, arr);
    }
  }

  const userPostCount = posts.filter(
    (p) => p.user_id === currentUserId
  ).length;

  useEffect(() => {
    if (
      minParticipation > 0 &&
      userPostCount >= minParticipation &&
      onComplete
    ) {
      onComplete();
    }
  }, [userPostCount, minParticipation, onComplete]);

  const createMutation = useMutation({
    mutationFn: (body: { content: string; parent_id?: string }) =>
      createPost(block.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost(block.id, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const reactMutation = useMutation({
    mutationFn: (postId: string) => toggleReaction(block.id, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function handleSubmit() {
    if (!newContent.trim()) return;
    createMutation.mutate({ content: newContent.trim() });
    setNewContent("");
  }

  function handleReply(parentId: string) {
    if (!replyContent.trim()) return;
    createMutation.mutate({
      content: replyContent.trim(),
      parent_id: parentId,
    });
    setReplyContent("");
    setReplyingTo(null);
    setExpandedReplies((prev) => new Set(prev).add(parentId));
  }

  function toggleExpand(postId: string) {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Prompt */}
      {prompt && (
        <div className="flex items-start gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
          <MessageSquare
            size={18}
            className="mt-0.5 shrink-0 text-cyan-400"
          />
          <p className="text-sm font-medium text-white">{prompt}</p>
        </div>
      )}

      {/* Participation counter */}
      {minParticipation > 0 && (
        <div className="text-xs text-slate-400">
          You&apos;ve posted{" "}
          <span className="font-semibold text-white">{userPostCount}</span> of{" "}
          <span className="font-semibold text-white">{minParticipation}</span>{" "}
          required
          {userPostCount >= minParticipation && (
            <span className="ml-2 text-green-400">&#10003; Complete</span>
          )}
        </div>
      )}

      {/* Post creation */}
      <div className="space-y-2">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Share your thoughts..."
          rows={3}
          className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!newContent.trim() || createMutation.isPending}
            size="sm"
            className="gap-1.5 bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40"
          >
            <Send size={14} />
            Post
          </Button>
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {(["newest", "top"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              sort === s
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {s === "newest" ? "Newest" : "Most Liked"}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Loading discussion...
        </div>
      ) : topLevelPosts.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No posts yet. Be the first to contribute!
        </div>
      ) : (
        <div className="space-y-3">
          {topLevelPosts.map((post) => {
            const replies = repliesByParent.get(post.id) ?? [];
            const isExpanded = expandedReplies.has(post.id);

            return (
              <div key={post.id} className="space-y-2">
                <PostCard
                  post={post}
                  currentUserId={currentUserId}
                  onReact={() => reactMutation.mutate(post.id)}
                  onDelete={() => deleteMutation.mutate(post.id)}
                  onReply={() =>
                    setReplyingTo(replyingTo === post.id ? null : post.id)
                  }
                  replyCount={replies.length}
                  onToggleReplies={() => toggleExpand(post.id)}
                  isExpanded={isExpanded}
                />

                {/* Reply input */}
                {replyingTo === post.id && (
                  <div className="ml-10 flex gap-2">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply..."
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                    <Button
                      onClick={() => handleReply(post.id)}
                      disabled={
                        !replyContent.trim() || createMutation.isPending
                      }
                      size="sm"
                      className="self-end bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40"
                    >
                      <Send size={14} />
                    </Button>
                  </div>
                )}

                {/* Threaded replies */}
                {isExpanded && replies.length > 0 && (
                  <div className="ml-10 space-y-2 border-l-2 border-white/5 pl-4">
                    {replies.map((reply) => (
                      <PostCard
                        key={reply.id}
                        post={reply}
                        currentUserId={currentUserId}
                        onReact={() => reactMutation.mutate(reply.id)}
                        onDelete={() => deleteMutation.mutate(reply.id)}
                        isReply
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onReact,
  onDelete,
  onReply,
  replyCount,
  onToggleReplies,
  isExpanded,
  isReply,
}: {
  post: DiscussionPost;
  currentUserId?: string;
  onReact: () => void;
  onDelete: () => void;
  onReply?: () => void;
  replyCount?: number;
  onToggleReplies?: () => void;
  isExpanded?: boolean;
  isReply?: boolean;
}) {
  const displayName =
    post.profiles?.display_name || post.profiles?.username || "Anonymous";
  const avatarUrl = post.profiles?.avatar_url;
  const isOwn = post.user_id === currentUserId;

  return (
    <div
      className={`rounded-lg border border-white/10 bg-white/[0.03] p-4 ${
        isReply ? "py-3" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-700">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-400">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {displayName}
            </span>
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
              })}
            </span>
            {post.is_pinned && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                <Pin size={10} />
                Pinned
              </span>
            )}
          </div>

          {/* Content */}
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-300">
            {post.content}
          </p>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onReact}
              className={`flex items-center gap-1 text-xs transition-colors ${
                post.user_has_reacted
                  ? "text-rose-400"
                  : "text-slate-500 hover:text-rose-400"
              }`}
            >
              <Heart
                size={14}
                className={post.user_has_reacted ? "fill-current" : ""}
              />
              {post.reaction_count > 0 && post.reaction_count}
            </button>

            {!isReply && onReply && (
              <button
                type="button"
                onClick={onReply}
                className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-cyan-400"
              >
                <Reply size={14} />
                Reply
              </button>
            )}

            {!isReply && (replyCount ?? 0) > 0 && onToggleReplies && (
              <button
                type="button"
                onClick={onToggleReplies}
                className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-white"
              >
                <MessageSquare size={14} />
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
                <span className="text-[10px]">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </button>
            )}

            {isOwn && (
              <button
                type="button"
                onClick={onDelete}
                className="ml-auto text-xs text-slate-500 transition-colors hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
