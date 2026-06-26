/**
 * One-off / local: give each bot a profile photo by picking the image from
 * their most-liked post. Re-runnable (idempotent to whatever their current
 * best-performing photo is).
 *
 * Example: npx dotenv-cli -e .env.local -- npx tsx scripts/set-bot-avatars.ts
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { BOT_IDS, BOT_PROFILES } from "@/lib/bots/bot-config";

type MediaRow = { url: string; media_type: string; sort_order: number | null };
type PostRow = {
  id: string;
  post_likes: { count: number }[];
  post_media: MediaRow[];
};

(async () => {
  const admin = createAdminClient();
  const results: Record<string, string> = {};

  for (const botId of BOT_IDS) {
    const username = BOT_PROFILES.find((b) => b.id === botId)?.username ?? botId;

    const { data: posts, error } = await admin
      .from("posts")
      .select("id, post_likes(count), post_media(url, media_type, sort_order)")
      .eq("author_id", botId)
      .eq("is_hidden", false);
    if (error) throw error;

    // Keep only posts that contain an image, ranked by like count (desc).
    const candidates = ((posts ?? []) as PostRow[])
      .map((p) => ({
        id: p.id,
        likes: p.post_likes?.[0]?.count ?? 0,
        images: (p.post_media ?? [])
          .filter((m) => m.media_type === "image")
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }))
      .filter((p) => p.images.length > 0)
      .sort((a, b) => b.likes - a.likes);

    if (candidates.length === 0) {
      results[username] = "(no image posts — left as-is)";
      continue;
    }

    const best = candidates[0];
    const avatarUrl = best.images[0].url;

    const { error: upErr } = await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", botId);
    if (upErr) throw upErr;

    results[username] = `set (${best.likes} likes) → ${avatarUrl}`;
  }

  console.log(JSON.stringify(results, null, 2));
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
