/**
 * One-off / local: load .env.local via dotenv-cli and run the same backfill as the cron job.
 * Example: npx dotenv-cli -e .env.local -- npx tsx scripts/run-bot-seed.ts
 */
import { runBotSeedBackfill } from "@/lib/bots/seed-orchestrator";

runBotSeedBackfill()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
