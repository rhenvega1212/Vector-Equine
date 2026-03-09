import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface BotAccount {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  location: string;
  discipline: string;
  riderLevel: string;
  daysAgo: number;
}

const BOTS: BotAccount[] = [
  { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", email: "jessicam.trails@gmail.com", username: "jessicamtrails", displayName: "Jessica Martinez", bio: "Desert trail rider and barrel racer. My quarter horse Rio is my best friend.", location: "Scottsdale, AZ", discipline: "western", riderLevel: "intermediate", daysAgo: 47 },
  { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", email: "oliver.chen.rides@outlook.com", username: "oliverrides", displayName: "Oliver Chen", bio: "Working toward Grand Prix dressage. It's a marathon, not a sprint.", location: "Aiken, SC", discipline: "dressage", riderLevel: "advanced", daysAgo: 62 },
  { id: "1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76", email: "hannahbrooks92@gmail.com", username: "hannahb_equine", displayName: "Hannah Brooks", bio: "Eventer with two OTTBs. Embracing the chaos one cross-country course at a time.", location: "Middleburg, VA", discipline: "eventing", riderLevel: "intermediate", daysAgo: 35 },
  { id: "9e107d9d-372b-4a8a-80f2-e9e15d24a06b", email: "ryan.osullivan@icloud.com", username: "ryano_rides", displayName: "Ryan O'Sullivan", bio: "New to the hunter/jumper world. Learning every day and loving it.", location: "Greenwich, CT", discipline: "jumping", riderLevel: "beginner", daysAgo: 28 },
  { id: "6ba7b810-9dad-41d4-80b5-72c26d5a9f9e", email: "sophia.equine@outlook.com", username: "sophiaeq", displayName: "Sophia Andersson", bio: "Swedish-American dressage rider. PSG level with my Hanoverian mare Freya.", location: "Wellington, FL", discipline: "dressage", riderLevel: "advanced", daysAgo: 55 },
  { id: "550e8400-e29b-41d4-a716-446655440012", email: "marcus.w.rides@gmail.com", username: "marcuswrides", displayName: "Marcus Williams", bio: "Reiner and ranch rider. Nothing beats a good cow horse.", location: "Fort Worth, TX", discipline: "western", riderLevel: "intermediate", daysAgo: 41 },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", email: "lily.patel.eventing@yahoo.com", username: "lilyp_eventing", displayName: "Lily Patel", bio: "Preliminary eventer, vet tech, and horse mom x3. Always learning.", location: "Lexington, KY", discipline: "eventing", riderLevel: "advanced", daysAgo: 53 },
  { id: "8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d", email: "jamescooper.eq@gmail.com", username: "jcooper_eq", displayName: "James Cooper", bio: "Jumper rider aiming for the 1.20m. My KWPN gelding Atlas and I are a team.", location: "Ocala, FL", discipline: "jumping", riderLevel: "intermediate", daysAgo: 39 },
  { id: "2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f", email: "natalie.kim.trails@outlook.com", username: "natkim_trails", displayName: "Natalie Kim", bio: "Pacific NW trail rider. Just started last year and already hooked.", location: "Bend, OR", discipline: "western", riderLevel: "beginner", daysAgo: 22 },
  { id: "b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a", email: "danielreeves.dr@gmail.com", username: "dreeves_dressage", displayName: "Daniel Reeves", bio: "British dressage enthusiast. Medium level competitor with my Irish cob.", location: "Newbury, UK", discipline: "dressage", riderLevel: "intermediate", daysAgo: 44 },
];

async function main() {
  console.log("Creating bot accounts...\n");

  for (const bot of BOTS) {
    // Create auth user via admin API
    const { data: user, error: authError } =
      await supabase.auth.admin.createUser({
        email: bot.email,
        password: "password123",
        email_confirm: true,
        user_metadata: {},
      });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        console.log(`  [skip] ${bot.displayName} — already exists`);
      } else {
        console.log(`  [FAIL] ${bot.displayName} — ${authError.message}`);
      }
      continue;
    }

    const userId = user.user.id;

    // Update the user ID to match our known bot IDs by deleting and recreating
    // if the auto-generated ID doesn't match. The admin API doesn't let us
    // specify an ID, so we'll update the profile to point to the real user ID.
    // We need to update bot-config if the IDs don't match.

    // Insert/update profile
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: bot.email,
        username: bot.username,
        display_name: bot.displayName,
        bio: bot.bio,
        location: bot.location,
        discipline: bot.discipline,
        rider_level: bot.riderLevel,
        role: "rider",
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.log(`  [FAIL] ${bot.displayName} profile — ${profileError.message}`);
    } else {
      console.log(`  [OK]   ${bot.displayName} (${userId})`);
    }
  }

  // Print the ID mapping so we can update bot-config.ts if needed
  console.log("\n--- Verify IDs ---");
  console.log("If any IDs above differ from bot-config.ts, update them.\n");

  // Fetch all bot profiles we just created
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in(
      "email",
      BOTS.map((b) => b.email)
    );

  if (profiles) {
    for (const p of profiles) {
      const expected = BOTS.find(
        (b) => b.username === p.username
      );
      const match = expected?.id === p.id ? "✓" : "✗ MISMATCH";
      console.log(`  ${p.username}: ${p.id} ${match}`);
    }
  }
}

main().catch(console.error);
