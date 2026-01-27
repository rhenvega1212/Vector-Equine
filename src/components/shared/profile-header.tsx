"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/types/database";
import { MapPin, Calendar, Settings, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ProfileHeaderProps {
  profile: Profile;
  followersCount: number;
  followingCount: number;
  isOwnProfile: boolean;
  isFollowing: boolean;
  currentUserId?: string;
}

export function ProfileHeader({
  profile,
  followersCount,
  followingCount,
  isOwnProfile,
  isFollowing: initialIsFollowing,
  currentUserId,
}: ProfileHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [followers, setFollowers] = useState(followersCount);

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

  return (
    <div className="bg-card rounded-lg border p-6 mb-6">
      <div className="flex flex-col md:flex-row gap-6">
        <Avatar className="h-24 w-24 md:h-32 md:w-32">
          <AvatarImage src={profile.avatar_url || undefined} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.display_name}</h1>
                {profile.role === "trainer" && profile.trainer_approved && (
                  <Badge>Trainer</Badge>
                )}
                {profile.role === "admin" && (
                  <Badge variant="secondary">Admin</Badge>
                )}
              </div>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>

            <div className="flex gap-2">
              {isOwnProfile ? (
                <Link href="/settings">
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </Link>
              ) : currentUserId ? (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  onClick={handleFollowToggle}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>

          {profile.bio && (
            <p className="mt-4 text-sm">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            {profile.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {profile.location}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Joined {formatDate(profile.created_at)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {profile.discipline && (
              <Badge variant="outline">{profile.discipline}</Badge>
            )}
            {profile.rider_level && (
              <Badge variant="outline">{profile.rider_level}</Badge>
            )}
          </div>

          <div className="flex gap-6 mt-4">
            <div>
              <span className="font-semibold">{followers}</span>{" "}
              <span className="text-muted-foreground">followers</span>
            </div>
            <div>
              <span className="font-semibold">{followingCount}</span>{" "}
              <span className="text-muted-foreground">following</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
