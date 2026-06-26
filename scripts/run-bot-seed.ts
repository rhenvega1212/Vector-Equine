/**
 * One-off / local: load .env.local via dotenv-cli and run the same work as the cron job
 * (seed backfill + an engagement top-up pass on recent posts).
 * Example: npx dotenv-cli -e .env.local -- npx tsx scripts/run-bot-seed.ts
 */
import { runBotSeedBackfill } from "@/lib/bots/seed-orchestrator";
import { runEngagementPass } from "@/lib/bots/engine";

(async () => {
  const seed = await runBotSeedBackfill();
  const engagement = await runEngagementPass();
  console.log(JSON.stringify({ ...seed, engagement }, null, 2));
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
