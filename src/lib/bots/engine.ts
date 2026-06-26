import { TZDate } from "@date-fns/tz";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BOT_PROFILES,
  BOT_IDS,
  SCHEDULE_CONFIG,
  type BotProfile,
} from "./bot-config";
import { CONTENT_POOL, type ContentTemplate } from "./content-pool";
import { COMMENT_POOL, type CommentTemplate } from "./comment-pool";
import { MEDIA_POOL, type MediaItem } from "./media-pool";
import type { PlannedPost } from "./scheduler";

// =============================================================================
// HELPERS
// =============================================================================

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset(tags: string[], max: number): string[] {
  if (tags.length === 0) return [];
  const count = Math.floor(Math.random() * Math.min(max, tags.length)) + 1;
  const shuffled = [...tags].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// =============================================================================
// CONTENT SELECTION
//
// Picks a post from the content pool that matches the bot's discipline and
// hasn't been used recently. For photo posts, also tries to match the photo's
// tags so the caption fits the image.
// =============================================================================

function selectContent(
  bot: BotProfile,
  recentContents: string[],
  matchTags?: string[]
): ContentTemplate {
  let pool = CONTENT_POOL.filter(
    (c) =>
      (c.disciplines.length === 0 ||
        c.disciplines.includes(bot.discipline) ||
        c.tags.some((t) => bot.contentAffinity.includes(t))) &&
      !recentContents.includes(c.content)
  );

  if (matchTags && matchTags.length > 0) {
    const tagged = pool.filter((c) =>
      c.tags.some((t) => matchTags.includes(t))
    );
    if (tagged.length > 0) pool = tagged;
  }

  if (pool.length === 0) return pickRandom(CONTENT_POOL);
  return pickRandom(pool);
}

// =============================================================================
// MEDIA SELECTION WITH ROTATION
//
// Queries the database for photos that bots have already used within the
// cooldown window, then picks from the unused portion of the 95-image pool.
// At 1 photo per day and a 60-day cooldown, images rotate naturally without
// repeating for ~2 months.
// =============================================================================

async function getRecentlyUsedMediaUrls(
  admin: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  const cooldownDate = new Date(
    Date.now() - SCHEDULE_CONFIG.mediaCooldownDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: botPosts } = await admin
    .from("posts")
    .select("id")
    .in("author_id", BOT_IDS)
    .gte("created_at", cooldownDate);

  if (!botPosts || botPosts.length === 0) return new Set();

  const postIds = botPosts.map((p: { id: string }) => p.id);

  const { data: media } = await admin
    .from("post_media")
    .select("url")
    .in("post_id", postIds);

  return new Set((media || []).map((m: { url: string }) => m.url));
}

async function selectMedia(
  admin: ReturnType<typeof createAdminClient>,
  preferTags?: string[]
): Promise<MediaItem | null> {
  if (MEDIA_POOL.length === 0) return null;

  const recentUrls = await getRecentlyUsedMediaUrls(admin);
  let available = MEDIA_POOL.filter((m) => !recentUrls.has(m.url));

  // Fallback: if every image has been used within the cooldown, allow all
  if (available.length === 0) available = [...MEDIA_POOL];

  // Prefer images whose tags overlap with the content being posted
  if (preferTags && preferTags.length > 0) {
    const tagged = available.filter((m) =>
      m.tags.some((t) => preferTags.includes(t))
    );
    if (tagged.length > 0) return pickRandom(tagged);
  }

  return pickRandom(available);
}

// =============================================================================
// POST INSERTION
// =============================================================================

async function fetchRecentBotContents(
  admin: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  const { data } = await admin
    .from("posts")
    .select("content")
    .in("author_id", BOT_IDS)
    .order("created_at", { ascending: false })
    .limit(40);

  return (data || []).map((p: { content: string }) => p.content);
}

async function insertPost(
  admin: ReturnType<typeof createAdminClient>,
  bot: BotProfile,
  content: ContentTemplate,
  media: MediaItem | null,
  hour: number,
  minuteOffset: number,
  /** Calendar day for the post in SCHEDULE_CONFIG.timezone (YYYY-MM-DD). */
  planDateStr: string
): Promise<{ postId: string; botName: string; type: string } | null> {
  const [y, mo, d] = planDateStr.split("-").map(Number);
  const sec = Math.floor(Math.random() * 60);
  const postTime = new TZDate(
    y,
    mo - 1,
    d,
    hour,
    minuteOffset,
    sec,
    SCHEDULE_CONFIG.timezone
  );
  const tags = randomSubset(content.tags, 3);

  const { data: post, error: postError } = await admin
    .from("posts")
    .insert({
      author_id: bot.id,
      content: content.content,
      tags,
      is_feed_visible: true,
      created_at: postTime.toISOString(),
    })
    .select()
    .single();

  if (postError || !post) {
    console.error("Failed to create bot post:", postError);
    return null;
  }

  if (media) {
    const { error: mediaError } = await admin.from("post_media").insert({
      post_id: post.id,
      url: media.url,
      media_type: media.mediaType,
      sort_order: 0,
    });
    if (mediaError) console.error("Failed to attach media:", mediaError);
  }

  return {
    postId: post.id,
    botName: bot.displayName,
    type: media ? "photo" : "text",
  };
}

// =============================================================================
// ENGAGEMENT
//
// Sprinkles likes and comments from bots onto recent posts (both real-user
// and bot posts). Runs alongside every post creation so engagement is spread
// across the day rather than dumped in a single batch.
// =============================================================================

/** Shuffle a copy of an array (Fisher–Yates) without mutating the original. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Desired number of likes a given post should have. Weighted so most posts feel
 * validated (4-6) while a chunk pop off (8-10) and a few stay quieter (2-3).
 * Capped later by the number of eligible bots (≤ pool size).
 */
function targetLikeCount(): number {
  const r = Math.random();
  if (r < 0.18) return 8 + Math.floor(Math.random() * 3); // 8-10 popular
  if (r < 0.62) return 4 + Math.floor(Math.random() * 3); // 4-6 typical
  return 2 + Math.floor(Math.random() * 2); // 2-3 quieter
}

/**
 * Desired number of bot comments on a post. Weighted toward a lively-but-real
 * feel: most posts get 1-2, some get 3-4, a minority get none.
 */
function targetCommentCount(): number {
  const r = Math.random();
  if (r < 0.18) return 0; // some posts ride without comments
  if (r < 0.7) return 1 + Math.floor(Math.random() * 2); // 1-2 common
  return 3 + Math.floor(Math.random() * 2); // 3-4 lively
}

// Keyword → topic map so we can infer what a post is about even when its stored
// tags are sparse (e.g. real-user posts). Used to pick comments that actually
// respond to the content instead of generic one-liners.
const TOPIC_KEYWORDS: Record<string, string[]> = {
  training: [
    "training", "lesson", "exercise", "transition", "warm-up", "warmup",
    "groundwork", "pole", "practice", "schooling", "drill", "stride",
  ],
  mindset: [
    "reminder", "patience", "confidence", "nervous", "fear", "proud",
    "grateful", "journey", "motivat", "mindset", "breathe", "progress isn't",
  ],
  "horse-care": [
    "vet", "feed", "supplement", "groom", "barn", "turnout", "hoof",
    "farrier", "blanket", "bath", "health", "stall", "pasture", "roll",
  ],
  competition: [
    "show", "competition", "compete", "ribbon", "class", "judge", "score",
    "championship", "qualif", "test", "placing",
  ],
  dressage: ["dressage", "frame", "collection", "impulsion", "topline", "contact", "half-halt", "bend"],
  jumping: ["jump", "fence", "oxer", "course", "round", "grid", "distance", "spook"],
  eventing: ["eventing", "cross country", "cross-country", "xc", "three-day"],
  western: ["western", "reining", "barrel", "spin", "sliding stop", "ranch", "lope"],
  "trail-riding": ["trail", "hack", "scenery", "nature", "creek", "woods"],
};

/** Merge a post's stored tags with topics inferred from its text. */
function inferPostTags(content: string, tags: string[]): string[] {
  const set = new Set(tags ?? []);
  const lower = (content ?? "").toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) set.add(topic);
  }
  return Array.from(set);
}

