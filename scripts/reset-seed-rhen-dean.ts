/**
 * Dev wipe + seed: keep/create Rhen + horse Dean.
 *
 * NEVER run against production. Requires:
 *   ALLOW_DEV_WIPE=true
 *   --confirm-wipe
 *   SEED_RHEN_PASSWORD (do not commit)
 *
 * Run:
 *   ALLOW_DEV_WIPE=true SEED_RHEN_PASSWORD='…' npx dotenv-cli -e .env.local -- npx tsx scripts/reset-seed-rhen-dean.ts --confirm-wipe
 */
import { createClient } from "@supabase/supabase-js";

const RHEN_EMAIL = (process.env.SEED_RHEN_EMAIL || "admin@vectorequine.com").trim().toLowerCase();
const RHEN_PASSWORD = process.env.SEED_RHEN_PASSWORD || "";
const RHEN_USERNAME = "rhen";
const RHEN_DISPLAY = "Rhen";

const PRODUCTION_HOST_HINTS = [
  "vectorequine.vercel.app",
  "www.vectorequine.com",
  "vectorequine.com",
];

function assertSafeToWipe(url: string) {
  if (process.env.ALLOW_DEV_WIPE !== "true") {
    throw new Error("Refusing: set ALLOW_DEV_WIPE=true for this script.");
  }
  if (!process.argv.includes("--confirm-wipe")) {
    throw new Error("Refusing: pass --confirm-wipe to acknowledge destructive wipe.");
  }
  const lower = url.toLowerCase();
  for (const hint of PRODUCTION_HOST_HINTS) {
    if (lower.includes(hint)) {
      throw new Error(`Refusing: URL looks like production (${hint}).`);
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  assertSafeToWipe(url);
  if (!RHEN_PASSWORD) {
    throw new Error("Set SEED_RHEN_PASSWORD in the environment (do not commit it).");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Target:", url);
  console.log("Preserving email:", RHEN_EMAIL);

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  let rhen = listed.users.find((u) => (u.email || "").toLowerCase() === RHEN_EMAIL);
  if (rhen) {
    const { error } = await supabase.auth.admin.updateUserById(rhen.id, {
      password: RHEN_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: RHEN_DISPLAY, username: RHEN_USERNAME },
    });
    if (error) throw error;
    console.log("Updated Rhen auth user:", rhen.id);
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: RHEN_EMAIL,
      password: RHEN_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: RHEN_DISPLAY, username: RHEN_USERNAME },
    });
    if (error) throw error;
    rhen = created.user;
    console.log("Created Rhen auth user:", rhen.id);
  }

  const keepId = rhen.id;

  for (const u of listed.users) {
    if (u.id === keepId) continue;
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.warn("Could not delete user", u.email, error.message);
    else console.log("Deleted user", u.email || u.id);
  }

  const { data: listed2 } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of listed2?.users || []) {
    if (u.id === keepId) continue;
    await supabase.auth.admin.deleteUser(u.id);
  }

  const wipeTables: { table: string; column: string }[] = [
    { table: "training_sessions", column: "user_id" },
    { table: "horse_profiles", column: "user_id" },
    { table: "ai_video_uploads", column: "user_id" },
    { table: "posts", column: "author_id" },
    { table: "follows", column: "follower_id" },
    { table: "follows", column: "following_id" },
    { table: "notifications", column: "user_id" },
    { table: "coach_connections", column: "rider_id" },
    { table: "coach_connections", column: "trainer_id" },
    { table: "connection_invites", column: "inviter_id" },
    { table: "share_links", column: "created_by" },
  ];

  for (const { table, column } of wipeTables) {
    const { error } = await supabase.from(table).delete().neq(column, keepId);
    if (error && !/does not exist|Could not find/i.test(error.message)) {
      console.warn(`wipe ${table}:`, error.message);
    }
  }

  // Also clear Rhen's horses/sessions before reseed
  await supabase.from("training_sessions").delete().eq("user_id", keepId);
  await supabase.from("horse_profiles").delete().eq("user_id", keepId);

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: keepId,
      email: RHEN_EMAIL,
      username: RHEN_USERNAME,
      display_name: RHEN_DISPLAY,
      bio: "You ride. Vector assists.",
      role: "admin",
      role_rider: true,
      role_trainer: false,
      discipline: "dressage",
      rider_level: "professional",
      is_beta_tester: true,
      trainer_approved: false,
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;
  console.log("Upserted Rhen profile");

  await supabase.from("feature_flags").upsert(
    {
      key: "training_diary",
      description: "Vector workspace",
      stage: "ga",
      rollout_percentage: 100,
    },
    { onConflict: "key" }
  );

  // Drop orphan profiles left after auth user deletes
  const { data: allProfiles } = await supabase.from("profiles").select("id, email");
  for (const p of allProfiles || []) {
    if (p.id === keepId) continue;
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) console.warn("Could not delete profile", p.email || p.id, error.message);
    else console.log("Deleted orphan profile", p.email || p.id);
  }

  async function columnExists(table: string, column: string) {
    const { error } = await supabase.from(table).select(column).limit(1);
    return !error;
  }

  const hasHorseProfiles = await columnExists("horse_profiles", "id");
  const hasHorseId = await columnExists("training_sessions", "horse_id");
  const hasSessionTitle = await columnExists("training_sessions", "session_title");
  const hasDuration = await columnExists("training_sessions", "duration_minutes");
  // Expanded session types require horse_profiles migration; else stick to legacy CHECK values.
  const canUseDressage = hasSessionTitle; // proxy: same migration adds both

  let deanId: string | null = null;
  if (hasHorseProfiles) {
    const { data: dean, error: deanError } = await supabase
      .from("horse_profiles")
      .insert({
        user_id: keepId,
        name: "Dean",
        breed: "Hanoverian",
        age: 18,
        sex: "gelding",
        color: "Bay",
        discipline: "dressage",
        training_level: "PSG",
        goals: "Full pirouette this year — sit and carry, not spin.",
        notes: "Working canter pirouettes; doesn't sit enough and spins out.",
      })
      .select("*")
      .single();
    if (deanError) throw deanError;
    deanId = dean.id;
    console.log("Created Dean:", dean.id);
  } else {
    console.warn(
      "horse_profiles missing — run supabase/manual/apply_horse_profiles_dev.sql in SQL Editor, then re-run."
    );
  }

  const today = new Date();
  const d = (offset: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() - offset);
    return x.toISOString().split("T")[0];
  };

  const baseSessions = [
    {
      title: "Half-pirouette, right",
      typeExpanded: "dressage",
      typeLegacy: "lesson",
      daysAgo: 0,
      minutes: 41,
      feel: 7,
      source: "comms",
      summary:
        "Closer than it felt. Right seatbone late on entry; left leg held the sit through the turn.",
      homework: "Quarter pirouettes on a square — reward the sit, rebuild the canter.",
      exercises: "Collect on 10m · Spiral accordion · Quarter pirouettes · Triangle to X",
      scales: [4, 4, 3, 3, 3, 3] as const,
      notes: "Decoded demo ride for Vector Hub.",
    },
    {
      title: "Canter transitions",
      typeExpanded: "dressage",
      typeLegacy: "lesson",
      daysAgo: 2,
      minutes: 38,
      feel: 8,
      source: "manual",
      summary: "Seat timing improving — release landing closer to the beat.",
      homework: "Keep the outside rein soft when he answers.",
      exercises: null as string | null,
      scales: [4, 4, 4, 4, 3, 3] as const,
      notes: null as string | null,
    },
    {
      title: "Spiral accordion focus",
      typeExpanded: "flat_ride",
      typeLegacy: "ride",
      daysAgo: 4,
      minutes: 35,
      feel: 7,
      source: "manual",
      summary: "Hind leg coming under more willingly in the spiral.",
      homework: "Bring spiral notes to your next lesson.",
      exercises: null as string | null,
      scales: [4, 3, 3, 3, 4, 3] as const,
      notes: null as string | null,
    },
  ];

  const sessions = baseSessions.map((s) => {
    const row: Record<string, unknown> = {
      user_id: keepId,
      horse: "Dean",
      session_date: d(s.daysAgo),
      session_type: canUseDressage ? s.typeExpanded : s.typeLegacy,
      overall_feel: s.feel,
      session_source: s.source,
      summary: s.summary,
      homework: s.homework,
      rhythm: s.scales[0],
      relaxation: s.scales[1],
      connection: s.scales[2],
      impulsion: s.scales[3],
      straightness: s.scales[4],
      collection: s.scales[5],
    };
    if (s.exercises) row.exercises = s.exercises;
    if (s.notes) row.notes = s.notes;
    if (hasHorseId && deanId) row.horse_id = deanId;
    if (hasSessionTitle) row.session_title = s.title;
    if (hasDuration) row.duration_minutes = s.minutes;
    // Put title in notes when session_title column is absent so Hub can still show it.
    if (!hasSessionTitle) {
      row.notes = s.notes ? `${s.title} — ${s.notes}` : s.title;
    }
    return row;
  });

  const { error: sessError } = await supabase.from("training_sessions").insert(sessions);
  if (sessError) throw sessError;
  console.log("Seeded", sessions.length, "demo sessions");
  console.log(
    `Schema: horse_profiles=${hasHorseProfiles} horse_id=${hasHorseId} session_title=${hasSessionTitle} duration=${hasDuration}`
  );

  console.log("\nReady:");
  console.log(`  Email: ${RHEN_EMAIL}`);
  console.log(`  Username: ${RHEN_USERNAME}`);
  console.log(`  Horse: Dean${deanId ? ` (${deanId})` : " (name-only — apply manual SQL)"}`);
  console.log("  Sign in → /train");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
