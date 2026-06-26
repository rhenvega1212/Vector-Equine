/**
 * One-off: remove existing bot-authored comments and regenerate them with the
 * new context-aware logic. Bot comments that have replies (parent_id/reply_to_id
 * pointing at them) are skipped so we never cascade-delete a real user's reply.
 *
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/regenerate-bot-comments.ts
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { BOT_IDS } from "@/lib/bots/bot-config";
import { runEngagementPass } from "@/lib/bots/engine";

(async () => {
  const admin = createAdminClient();

  const { data: botComments, error: bcErr } = await admin
    .from("comments")
    .select("id")
    .in("author_id", BOT_IDS);
  if (bcErr) throw bcErr;
  const botCommentIds = new Set((botComments ?? []).map((c: { id: string }) => c.id));

  // Collect every comment id that is referenced as a parent or reply target so
  // we don't delete a comment that has replies hanging off it.
  const { data: refs, error: refErr } = await admin
    .from("comments")
    .select("parent_id, reply_to_id");
  if (refErr) throw refErr;
  const referenced = new Set<string>();
  for (const r of (refs ?? []) as { parent_id: string | null; reply_to_id: string | null }[]) {
    if (r.parent_id) referenced.add(r.parent_id);
    if (r.reply_to_id) referenced.add(r.reply_to_id);
  }

  const deletable = [...botCommentIds].filter((id) => !referenced.has(id));
  const skipped = botCommentIds.size - deletable.length;

  let deleted = 0;
  for (let i = 0; i < deletable.length; i += 100) {
    const chunk = deletable.slice(i, i + 100);
    const { error } = await admin.from("comments").delete().in("id", chunk);
    if (error) throw error;
    deleted += chunk.length;
  }

  const engagement = await runEngagementPass();

  console.log(
    JSON.stringify(
      {
        botCommentsFound: botCommentIds.size,
        deleted,
        skippedWithReplies: skipped,
        regenerated: engagement,
      },
      null,
      2
    )
  );
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
