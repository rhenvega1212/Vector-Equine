"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { Heart, MessageCircle, UserPlus, Reply, Check, CheckCheck, Bell } from "lucide-react";

interface Notification {
  id: string;
  type: "follow" | "like" | "comment" | "reply" | "event_rsvp" | "challenge_enrollment";
  message?: string;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  post?: {
    id: string;
    content: string;
  };
  comment?: {
    id: string;
    content: string;
  };
  event?: {
    id: string;
    title: string;
  };
  challenge?: {
    id: string;
    title: string;
  };
}

interface NotificationsListProps {
  notifications: Notification[];
  userId: string;
}

export function NotificationsList({ notifications, userId }: NotificationsListProps) {
  const [items, setItems] = useState(notifications);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = items.filter(n => !n.is_read).length;

  async function markAllAsRead() {
    if (unreadCount === 0) return;
    
    setIsMarkingAll(true);
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });

      if (response.ok) {
        setItems(items.map(n => ({ ...n, is_read: true })));
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function markAsRead(id: string) {
    const notification = items.find(n => n.id === id);
    if (!notification || notification.is_read) return;

    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });
      setItems(items.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "follow":
        return <UserPlus className="h-3.5 w-3.5 text-cyan-400" />;
      case "like":
        return <Heart className="h-3.5 w-3.5 text-red-400 fill-red-400" />;
      case "comment":
        return <MessageCircle className="h-3.5 w-3.5 text-blue-400" />;
      case "reply":
        return <Reply className="h-3.5 w-3.5 text-green-400" />;
      default:
        return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  }

  function getNotificationText(notification: Notification) {
    const actorName = notification.actor?.display_name || "Someone";
    
    switch (notification.type) {
      case "follow":
        return <><span className="font-semibold text-foreground">{actorName}</span> started following you</>;
      case "like":
        return <><span className="font-semibold text-foreground">{actorName}</span> liked your post</>;
      case "comment":
        return <><span className="font-semibold text-foreground">{actorName}</span> commented on your post</>;
      case "reply":
        return <><span className="font-semibold text-foreground">{actorName}</span> replied to your comment</>;
      case "event_rsvp":
        return <><span className="font-semibold text-foreground">{actorName}</span> is going to your event</>;
      case "challenge_enrollment":
        return <><span className="font-semibold text-foreground">{actorName}</span> joined your challenge</>;
      default:
        return notification.message || "New notification";
    }
  }

  function getNotificationLink(notification: Notification) {
    switch (notification.type) {
      case "follow":
        return notification.actor ? `/profile/${notification.actor.username}` : "#";
      case "like":
      case "comment":
      case "reply":
        return notification.post ? `/feed?post=${notification.post.id}` : "#";
      case "event_rsvp":
        return notification.event ? "/train" : "#";
      case "challenge_enrollment":
        return notification.challenge ? `/challenges/${notification.challenge.id}` : "#";
      default:
        return "#";
    }
  }

  if (items.length === 0) {
    return (
      <div className="glass rounded-xl py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
          <Bell className="h-10 w-10 text-cyan-400/50" />
        </div>
        <p className="text-lg font-medium text-foreground/80">No notifications yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          When someone interacts with you, you&apos;ll see it here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            disabled={isMarkingAll}
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read ({unreadCount})
          </Button>
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden divide-y divide-cyan-400/10">
        {items.map((notification) => {
          const initials = notification.actor?.display_name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "?";

          return (
            <Link
              key={notification.id}
              href={getNotificationLink(notification)}
              onClick={() => markAsRead(notification.id)}
              className={`flex items-start gap-3 p-4 transition-all hover:bg-white/5 ${
                !notification.is_read ? "bg-cyan-500/5" : ""
              }`}
            >
              <div className="relative flex-shrink-0">
                <Avatar className="h-11 w-11 border border-cyan-400/20">
                  <AvatarImage src={notification.actor?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-slate-800 to-slate-900 text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-1 border border-cyan-400/20">
                  {getNotificationIcon(notification.type)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm text-muted-foreground ${!notification.is_read ? "text-foreground/80" : ""}`}>
                  {getNotificationText(notification)}
                </p>
                {notification.post?.content && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1 italic">
                    &ldquo;{notification.post.content}&rdquo;
                  </p>
                )}
                <p className="text-xs text-cyan-400/60 mt-1.5">
                  {formatRelativeTime(notification.created_at)}
                </p>
              </div>

              {!notification.is_read && (
                <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0 animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
