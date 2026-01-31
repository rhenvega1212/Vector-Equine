"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminBadge } from "@/components/shared/admin-badge";
import type { Profile } from "@/types/database";
import { Settings, Loader2, Bell, Share2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileHeaderProps {
  profile: Profile & { role?: string };
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isOwnProfile: boolean;
  isFollowing: boolean;
  currentUserId?: string;
  unreadNotifications?: number;
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

export function ProfileHeader({
  profile,
  followersCount,
  followingCount,
  postsCount,
  isOwnProfile,
  isFollowing: initialIsFollowing,
  currentUserId,
  unreadNotifications = 0,
}: ProfileHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [followers, setFollowers] = useState(followersCount);
  const { toast } = useToast();

  const initials = profile.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleFollowToggle() {
    if (!currentUserId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/profiles/${profile.id}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        setFollowers((prev) => (isFollowing ? prev - 1 : prev + 1));
      }
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleShare() {
    const profileUrl = `${window.location.origin}/profile/${profile.username}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.display_name} on Equinti`,
          url: profileUrl,
        });
      } else {
        await navigator.clipboard.writeText(profileUrl);
        toast({
          title: "Link copied",
          description: "Profile link copied to clipboard",
        });
      }
    } catch (error) {
      // User cancelled share or error
    }
  }

  const isAdmin = profile.role === "admin";
  const isTrainer = profile.role === "trainer" && profile.trainer_approved;

  return (
    <div className="glass rounded-xl p-4 sm:p-6 mb-4">
      {/* Top bar - Instagram style header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-foreground/80">
          Equinti · Profile
        </h2>
        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <>
              <Link 
                href="/notifications" 
                className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </Link>
              <Link 
                href="/settings"
                className="p-2 rounded-lg hover:bg-white/5 transition-colors border border-cyan-400/30"
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Profile info section */}
      <div className="flex items-start gap-4 sm:gap-6">
        {/* Avatar with glow ring */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-30 blur-sm" />
          <Avatar className="relative h-20 w-20 sm:h-24 sm:w-24 border-2 border-cyan-400/40 ring-2 ring-cyan-400/20 ring-offset-2 ring-offset-background">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-xl sm:text-2xl bg-gradient-to-br from-slate-800 to-slate-900">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Info column */}
        <div className="flex-1 min-w-0">
          {/* Name row with admin badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {profile.display_name}
            </h1>
            {isAdmin && <AdminBadge />}
            {isTrainer && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-400/40">
                Trainer
              </span>
            )}
          </div>

          {/* Username */}
          <p className="text-sm text-cyan-400 mb-2">@{profile.username}</p>

          {/* Location and discipline */}
          {(profile.location || profile.discipline) && (
            <p className="text-sm text-muted-foreground mb-2">
              {[profile.location, profile.discipline].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-3 sm:line-clamp-none">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Stats row - glass card style */}
      <div className="flex justify-between items-center mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <button className="flex-1 text-center group cursor-default">
          <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-cyan-400 transition-colors">
            {formatCount(postsCount)}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Posts</p>
        </button>
        <div className="w-px h-10 bg-white/10" />
        <button className="flex-1 text-center group cursor-default">
          <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-cyan-400 transition-colors">
            {formatCount(followers)}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Followers</p>
        </button>
        <div className="w-px h-10 bg-white/10" />
        <button className="flex-1 text-center group cursor-default">
          <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-cyan-400 transition-colors">
            {formatCount(followingCount)}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Following</p>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-6">
        {isOwnProfile ? (
          <>
            <Link href="/settings" className="flex-1">
              <Button 
                variant="outline" 
                className="w-full h-11 border-cyan-400/30 hover:bg-cyan-400/10 hover:border-cyan-400/50 transition-all"
              >
                Edit Profile
              </Button>
            </Link>
            <Button 
              variant="outline"
              className="h-11 px-6 border-cyan-400/30 hover:bg-cyan-400/10 hover:border-cyan-400/50 transition-all"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </>
        ) : currentUserId ? (
          <>
            <Button
              variant={isFollowing ? "outline" : "default"}
              onClick={handleFollowToggle}
              disabled={isLoading}
              className={`flex-1 h-11 ${
                !isFollowing 
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-semibold shadow-lg shadow-cyan-500/25" 
                  : "border-cyan-400/30 hover:bg-cyan-400/10"
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                "Following"
              ) : (
                "Follow"
              )}
            </Button>
            <Button 
              variant="outline"
              className="h-11 px-6 border-cyan-400/30 hover:bg-cyan-400/10 hover:border-cyan-400/50"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
