/**
 * Probe linked Supabase schema for seed compatibility.
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/probe-schema.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function probe(table: string) {
    const { data, error } = await sb.from(table).select("*").limit(1);
    if (error) console.log(`${table}: FAIL ${error.code || ""} ${error.message}`);
    else console.log(`${table}: ok keys=${data?.[0] ? Object.keys(data[0]).join(",") : "(empty)"}`);
  }

  await probe("profiles");
  await probe("training_sessions");
  await probe("horse_profiles");
  await probe("feature_flags");

  const cols = [
    "duration_minutes",
    "session_title",
    "horse_id",
    "summary",
    "homework",
    "session_source",
    "exercises",
    "rhythm",
    "relaxation",
    "connection",
    "impulsion",
    "straightness",
    "collection",
    "notes",
    "horse",
    "overall_feel",
    "session_type",
    "session_date",
  ];
  for (const c of cols) {
    const { error } = await sb.from("training_sessions").select(c).limit(1);
    console.log(`col ${c}: ${error ? "MISSING" : "ok"}`);
  }

  const { count: pc } = await sb.from("profiles").select("id", { count: "exact", head: true });
  const { count: sc } = await sb.from("training_sessions").select("id", { count: "exact", head: true });
  console.log(`profiles count=${pc} sessions count=${sc}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
