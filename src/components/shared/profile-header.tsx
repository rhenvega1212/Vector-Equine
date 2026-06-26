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
          title: `${profile.display_name} on Vector Equine`,
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
          Vector Equine · Profile
        </h2>
        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <>
              <Link 
                href="/notifications" 
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </Link>
              <Link 
                href="/settings"
                className="p-2 rounded-lg hover:bg-muted transition-colors border border-primary/30"
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
          <Avatar className="relative h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/40 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-xl sm:text-2xl bg-gradient-to-br from-muted to-muted/80">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Info column */}
        <div className="flex-1 min-w-0">
          {/* Name row with admin badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {profile.display_name}
            </h1>
            {isAdmin && <AdminBadge />}
            {isTrainer && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                Trainer
              </span>
            )}
          </div>

          {/* Username */}
          <p className="text-sm text-primary mb-2">@{profile.username}</p>

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
      <div className="flex justify-between items-center mt-5 sm:mt-6 p-3 sm:p-4 rounded-xl bg-muted/50 border border-border">
        <button className="flex-1 text-center group cursor-default">
          <p className="text-xl sm:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
            {formatCount(postsCount)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Posts</p>
        </button>
        <div className="w-px h-8 sm:h-10 bg-border" />
        <button className="flex-1 text-center group cursor-default">
          <p className="text-xl sm:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
            {formatCount(followers)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Followers</p>
        </button>
        <div className="w-px h-8 sm:h-10 bg-border" />
        <button className="flex-1 text-center group cursor-default">
          <p className="text-xl sm:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
            {formatCount(followingCount)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Following</p>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 sm:gap-3 mt-5 sm:mt-6">
        {isOwnProfile ? (
          <>
            <Link href="/settings" className="flex-1">
              <Button 
                variant="outline" 
                className="w-full h-9 sm:h-11 text-sm border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                Edit Profile
              </Button>
            </Link>
            <Button 
              variant="outline"
              className="h-9 sm:h-11 px-4 sm:px-6 text-sm border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </>
        ) : currentUserId ? (
          <>
            <Button
              variant={isFollowing ? "outline" : "default"}
              onClick={handleFollowToggle}
              disabled={isLoading}
              className={`flex-1 h-9 sm:h-11 text-sm ${
                !isFollowing 
                  ? "bg-gold text-navy font-semibold hover:bg-gold/90" 
                  : "border-primary/30 hover:bg-primary/10"
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
              className="h-9 sm:h-11 px-4 sm:px-6 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
