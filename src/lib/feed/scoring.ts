import { HomeFeedConfig } from "./config";

export function computeRecencyScore(
  createdAt: string,
  maxHours: number,
  now: number = Date.now()
): number {
  const ageMs = now - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours >= maxHours) return 0;
  return 1 - ageHours / maxHours;
}

/**
 * Engagement velocity: weighted engagement divided by age in hours.
 * Rewards posts that accumulate engagement quickly.
 */
export function computeEngagementVelocity(
  likes: number,
  comments: number,
  saves: number,
  createdAt: string,
  now: number = Date.now()
): number {
  const ageHours = Math.max(
    1,
    (now - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  );
  const weighted = likes * 1 + comments * 2 + saves * 3;
  return Math.log2(1 + weighted / ageHours);
}

/**
 * How much the current user has interacted with a given author.
 * interactionCount = likes on their posts + comments on their posts.
 */
export function computeRelationshipScore(interactionCount: number): number {
  return Math.min(1, interactionCount / 10);
}

/**
 * Interest match score based on tag overlap with weighted user interests.
 */
export function computeInterestScore(
  postTags: string[],
  userInterests: Map<string, number>
): number {
  if (!postTags.length || !userInterests.size) return 0;
  let total = 0;
  for (const tag of postTags) {
    const w = userInterests.get(tag.toLowerCase());
    if (w) total += w;
  }
  return Math.min(1, total / 5);
}

export function scoreFollowedPost(
  post: {
    created_at: string;
    post_likes: { user_id: string }[];
    post_saves?: { user_id: string }[];
    comments: { id: string }[];
  },
  interactionCount: number,
  config: HomeFeedConfig,
  now: number = Date.now()
): number {
  const recency = computeRecencyScore(
    post.created_at,
    config.followedRecencyMaxHours,
    now
  );
  const velocity = computeEngagementVelocity(
    post.post_likes?.length ?? 0,
    post.comments?.length ?? 0,
    post.post_saves?.length ?? 0,
    post.created_at,
    now
  );
  const normalizedVelocity = Math.min(1, velocity / 4);
  const relationship = computeRelationshipScore(interactionCount);

  return (
    recency * config.followedRecencyWeight +
    normalizedVelocity * config.followedEngagementWeight +
    relationship * config.followedRelationshipWeight
  );
}

export function scoreSuggestedPost(
  post: {
    created_at: string;
    tags: string[];
    post_likes: { user_id: string }[];
    comments: { id: string }[];
  },
  userInterests: Map<string, number>,
  config: HomeFeedConfig,
  now: number = Date.now()
): number {
  const recency = computeRecencyScore(
    post.created_at,
    config.suggestedRecencyMaxHours,
    now
  );
  const engagement = Math.log2(
    1 +
      (post.post_likes?.length ?? 0) +
      (post.comments?.length ?? 0) * 2
  );
  const normalizedEngagement = Math.min(1, engagement / 6);
  const interest = computeInterestScore(post.tags ?? [], userInterests);

  return (
    recency * config.suggestedRecencyWeight +
    normalizedEngagement * config.suggestedEngagementWeight +
    interest * config.suggestedInterestWeight
  );
}

/**
 * Interleave followed posts, suggested posts, and ads into a single feed.
 *
 * Priority: followed > ads (at interval) > suggested (fills gaps).
 * Suggested posts are also sprinkled among followed posts for a natural feel.
 */
export function interleaveFeed<TPost, TAd>(
  followed: TPost[],
  suggested: TPost[],
  ads: TAd[],
  adInterval: number,
  suggestedMixInterval: number,
  limit: number,
  startOrganicCount: number = 0,
  startAdCount: number = 0
): {
  items: ({ item: TPost; kind: "post" } | { item: TAd; kind: "ad" })[];
  organicCount: number;
  adCount: number;
} {
  const items: ({ item: TPost; kind: "post" } | { item: TAd; kind: "ad" })[] = [];
  let fIdx = 0;
  let sIdx = 0;
  let aIdx = 0;
  let organicCount = startOrganicCount;
  let adCount = startAdCount;
  let followedSinceLastSuggested = 0;

  while (items.length < limit) {
    const organicSinceLastAd = organicCount - adCount * adInterval;

    if (
      adInterval > 0 &&
      organicSinceLastAd >= adInterval &&
      aIdx < ads.length
    ) {
      items.push({ item: ads[aIdx], kind: "ad" });
      aIdx++;
      adCount++;
      continue;
    }

    if (
      followedSinceLastSuggested >= suggestedMixInterval &&
      sIdx < suggested.length &&
      fIdx < followed.length
    ) {
      items.push({ item: suggested[sIdx], kind: "post" });
      sIdx++;
      organicCount++;
      followedSinceLastSuggested = 0;
      continue;
    }

    if (fIdx < followed.length) {
      items.push({ item: followed[fIdx], kind: "post" });
      fIdx++;
      organicCount++;
      followedSinceLastSuggested++;
      continue;
    }

    if (sIdx < suggested.length) {
      items.push({ item: suggested[sIdx], kind: "post" });
      sIdx++;
      organicCount++;
      followedSinceLastSuggested = 0;
      continue;
    }

    break;
  }

  return { items, organicCount, adCount };
}
