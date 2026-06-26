/**
 * Create or reset the local dev admin account.
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/setup-admin.ts
 */
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "admin@vectorequine.com";
const ADMIN_PASSWORD = "password123";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || url.includes("your-project")) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const { error: schemaError } = await supabase.from("profiles").select("id").limit(1);
  if (schemaError) {
    console.error("\nDatabase tables are missing. Run migrations first:\n");
    console.error("  npx supabase login");
    console.error("  npx supabase link --project-ref <your-project-ref>");
    console.error("  npm run db:push\n");
    console.error("Or paste supabase/migrations/*.sql into the Supabase SQL Editor.\n");
    console.error("Schema error:", schemaError.message);
    process.exit(1);
  }

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    console.error("Could not list users:", listError.message);
    process.exit(1);
  }

  const existing = listed.users.find((u) => u.email === ADMIN_EMAIL);
  let userId = existing?.id;

  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (updateError) {
      console.error("Could not update admin password:", updateError.message);
      process.exit(1);
    }
    console.log("Updated existing admin auth user.");
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (createError) {
      console.error("Could not create admin user:", createError.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log("Created admin auth user.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId!,
      email: ADMIN_EMAIL,
      username: "admin",
      display_name: "Vector Equine Admin",
      bio: "Platform administrator.",
      role: "admin",
      discipline: "dressage",
      rider_level: "professional",
      trainer_approved: false,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Could not upsert admin profile:", profileError.message);
    process.exit(1);
  }

  console.log("\nAdmin ready:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("\nSign in at http://localhost:3000/login");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