/**
 * Build an ordered list of comment templates that fit a given post: comments
 * whose tags match the post come first (relevance), followed by universal ones
 * for natural variety. Media-only comments are dropped on text posts.
 */
function relevantCommentCandidates(
  postTags: string[],
  hasMedia: boolean
): CommentTemplate[] {
  const allowed = COMMENT_POOL.filter((c) => hasMedia || !c.requiresMedia);
  const matched = allowed.filter(
    (c) => c.tags && c.tags.length > 0 && c.tags.some((t) => postTags.includes(t))
  );
  const universal = allowed.filter((c) => !c.tags || c.tags.length === 0);
  return [...shuffle(matched), ...shuffle(universal)];
}

async function generateEngagement(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ likes: number; comments: number }> {
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: recentPosts } = await admin
    .from("posts")
    .select("id, author_id, content, tags")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!recentPosts || recentPosts.length === 0) {
    return { likes: 0, comments: 0 };
  }

  const postIds = recentPosts.map((p: { id: string }) => p.id);

  // Which posts have a photo/video — drives whether visual comments are allowed.
  const { data: mediaRows } = await admin
    .from("post_media")
    .select("post_id")
    .in("post_id", postIds);
  const postsWithMedia = new Set(
    (mediaRows ?? []).map((m: { post_id: string }) => m.post_id)
  );

  // Batch-load existing bot engagement so we only "top up" toward each target
  // (idempotent-ish: repeated backfill runs converge instead of piling up).
  const { data: existingLikes } = await admin
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds)
    .in("user_id", BOT_IDS);

  const { data: existingComments } = await admin
    .from("comments")
    .select("post_id, author_id")
    .in("post_id", postIds)
    .in("author_id", BOT_IDS);

  const likersByPost = new Map<string, Set<string>>();
  for (const row of (existingLikes ?? []) as { post_id: string; user_id: string }[]) {
    if (!likersByPost.has(row.post_id)) likersByPost.set(row.post_id, new Set());
    likersByPost.get(row.post_id)!.add(row.user_id);
  }

  const commentersByPost = new Map<string, Set<string>>();
  for (const row of (existingComments ?? []) as { post_id: string; author_id: string }[]) {
    if (!commentersByPost.has(row.post_id)) commentersByPost.set(row.post_id, new Set());
    commentersByPost.get(row.post_id)!.add(row.author_id);
  }

  const likeRows: { user_id: string; post_id: string }[] = [];
  const commentRows: { post_id: string; author_id: string; content: string }[] = [];

  for (const post of recentPosts as {
    id: string;
    author_id: string;
    content: string | null;
    tags: string[] | null;
  }[]) {
    const eligible = BOT_PROFILES.filter((b) => b.id !== post.author_id);
    if (eligible.length === 0) continue;

    // ---- LIKES: top up to target with distinct bots that haven't liked yet ----
    const alreadyLiked = likersByPost.get(post.id) ?? new Set<string>();
    const likeTarget = Math.min(targetLikeCount(), eligible.length);
    const likesNeeded = likeTarget - alreadyLiked.size;
    if (likesNeeded > 0) {
      const availableLikers = shuffle(
        eligible.filter((b) => !alreadyLiked.has(b.id))
      );
      for (let i = 0; i < likesNeeded && i < availableLikers.length; i++) {
        likeRows.push({ user_id: availableLikers[i].id, post_id: post.id });
      }
    }

    // ---- COMMENTS: distinct bots, contextually relevant, top up to target ----
    const alreadyCommented = commentersByPost.get(post.id) ?? new Set<string>();
    const commentTarget = Math.min(targetCommentCount(), eligible.length);
    const commentsNeeded = commentTarget - alreadyCommented.size;
    if (commentsNeeded > 0) {
      const availableCommenters = shuffle(
        eligible.filter((b) => !alreadyCommented.has(b.id))
      );
      const postTags = inferPostTags(post.content ?? "", post.tags ?? []);
      const hasMedia = postsWithMedia.has(post.id);
      // Relevance-ordered, already de-duplicated list of templates for this post.
      const candidates = relevantCommentCandidates(postTags, hasMedia);
      const limit = Math.min(
        commentsNeeded,
        availableCommenters.length,
        candidates.length
      );
      for (let i = 0; i < limit; i++) {
        commentRows.push({
          post_id: post.id,
          author_id: availableCommenters[i].id,
          content: candidates[i].content,
        });
      }
    }
  }

  let likesCreated = 0;
  let commentsCreated = 0;

  if (likeRows.length > 0) {
    const { error } = await admin
      .from("post_likes")
      .upsert(likeRows, { onConflict: "user_id,post_id" });
    if (error) {
      console.error("Failed to insert bot likes:", error);
    } else {
      likesCreated = likeRows.length;
    }
  }

  if (commentRows.length > 0) {
    const { error } = await admin.from("comments").insert(commentRows);
    if (error) {
      console.error("Failed to insert bot comments:", error);
    } else {
      commentsCreated = commentRows.length;
    }
  }

  return { likes: likesCreated, comments: commentsCreated };
}

