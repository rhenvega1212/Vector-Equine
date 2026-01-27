import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileHeader } from "@/components/shared/profile-header";
import { ProfileTabs } from "@/components/shared/profile-tabs";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Get profile by username
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single() as { data: any };

  if (!profile) {
    notFound();
  }

  // Get follow counts
  const [followersResult, followingResult] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
  ]) as any[];
  const followersCount = followersResult.count;
  const followingCount = followingResult.count;

  // Check if current user follows this profile
  let isFollowing = false;
  if (user && user.id !== profile.id) {
    const { data: followData } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .single();
    isFollowing = !!followData;
  }

  // Get user's posts
  const { data: posts } = await supabase
    .from("posts")
    .select(`
      *,
      post_media (*),
      profiles!posts_author_id_fkey (id, username, display_name, avatar_url),
      post_likes (user_id),
      comments (id)
    `)
    .eq("author_id", profile.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20) as { data: any[] | null };

  // Get user's challenge enrollments
  const { data: enrollments } = await supabase
    .from("challenge_enrollments")
    .select(`
      *,
      challenges (id, title, cover_image_url, difficulty, status)
    `)
    .eq("user_id", profile.id)
    .limit(10) as { data: any[] | null };

  // Get user's event RSVPs
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select(`
      *,
      events (id, title, start_time, event_type, location_city, location_state)
    `)
    .eq("user_id", profile.id)
    .eq("status", "going")
    .limit(10) as { data: any[] | null };

  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="max-w-4xl mx-auto">
      <ProfileHeader
        profile={profile}
        followersCount={followersCount || 0}
        followingCount={followingCount || 0}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        currentUserId={user?.id}
      />
      <ProfileTabs
        posts={posts || []}
        enrollments={enrollments || []}
        rsvps={rsvps || []}
        currentUserId={user?.id}
      />
    </div>
  );
}
