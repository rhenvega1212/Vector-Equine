/**
 * Dev wipe: remove horses/sessions/captures for a rider and clear Vector setup
 * so /train redirects to the setup wizard (re-enter Dean cleanly).
 *
 *   ALLOW_DEV_WIPE=true npx dotenv-cli -e .env.local -- npx tsx scripts/wipe-for-vector-setup.ts --confirm
 *
 * Optional: WIPE_USERNAME=rhen  or  WIPE_EMAIL=you@example.com
 */
import { createClient } from "@supabase/supabase-js";

const confirm = process.argv.includes("--confirm");
if (process.env.ALLOW_DEV_WIPE !== "true" || !confirm) {
  console.error(
    "Refusing: set ALLOW_DEV_WIPE=true and pass --confirm\n" +
      "  ALLOW_DEV_WIPE=true npx dotenv-cli -e .env.local -- npx tsx scripts/wipe-for-vector-setup.ts --confirm"
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const username = process.env.WIPE_USERNAME || "rhen";
  const email = process.env.WIPE_EMAIL?.toLowerCase();

  let query = supabase.from("profiles").select("id, username, email, display_name, vector_setup_completed_at");
  if (email) query = query.eq("email", email);
  else query = query.eq("username", username);

  const { data: profile, error } = await query.maybeSingle();
  if (error) throw error;
  if (!profile) {
    // Fallback: any profile that owns a horse named Dean
    const { data: horses } = await supabase
      .from("horse_profiles")
      .select("user_id, name")
      .ilike("name", "dean");
    const userId = horses?.[0]?.user_id;
    if (!userId) {
      console.error(`No profile for username=${username} and no horse named Dean`);
      process.exit(1);
    }
    const { data: p2 } = await supabase
      .from("profiles")
      .select("id, username, email, display_name, vector_setup_completed_at")
      .eq("id", userId)
      .single();
    if (!p2) {
      console.error("Could not load profile for Dean owner");
      process.exit(1);
    }
    await wipeUser(p2);
    return;
  }

  await wipeUser(profile);
}

async function wipeUser(profile: {
  id: string;
  username: string;
  email: string;
  display_name: string;
  vector_setup_completed_at: string | null;
}) {
  console.log(
    `Wiping rider ${profile.username} (${profile.email}) id=${profile.id}`
  );

  const { data: captures } = await supabase
    .from("capture_sessions")
    .select("id")
    .eq("rider_id", profile.id);
  const captureIds = (captures || []).map((c) => c.id);

  if (captureIds.length) {
    await supabase
      .from("session_transcript_segments")
      .delete()
      .in("capture_session_id", captureIds);
    await supabase
      .from("session_media_assets")
      .delete()
      .in("capture_session_id", captureIds);
    await supabase.from("capture_sessions").delete().eq("rider_id", profile.id);
    console.log(`Deleted ${captureIds.length} capture session(s)`);
  }

  const { data: sessions } = await supabase
    .from("training_sessions")
    .delete()
    .eq("user_id", profile.id)
    .select("id");
  console.log(`Deleted ${(sessions || []).length} training session(s)`);

  const { data: horses } = await supabase
    .from("horse_profiles")
    .delete()
    .eq("user_id", profile.id)
    .select("id, name");
  console.log(
    `Deleted horses: ${(horses || []).map((h) => h.name).join(", ") || "(none)"}`
  );

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ vector_setup_completed_at: null })
    .eq("id", profile.id);
  if (upErr) throw upErr;

  console.log("Cleared vector_setup_completed_at");
  console.log("Done. Open /train — you should hit /train/setup.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
