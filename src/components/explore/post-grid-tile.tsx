"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart } from "lucide-react";

interface PostGridTileProps {
  post: {
    id: string;
    content: string;
    post_media: {
      id: string;
      url: string;
      media_type: "image" | "video";
    }[];
    post_likes: { user_id: string }[];
    profiles: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    };
  };
  onClick: () => void;
}

export function PostGridTile({ post, onClick }: PostGridTileProps) {
  const initials = post.profiles.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const firstImage = post.post_media?.find((m) => m.media_type === "image");
  const likesCount = post.post_likes?.length ?? 0;
  const snippet = post.content?.slice(0, 80) + (post.content?.length > 80 ? "…" : "");

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-cyan-400/30 hover:bg-white/[0.07] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-background text-left"
    >
      {/* Thumbnail or placeholder */}
      {firstImage ? (
        <img
          src={firstImage.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <p className="text-sm text-white/70 line-clamp-4">{snippet || "No content"}</p>
        </div>
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-95 transition-opacity" />
      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-6 w-6 shrink-0 ring-2 ring-background">
            <AvatarImage src={post.profiles.avatar_url || undefined} />
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium truncate text-white drop-shadow-md">
            {post.profiles.display_name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-white/90">
          <Heart className="h-3.5 w-3.5 fill-current" />
          <span className="text-xs tabular-nums">{likesCount}</span>
        </div>
      </div>
    </button>
  );
}
