"use client";

import { FeedList } from "./feed-list";

interface FeedTabsProps {
  userId: string;
}

/**
 * Single Feed tab showing all users' posts.
 * Room for a future algorithm to sort/boost posts (see API: type=feed).
 */
export function FeedTabs({ userId }: FeedTabsProps) {
  return (
    <div className="mt-6">
      <FeedList type="feed" userId={userId} />
    </div>
  );
}
