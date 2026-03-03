"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import { CreatePost } from "@/components/feed/create-post";
import type {
  BlockRendererProps,
  DiscussionSettings,
} from "@/lib/blocks/types";

type FeedPost = {
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
  post_media: { id: string; url: string; media_type: "image" | "video" }[];
  post_likes: { user_id: string }[];
  comments: { id: string }[];
  challenges?: { id: string; title: string; cover_image_url?: string | null } | null;
};

export function DiscussionBlockRenderer({
  block,
  currentUserId,
  challengeId,
  onComplete,
}: BlockRendererProps) {
  const settings = block.settings as DiscussionSettings;
  const prompt = settings.prompt ?? "";
  const sortDefault = settings.sortDefault ?? "newest";
  const minParticipation = settings.minParticipation ?? 0;

  const [sort, setSort] = useState<"newest" | "top">(sortDefault);
  const queryClient = useQueryClient();
  const queryKey = ["discussion-posts", block.id, sort];

  const { data, isLoading } = useQuery<{ posts: FeedPost[] }>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/posts?block_id=${block.id}&sort=${sort}&limit=50`
      );
      if (!res.ok) throw new Error("Failed to fetch discussion posts");
      return res.json();
    },
  });

  const posts = data?.posts ?? [];

  const userPostCount = currentUserId
    ? posts.filter((p) => p.author_id === currentUserId).length
    : 0;

  useEffect(() => {
    if (
      minParticipation > 0 &&
      userPostCount >= minParticipation &&
      onComplete
    ) {
      onComplete();
    }
  }, [userPostCount, minParticipation, onComplete]);

  function handlePostCreated() {
    queryClient.invalidateQueries({ queryKey });
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

      {/* Create post (discussion mode) */}
      {currentUserId && (
        <CreatePost
          discussionMode={{
            challengeId,
            blockId: block.id,
            prompt: undefined,
            onPostCreated: handlePostCreated,
          }}
        />
      )}

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
      ) : posts.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No posts yet. Be the first to contribute!
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              hideChallengeBadge
            />
          ))}
        </div>
      )}
    </div>
  );
}
