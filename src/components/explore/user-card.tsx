"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Loader2 } from "lucide-react";

interface UserCardProps {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    discipline?: string | null;
    rider_level?: string | null;
  };
  currentUserId: string;
  onFollowSuccess?: () => void;
}

export function UserCard({
  user,
  currentUserId,
  onFollowSuccess,
}: UserCardProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleFollow() {
    if (user.id === currentUserId || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/profiles/${user.id}/follow`, {
        method: "POST",
      });
      if (res.ok) {
        setIsFollowing(true);
        onFollowSuccess?.();
      }
    } finally {
      setIsLoading(false);
    }
  }

  const isOwn = user.id === currentUserId;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-white/[0.02] transition-colors">
      <Link href={`/profile/${user.username}`} className="shrink-0">
        <Avatar className="h-12 w-12 ring-2 ring-transparent hover:ring-cyan-400/30 transition-all">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${user.username}`}>
          <p className="font-semibold truncate hover:text-cyan-400 transition-colors">
            {user.display_name}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            @{user.username}
          </p>
        </Link>
        {(user.discipline || user.rider_level) && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[user.discipline, user.rider_level].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {!isOwn && (
        <Button
          size="sm"
          variant={isFollowing ? "secondary" : "outline"}
          className="shrink-0 gap-1 text-cyan-400 border-cyan-400/40 hover:bg-cyan-400/10"
          onClick={handleFollow}
          disabled={isLoading || isFollowing}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UserPlus className="h-3 w-3" />
          )}
          {isFollowing ? "Following" : "Follow"}
        </Button>
      )}
    </div>
  );
}
