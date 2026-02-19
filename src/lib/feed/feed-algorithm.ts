import { SupabaseClient } from "@supabase/supabase-js";
import { HomeFeedConfig, DEFAULT_HOME_FEED_CONFIG } from "./config";
import {
  HomeFeedItem,
  HomeFeedPostItem,
  HomeFeedAdItem,
  HomeFeedResult,
  HomeFeedCursorData,
} from "./types";
import {
  scoreFollowedPost,
  scoreSuggestedPost,
  interleaveFeed,
} from "./scoring";

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

export function encodeCursor(data: HomeFeedCursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

export function decodeCursor(cursor: string): HomeFeedCursorData {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    return { seenPostIds: [], seenAdIds: [], organicCount: 0, adCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

const POST_SELECT = `
  id, author_id, content, tags, created_at,
  profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
  post_media (*),
  post_likes (user_id),
  comments (id)
`;

async function getFollowingIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  return new Set((data ?? []).map((r: any) => r.following_id));
}

async function getBlockedAndMutedIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  return new Set((data ?? []).map((r: any) => r.blocked_id));
}

async function getUserInterests(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("user_interests")
    .select("tag, weight")
    .eq("user_id", userId);
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.tag.toLowerCase(), row.weight);
  }
  return map;
}

async function getSeenPostIds(
  supabase: SupabaseClient,
  userId: string,
  cooldownDays: number
): Promise<Set<string>> {
  const cutoff = new Date(
    Date.now() - cooldownDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("user_seen_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_type", "post")
    .gte("seen_at", cutoff);

  return new Set((data ?? []).map((r: any) => r.item_id));
}

/**
 * Build a map of author_id → interaction count for the current user.
 * Interactions = posts liked + posts commented on authored by that person.
 */
async function getRelationshipStrengths(
  supabase: SupabaseClient,
  userId: string,
  authorIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (authorIds.length === 0) return map;

  const [{ data: likedPosts }, { data: commentedPosts }] = await Promise.all([
    supabase
      .from("post_likes")
      .select("posts!inner(author_id)")
      .eq("user_id", userId)
      .in("posts.author_id", authorIds),
    supabase
      .from("comments")
      .select("posts!inner(author_id)")
      .eq("author_id", userId)
      .in("posts.author_id", authorIds),
  ]);

  for (const row of likedPosts ?? []) {
    const aid = (row as any).posts?.author_id;
    if (aid) map.set(aid, (map.get(aid) ?? 0) + 1);
  }
  for (const row of commentedPosts ?? []) {
    const aid = (row as any).posts?.author_id;
    if (aid) map.set(aid, (map.get(aid) ?? 0) + 1);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Post fetchers
// ---------------------------------------------------------------------------

async function fetchFollowedPosts(
  supabase: SupabaseClient,
  followingIds: Set<string>,
  userId: string,
  seenPostIds: Set<string>,
  cursorSeenIds: string[],
  limit: number
): Promise<any[]> {
  const ids = Array.from(followingIds).concat(userId).filter(Boolean);
  if (ids.length === 0) return [];

  const excludeSet = new Set(Array.from(seenPostIds).concat(cursorSeenIds));

  const { data } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .in("author_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit * 5);

  return (data ?? []).filter((p: any) => !excludeSet.has(p.id));
}

async function fetchSuggestedPosts(
  supabase: SupabaseClient,
  followingIds: Set<string>,
  blockedIds: Set<string>,
  userId: string,
  seenPostIds: Set<string>,
  cursorSeenIds: string[],
  limit: number
): Promise<any[]> {
  const excludeAuthors = Array.from(followingIds).concat(Array.from(blockedIds)).concat(userId).filter(Boolean);
  const excludeSet = new Set(Array.from(seenPostIds).concat(cursorSeenIds));

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit * 4);

  if (excludeAuthors.length > 0) {
    query = query.not(
      "author_id",
      "in",
      `(${excludeAuthors.join(",")})`
    );
  }

  const { data } = await query;

  return (data ?? []).filter((p: any) => !excludeSet.has(p.id));
}

async function fetchEligibleAds(
  supabase: SupabaseClient,
  userId: string,
  cursorSeenAdIds: string[]
): Promise<any[]> {
  const now = new Date().toISOString();

  const { data: ads } = await supabase
    .from("ads")
    .select("*")
    .eq("is_active", true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`);

  if (!ads || ads.length === 0) return [];

  const capCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentImpressions } = await supabase
    .from("user_seen_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_type", "ad")
    .gte("seen_at", capCutoff);

  const impressionCounts = new Map<string, number>();
  for (const row of recentImpressions ?? []) {
    impressionCounts.set(
      row.item_id,
      (impressionCounts.get(row.item_id) ?? 0) + 1
    );
  }

  const cursorAdSet = new Set(cursorSeenAdIds);

  return ads
    .filter((ad: any) => {
      if (cursorAdSet.has(ad.id)) return false;
      const count = impressionCounts.get(ad.id) ?? 0;
      if (count >= ad.max_impressions_per_user) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const aPace = a.daily_budget_cents
        ? 1 - (impressionCounts.get(a.id) ?? 0) / a.daily_budget_cents
        : 1;
      const bPace = b.daily_budget_cents
        ? 1 - (impressionCounts.get(b.id) ?? 0) / b.daily_budget_cents
        : 1;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return bPace - aPace;
    });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function getHomeFeed(
  supabase: SupabaseClient,
  userId: string,
  cursor: string | null,
  limit?: number,
  configOverride?: Partial<HomeFeedConfig>
): Promise<HomeFeedResult> {
  const config: HomeFeedConfig = {
    ...DEFAULT_HOME_FEED_CONFIG,
    ...configOverride,
  };
  const pageSize = Math.min(limit ?? config.defaultLimit, config.maxLimit);

  const cursorData = cursor
    ? decodeCursor(cursor)
    : { seenPostIds: [], seenAdIds: [], organicCount: 0, adCount: 0 };

  // Parallel data fetching
  const [followingIds, blockedIds, userInterests, seenPostIds] =
    await Promise.all([
      getFollowingIds(supabase, userId),
      getBlockedAndMutedIds(supabase, userId),
      getUserInterests(supabase, userId),
      getSeenPostIds(supabase, userId, config.seenCooldownDays),
    ]);

  // Fetch posts and ads in parallel
  const [rawFollowed, rawSuggested, eligibleAds] = await Promise.all([
    fetchFollowedPosts(
      supabase,
      followingIds,
      userId,
      seenPostIds,
      cursorData.seenPostIds,
      pageSize
    ),
    fetchSuggestedPosts(
      supabase,
      followingIds,
      blockedIds,
      userId,
      seenPostIds,
      cursorData.seenPostIds,
      pageSize
    ),
    config.adInterval > 0
      ? fetchEligibleAds(supabase, userId, cursorData.seenAdIds)
      : Promise.resolve([]),
  ]);

  // Compute relationship strengths for followed-post authors
  const followedAuthorIds = Array.from(
    new Set(rawFollowed.map((p: any) => p.author_id))
  );
  const relationships = await getRelationshipStrengths(
    supabase,
    userId,
    followedAuthorIds
  );

  // Score and sort followed posts
  const now = Date.now();
  const scoredFollowed: HomeFeedPostItem[] = rawFollowed
    .map((p: any) => ({
      type: "post" as const,
      id: p.id,
      post: p,
      score: scoreFollowedPost(p, relationships.get(p.author_id) ?? 0, config, now),
      source: "followed" as const,
    }))
    .sort((a, b) => b.score - a.score || b.post.created_at.localeCompare(a.post.created_at) || a.id.localeCompare(b.id));

  // Score and sort suggested posts
  const scoredSuggested: HomeFeedPostItem[] = rawSuggested
    .map((p: any) => ({
      type: "post" as const,
      id: p.id,
      post: p,
      score: scoreSuggestedPost(p, userInterests, config, now),
      source: "suggested" as const,
    }))
    .sort((a, b) => b.score - a.score || b.post.created_at.localeCompare(a.post.created_at) || a.id.localeCompare(b.id));

  // Format ads
  const formattedAds: HomeFeedAdItem[] = eligibleAds.map((ad: any) => ({
    type: "ad" as const,
    id: `ad_${ad.id}`,
    ad: {
      id: ad.id,
      advertiser_name: ad.advertiser_name,
      title: ad.title,
      body: ad.body,
      image_url: ad.image_url,
      click_url: ad.click_url,
      tags: ad.tags ?? [],
    },
  }));

  // Interleave
  const { items: interleaved, organicCount, adCount } = interleaveFeed(
    scoredFollowed,
    scoredSuggested,
    formattedAds,
    config.adInterval,
    config.suggestedMixInterval,
    pageSize,
    cursorData.organicCount,
    cursorData.adCount
  );

  // Build result
  const items: HomeFeedItem[] = interleaved.map((entry) => {
    if (entry.kind === "ad") return entry.item as HomeFeedAdItem;
    return entry.item as HomeFeedPostItem;
  });

  // Build next cursor
  const newSeenPostIds = [
    ...cursorData.seenPostIds,
    ...items.filter((i) => i.type === "post").map((i) => i.id),
  ];
  const newSeenAdIds = [
    ...cursorData.seenAdIds,
    ...items
      .filter((i) => i.type === "ad")
      .map((i) => (i as HomeFeedAdItem).ad.id),
  ];

  const hasMore =
    items.length >= pageSize &&
    (scoredFollowed.length > 0 || scoredSuggested.length > 0);

  const nextCursor = hasMore
    ? encodeCursor({
        seenPostIds: newSeenPostIds,
        seenAdIds: newSeenAdIds,
        organicCount,
        adCount,
      })
    : null;

  return { items, nextCursor, hasMore };
}

/**
 * Record seen items into `user_seen_items` for cooldown tracking.
 * Call from the client or server after a page is rendered.
 */
export async function recordHomeFeedSeen(
  supabase: SupabaseClient,
  userId: string,
  items: HomeFeedItem[]
): Promise<void> {
  const rows: { user_id: string; item_id: string; item_type: string }[] = [];

  for (const item of items) {
    if (item.type === "post") {
      rows.push({ user_id: userId, item_id: item.id, item_type: "post" });
    } else if (item.type === "ad") {
      rows.push({
        user_id: userId,
        item_id: (item as HomeFeedAdItem).ad.id,
        item_type: "ad",
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("user_seen_items").insert(rows);
  }
}
