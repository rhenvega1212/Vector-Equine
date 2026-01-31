import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { ArrowLeft, Bell } from "lucide-react";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile for back link
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single() as { data: any };

  // Get notifications
  const { data: notifications } = await (supabase as any)
    .from("notifications")
    .select(`
      *,
      actor:profiles!notifications_actor_id_fkey (id, username, display_name, avatar_url),
      post:posts (id, content),
      comment:comments (id, content),
      event:events (id, title),
      challenge:challenges (id, title)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4 py-4">
      {/* Header */}
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex items-center gap-4">
          <Link 
            href={profile ? `/profile/${profile.username}` : "/feed"}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
              <Bell className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-cyan-400">{unreadCount} unread</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <NotificationsList 
        notifications={notifications || []} 
        userId={user.id} 
      />
    </div>
  );
}
