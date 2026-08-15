import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

type Check = { name: string; ok: boolean; detail?: string };

async function colExists(table: string, column: string): Promise<boolean> {
  const { error } = await sb.from(table).select(column).limit(0);
  if (!error) return true;
  const msg = error.message || "";
  if (/column|does not exist|Could not find/i.test(msg)) return false;
  if (/relation|schema cache|not find the table/i.test(msg)) return false;
  throw new Error(`${table}.${column}: ${msg}`);
}

async function tableExists(table: string): Promise<boolean> {
  const { error } = await sb.from(table).select("*").limit(0);
  if (!error) return true;
  const msg = error.message || "";
  if (/relation|schema cache|not find the table|does not exist/i.test(msg)) return false;
  return true;
}

async function main() {
  const checks: Check[] = [];

  async function mark(name: string, fn: () => Promise<boolean>) {
    try {
      const ok = await fn();
      checks.push({ name, ok });
    } catch (e: unknown) {
      checks.push({
        name,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await mark("profiles.vector_setup_completed_at", () =>
    colExists("profiles", "vector_setup_completed_at")
  );
  await mark("horse_profiles.months_together", () =>
    colExists("horse_profiles", "months_together")
  );
  await mark("horse_profiles.sessions_per_week", () =>
    colExists("horse_profiles", "sessions_per_week")
  );
  await mark("horse_profiles.current_focus", () =>
    colExists("horse_profiles", "current_focus")
  );
  await mark("horse_profiles.sticking_points", () =>
    colExists("horse_profiles", "sticking_points")
  );
  await mark("horse_profiles.health_flags", () =>
    colExists("horse_profiles", "health_flags")
  );
  await mark("horse_profiles.health_flag_notes", () =>
    colExists("horse_profiles", "health_flag_notes")
  );
  await mark("horse_profiles.baseline_completed_at", () =>
    colExists("horse_profiles", "baseline_completed_at")
  );
  await mark("table capture_sessions", () => tableExists("capture_sessions"));
  await mark("capture_sessions.join_code", () =>
    colExists("capture_sessions", "join_code")
  );
  await mark("capture_sessions.t0", () => colExists("capture_sessions", "t0"));
  await mark("capture_sessions.livekit_room", () =>
    colExists("capture_sessions", "livekit_room")
  );
  await mark("table session_transcript_segments", () =>
    tableExists("session_transcript_segments")
  );
  await mark("table session_media_assets", () =>
    tableExists("session_media_assets")
  );
  await mark("training_sessions.session_source", () =>
    colExists("training_sessions", "session_source")
  );
  await mark("training_sessions.summary", () =>
    colExists("training_sessions", "summary")
  );
  await mark("table coach_connections", () => tableExists("coach_connections"));
  await mark("table share_links", () => tableExists("share_links"));

  for (const fn of ["owns_training_session", "trainer_can_access_session"] as const) {
    const args =
      fn === "owns_training_session"
        ? { session_uuid: "00000000-0000-0000-0000-000000000000" }
        : {
            session_uuid: "00000000-0000-0000-0000-000000000000",
            session_owner: "00000000-0000-0000-0000-000000000000",
          };
    const { error } = await sb.rpc(fn, args);
    if (!error) {
      checks.push({ name: `fn ${fn}`, ok: true });
    } else if (/Could not find the function|does not exist/i.test(error.message)) {
      checks.push({
        name: `fn ${fn}`,
        ok: false,
        detail: "not found — run fix_training_sessions_rls_recursion_dev.sql",
      });
    } else {
      checks.push({
        name: `fn ${fn}`,
        ok: true,
        detail: `reachable (${error.message.slice(0, 60)})`,
      });
    }
  }

  const { count, error: cErr } = await sb
    .from("capture_sessions")
    .select("*", { count: "exact", head: true });
  checks.push({
    name: "capture_sessions readable",
    ok: !cErr,
    detail: cErr ? cErr.message : `count=${count ?? 0}`,
  });

  console.log("Supabase host:", new URL(url).host);
  console.log("");
  let missing = 0;
  for (const c of checks) {
    const tag = c.ok ? "OK  " : "MISS";
    if (!c.ok) missing++;
    console.log(`${tag} ${c.name}${c.detail ? " — " + c.detail : ""}`);
  }
  console.log("");
  console.log(
    missing === 0
      ? "ALL REQUIRED SCHEMA CHECKS PASSED"
      : `MISSING ${missing} ITEM(S) — see MISS lines above`
  );
  process.exit(missing === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
