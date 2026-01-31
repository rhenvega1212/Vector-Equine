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

  // Get counts in parallel
  const [followersResult, followingResult, postsCountResult] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", profile.id)
      .eq("is_hidden", false),
  ]) as any[];
  
  const followersCount = followersResult.count || 0;
  const followingCount = followingResult.count || 0;
  const postsCount = postsCountResult.count || 0;

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

  // Get unread notifications count for own profile
  let unreadNotifications = 0;
  if (user && user.id === profile.id) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    unreadNotifications = count || 0;
  }

  // Get user's posts with role info
  const { data: posts } = await supabase
    .from("posts")
    .select(`
      *,
      post_media (*),
      profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
      post_likes (user_id),
      comments (id)
    `)
    .eq("author_id", profile.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(50) as { data: any[] | null };

  // Get user's challenge enrollments (only published challenges for non-admins)
  const { data: enrollments } = await supabase
    .from("challenge_enrollments")
    .select(`
      *,
      challenges (id, title, cover_image_url, difficulty, status)
    `)
    .eq("user_id", profile.id)
    .limit(20) as { data: any[] | null };

  // Filter out draft challenges if not the user's own profile or not an admin
  const filteredEnrollments = enrollments?.filter((e: any) => 
    e.challenges?.status === "published" || 
    (user && user.id === profile.id) ||
    profile.role === "admin"
  ) || [];

  // Get user's event RSVPs
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select(`
      *,
      events (id, title, start_time, event_type, location_city, location_state, status)
    `)
    .eq("user_id", profile.id)
    .eq("status", "going")
    .limit(20) as { data: any[] | null };

  // Filter out draft events
  const filteredRsvps = rsvps?.filter((r: any) => 
    r.events?.status === "published" || r.events?.is_published === true ||
    (user && user.id === profile.id) ||
    profile.role === "admin"
  ) || [];

  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4">
      <ProfileHeader
        profile={profile}
        followersCount={followersCount}
        followingCount={followingCount}
        postsCount={postsCount}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        currentUserId={user?.id}
        unreadNotifications={unreadNotifications}
      />
      <ProfileTabs
        posts={posts || []}
        enrollments={filteredEnrollments}
        rsvps={filteredRsvps}
        currentUserId={user?.id}
      />
    </div>
  );
}
