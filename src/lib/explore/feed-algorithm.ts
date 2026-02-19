import { SupabaseClient } from "@supabase/supabase-js";
import { ExploreConfig, DEFAULT_EXPLORE_CONFIG } from "./config";
import {
  ExploreItem,
  ExplorePostItem,
  ExploreAdItem,
  ExploreAccountItem,
  ExploreFeedResult,
} from "./types";

interface CursorData {
  offset: number;
  seenPostIds: string[];
  seenAdIds: string[];
  seenAccountIds: string[];
}

export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

export function decodeCursor(cursor: string): CursorData {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    return { offset: 0, seenPostIds: [], seenAdIds: [], seenAccountIds: [] };
  }
}

function computeRecencyScore(
  createdAt: string,
  maxHours: number
): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours >= maxHours) return 0;
  return 1 - ageHours / maxHours;
}

function computeEngagementScore(likes: number, comments: number): number {
  return Math.log2(1 + likes + comments * 2);
}

function computeInterestScore(
  postTags: string[],
  userInterests: Map<string, number>
): number {
  if (!postTags.length || !userInterests.size) return 0;
  let total = 0;
  for (const tag of postTags) {
    const w = userInterests.get(tag.toLowerCase());
    if (w) total += w;
  }
  return total;
}

function scorePost(
  post: any,
  userInterests: Map<string, number>,
  config: ExploreConfig,
  isNearby: boolean
): number {
  const recency = computeRecencyScore(post.created_at, config.recencyMaxHours);
  const engagement = computeEngagementScore(
    post.post_likes?.length ?? 0,
    post.comments?.length ?? 0
  );
  const interest = computeInterestScore(
    post.tags ?? [],
    userInterests
  );

  let score =
    recency * config.recencyWeight +
    engagement * config.engagementWeight +
    interest * config.interestWeight;

  if (isNearby) {
    score += config.nearbyBoost;
  }
  return score;
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

async function getFollowingIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  const ids = new Set((data ?? []).map((r: any) => r.following_id));
  ids.add(userId);
  return ids;
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

async function getSeenItemIds(
  supabase: SupabaseClient,
  userId: string,
  itemType: string,
  cooldownDays: number
): Promise<Set<string>> {
  const cutoff = new Date(
    Date.now() - cooldownDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("user_seen_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .gte("seen_at", cutoff);

  return new Set((data ?? []).map((r: any) => r.item_id));
}

async function getUserLocationBucket(
  supabase: SupabaseClient,
  userId: string
): Promise<{ city: string | null; state: string | null; geohashPrefix: string | null; enabled: boolean }> {
  const { data } = await supabase
    .from("user_location_bucket")
    .select("city, state, geohash_prefix, location_enabled")
    .eq("user_id", userId)
    .single();

  if (!data) return { city: null, state: null, geohashPrefix: null, enabled: false };
  return {
    city: data.city,
    state: data.state,
    geohashPrefix: data.geohash_prefix,
    enabled: data.location_enabled ?? false,
  };
}

const POST_SELECT = `
  id, author_id, content, tags, created_at,
  profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
  post_media (*),
  post_likes (user_id),
  comments (id)
`;

async function fetchSuggestedPosts(
  supabase: SupabaseClient,
  followingIds: Set<string>,
  blockedIds: Set<string>,
  seenPostIds: Set<string>,
  cursorSeenIds: string[],
  limit: number
): Promise<any[]> {
  const excludeIds = Array.from(followingIds);
  const allExcludeAuthorIds = excludeIds.filter(Boolean);

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit * 4);

  if (allExcludeAuthorIds.length > 0) {
    query = query.not("author_id", "in", `(${allExcludeAuthorIds.join(",")})`);
  }

  const { data } = await query;

  return (data ?? []).filter((p: any) => {
    if (blockedIds.has(p.author_id)) return false;
    if (seenPostIds.has(p.id)) return false;
    if (cursorSeenIds.includes(p.id)) return false;
    return true;
  });
}

async function fetchNearbyPosts(
  supabase: SupabaseClient,
  userLocation: { city: string | null; state: string | null; geohashPrefix: string | null },
  followingIds: Set<string>,
  blockedIds: Set<string>,
  seenPostIds: Set<string>,
  cursorSeenIds: string[],
  limit: number
): Promise<any[]> {
  const nearbyUserIds: string[] = [];

  if (userLocation.city && userLocation.state) {
    const { data: nearbyUsers } = await supabase
      .from("user_location_bucket")
      .select("user_id")
      .eq("city", userLocation.city)
      .eq("state", userLocation.state)
      .eq("location_enabled", true)
      .limit(200);

    if (nearbyUsers) {
      for (const u of nearbyUsers) {
        if (!followingIds.has(u.user_id) && !blockedIds.has(u.user_id)) {
          nearbyUserIds.push(u.user_id);
        }
      }
    }
  } else if (userLocation.geohashPrefix) {
    const { data: nearbyUsers } = await supabase
      .from("user_location_bucket")
      .select("user_id")
      .like("geohash_prefix", `${userLocation.geohashPrefix}%`)
      .eq("location_enabled", true)
      .limit(200);

    if (nearbyUsers) {
      for (const u of nearbyUsers) {
        if (!followingIds.has(u.user_id) && !blockedIds.has(u.user_id)) {
          nearbyUserIds.push(u.user_id);
        }
      }
    }
  }

  if (nearbyUserIds.length === 0) return [];

  const { data } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_hidden", false)
    .in("author_id", nearbyUserIds)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  return (data ?? []).filter((p: any) => {
    if (seenPostIds.has(p.id)) return false;
    if (cursorSeenIds.includes(p.id)) return false;
    return true;
  });
}

async function fetchEligibleAds(
  supabase: SupabaseClient,
  userId: string,
  seenAdIds: Set<string>,
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
    impressionCounts.set(row.item_id, (impressionCounts.get(row.item_id) ?? 0) + 1);
  }

  return ads.filter((ad: any) => {
    if (seenAdIds.has(ad.id)) return false;
    if (cursorSeenAdIds.includes(ad.id)) return false;
    const count = impressionCounts.get(ad.id) ?? 0;
    if (count >= ad.max_impressions_per_user) return false;
    return true;
  });
}

async function fetchAccountSuggestions(
  supabase: SupabaseClient,
  userId: string,
  followingIds: Set<string>,
  blockedIds: Set<string>,
  seenAccountIds: Set<string>,
  cursorSeenAccountIds: string[],
  userInterests: Map<string, number>,
  limit: number
): Promise<ExploreAccountItem[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, discipline, rider_level, bio")
    .order("created_at", { ascending: false })
    .limit(limit * 5);

  if (!profiles) return [];

  const filtered = profiles.filter((p: any) => {
    if (followingIds.has(p.id)) return false;
    if (blockedIds.has(p.id)) return false;
    if (seenAccountIds.has(p.id)) return false;
    if (cursorSeenAccountIds.includes(p.id)) return false;
    return true;
  });

  const scored = filtered.map((p: any) => {
    let reason = "Suggested for you";
    const discipline = p.discipline?.toLowerCase();
    if (discipline && userInterests.has(discipline)) {
      reason = `Into ${p.discipline}`;
    }
    return { profile: p, reason };
  });

  return scored.slice(0, limit).map((s) => ({
    type: "account_suggestion" as const,
    id: `account_${s.profile.id}`,
    account: s.profile,
    reason: s.reason,
  }));
}

export async function getExploreFeed(
  supabase: SupabaseClient,
  userId: string,
  cursor: string | null,
  limit?: number,
  configOverride?: Partial<ExploreConfig>
): Promise<ExploreFeedResult> {
  const config: ExploreConfig = { ...DEFAULT_EXPLORE_CONFIG, ...configOverride };
  const pageSize = Math.min(limit ?? config.defaultLimit, config.maxLimit);

  const cursorData = cursor
    ? decodeCursor(cursor)
    : { offset: 0, seenPostIds: [], seenAdIds: [], seenAccountIds: [] };

  const [
    followingIds,
    blockedIds,
    userInterests,
    seenPostIds,
    seenAdIds,
    userLocation,
  ] = await Promise.all([
    getFollowingIds(supabase, userId),
    getBlockedAndMutedIds(supabase, userId),
    getUserInterests(supabase, userId),
    getSeenItemIds(supabase, userId, "post", config.seenCooldownDays),
    getSeenItemIds(supabase, userId, "ad", 1),
    getUserLocationBucket(supabase, userId),
  ]);

  const suggestedPostsNeeded = Math.ceil(pageSize * config.suggestedRatio);
  const nearbyPostsNeeded = pageSize - suggestedPostsNeeded;

  const [rawSuggested, rawNearby, eligibleAds, accountSuggestions] =
    await Promise.all([
      fetchSuggestedPosts(
        supabase,
        followingIds,
        blockedIds,
        seenPostIds,
        cursorData.seenPostIds,
        suggestedPostsNeeded
      ),
      userLocation.enabled
        ? fetchNearbyPosts(
            supabase,
            userLocation,
            followingIds,
            blockedIds,
            seenPostIds,
            cursorData.seenPostIds,
            nearbyPostsNeeded
          )
        : Promise.resolve([]),
      config.adInterval > 0
        ? fetchEligibleAds(supabase, userId, seenAdIds, cursorData.seenAdIds)
        : Promise.resolve([]),
      fetchAccountSuggestions(
        supabase,
        userId,
        followingIds,
        blockedIds,
        new Set<string>(),
        cursorData.seenAccountIds,
        userInterests,
        config.maxAccountSuggestionsPerPage
      ),
    ]);

  const scoredSuggested: ExplorePostItem[] = rawSuggested
    .map((p: any) => ({
      type: "post" as const,
      id: p.id,
      post: p,
      score: scorePost(p, userInterests, config, false),
      source: "suggested" as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, suggestedPostsNeeded);

  const scoredNearby: ExplorePostItem[] = rawNearby
    .map((p: any) => ({
      type: "post" as const,
      id: p.id,
      post: p,
      score: scorePost(p, userInterests, config, true),
      source: "nearby" as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, nearbyPostsNeeded);

  // Merge: suggested first, then nearby (priority order)
  const postItems: ExplorePostItem[] = [...scoredSuggested, ...scoredNearby];

  // Interleave account suggestions and ads into the post stream
  const items: ExploreItem[] = [];
  let postIdx = 0;
  let adIdx = 0;
  let accountIdx = 0;
  let position = 0;

  while (postIdx < postItems.length || accountIdx < accountSuggestions.length) {
    // Check if an ad should go here
    if (
      config.adInterval > 0 &&
      position > 0 &&
      position % config.adInterval === 0 &&
      adIdx < eligibleAds.length
    ) {
      const ad = eligibleAds[adIdx];
      items.push({
        type: "ad",
        id: `ad_${ad.id}`,
        ad: {
          id: ad.id,
          advertiser_name: ad.advertiser_name,
          title: ad.title,
          body: ad.body,
          image_url: ad.image_url,
          click_url: ad.click_url,
          tags: ad.tags,
        },
      } as ExploreAdItem);
      adIdx++;
      position++;
      continue;
    }

    // Check if an account suggestion should go here
    if (
      accountIdx < accountSuggestions.length &&
      position >= config.accountSuggestionStartIndex &&
      (position - config.accountSuggestionStartIndex) %
        config.accountSuggestionInterval ===
        0
    ) {
      items.push(accountSuggestions[accountIdx]);
      accountIdx++;
      position++;
      continue;
    }

    // Otherwise place a post
    if (postIdx < postItems.length) {
      items.push(postItems[postIdx]);
      postIdx++;
    } else if (accountIdx < accountSuggestions.length) {
      items.push(accountSuggestions[accountIdx]);
      accountIdx++;
    } else {
      break;
    }
    position++;
  }

  const newSeenPostIds = [
    ...cursorData.seenPostIds,
    ...items.filter((i) => i.type === "post").map((i) => i.id),
  ];
  const newSeenAdIds = [
    ...cursorData.seenAdIds,
    ...items
      .filter((i) => i.type === "ad")
      .map((i) => (i as ExploreAdItem).ad.id),
  ];
  const newSeenAccountIds = [
    ...cursorData.seenAccountIds,
    ...items
      .filter((i) => i.type === "account_suggestion")
      .map((i) => (i as ExploreAccountItem).account.id),
  ];

  const nextCursor = encodeCursor({
    offset: cursorData.offset + items.length,
    seenPostIds: newSeenPostIds,
    seenAdIds: newSeenAdIds,
    seenAccountIds: newSeenAccountIds,
  });

  const hasMore = postItems.length >= suggestedPostsNeeded;

  return { items, nextCursor, hasMore };
}

export async function recordSeenItems(
  supabase: SupabaseClient,
  userId: string,
  items: ExploreItem[]
): Promise<void> {
  const rows: { user_id: string; item_id: string; item_type: string }[] = [];

  for (const item of items) {
    if (item.type === "post") {
      rows.push({ user_id: userId, item_id: item.id, item_type: "post" });
    } else if (item.type === "ad") {
      rows.push({
        user_id: userId,
        item_id: (item as ExploreAdItem).ad.id,
        item_type: "ad",
      });
    } else if (item.type === "account_suggestion") {
      rows.push({
        user_id: userId,
        item_id: (item as ExploreAccountItem).account.id,
        item_type: "account",
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("user_seen_items").insert(rows);
  }
}

// Re-export for testing
export {
  computeRecencyScore as _computeRecencyScore,
  computeEngagementScore as _computeEngagementScore,
  computeInterestScore as _computeInterestScore,
  scorePost as _scorePost,
};
