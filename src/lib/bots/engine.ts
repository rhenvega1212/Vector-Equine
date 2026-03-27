import { TZDate } from "@date-fns/tz";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BOT_PROFILES,
  BOT_IDS,
  SCHEDULE_CONFIG,
  type BotProfile,
} from "./bot-config";
import { CONTENT_POOL, type ContentTemplate } from "./content-pool";
import { COMMENT_POOL } from "./comment-pool";
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

async function generateEngagement(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ likes: number; comments: number }> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentPosts } = await admin
    .from("posts")
    .select("id, author_id")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!recentPosts || recentPosts.length === 0) {
    return { likes: 0, comments: 0 };
  }

  let likesCreated = 0;
  let commentsCreated = 0;

  const likeCount = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...recentPosts].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(likeCount, shuffled.length); i++) {
    const post = shuffled[i];
    const eligible = BOT_PROFILES.filter((b) => b.id !== post.author_id);
    if (eligible.length === 0) continue;

    const bot = pickRandom(eligible);
    const { error } = await admin
      .from("post_likes")
      .upsert(
        { user_id: bot.id, post_id: post.id },
        { onConflict: "user_id,post_id" }
      );
    if (!error) likesCreated++;
  }

  // Only comment ~50% of the time to keep it sparse
  if (Math.random() < 0.5) {
    const commentPost = pickRandom(recentPosts);
    const eligible = BOT_PROFILES.filter(
      (b) => b.id !== commentPost.author_id
    );
    if (eligible.length > 0) {
      const bot = pickRandom(eligible);
      const comment = pickRandom(COMMENT_POOL);
      const { error } = await admin.from("comments").insert({
        post_id: commentPost.id,
        author_id: bot.id,
        content: comment.content,
      });
      if (!error) commentsCreated++;
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
  engagement: { likes: number; comments: number };
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

  const engagement = await generateEngagement(admin);

  return { posts: results, engagement };
}