// =============================================================================
// MAIN ENTRY POINT
//
// Called by the cron route with the list of posts scheduled for this hour.
// Each PlannedPost carries the bot, type, and minute offset determined by
// the deterministic daily plan.
// =============================================================================

export async function executeScheduledPosts(
  slots: PlannedPost[],
  /** Must match scheduler daily plan date (YYYY-MM-DD in feed timezone). */
  planDateStr: string
): Promise<{
  posts: { postId: string; botName: string; type: string }[];
}> {
  const admin = createAdminClient();
  const recentContents = await fetchRecentBotContents(admin);
  const results: { postId: string; botName: string; type: string }[] = [];

  for (const slot of slots) {
    let media: MediaItem | null = null;
    let content: ContentTemplate;

    if (slot.type === "photo") {
      media = await selectMedia(admin, slot.bot.contentAffinity);
      content = selectContent(
        slot.bot,
        recentContents,
        media?.tags
      );
    } else {
      content = selectContent(slot.bot, recentContents);
    }

    const result = await insertPost(
      admin,
      slot.bot,
      content,
      media,
      slot.hour,
      slot.minuteOffset,
      planDateStr
    );

    if (result) {
      results.push(result);
      recentContents.push(content.content);
    }
  }

  return { posts: results };
}

// =============================================================================
// ENGAGEMENT PASS
//
// Standalone entry point so the cron can top up likes/comments on recent posts
// on every run — independent of whether any new posts were seeded that day.
// This is what keeps real users' posts (and the bot feed) feeling validated.
// =============================================================================

export async function runEngagementPass(): Promise<{
  likes: number;
  comments: number;
}> {
  const admin = createAdminClient();
  return generateEngagement(admin);
}
