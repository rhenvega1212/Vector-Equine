/**
 * Remove Lab test journal rows that were titled from the horse's current focus.
 *
 * Dry run:  npx dotenv-cli -e .env.local -- npx tsx scripts/clear-test-rides.ts
 * Delete:   npx dotenv-cli -e .env.local -- npx tsx scripts/clear-test-rides.ts --delete
 */
import { createClient } from "@supabase/supabase-js";

/** "canter pirouettes, piaffe, passage" and its misspelling. */
const FOCUS_TITLE_RE = /^canter\s+p[a-z]*ouettes?,\s*piaffe,\s*passage\.?$/i;

type Row = {
  id: string;
  created_at: string;
  session_date: string;
  session_title: string | null;
  is_test: boolean | null;
  summary: string | null;
  homework: string | null;
  exercises: string | null;
  overall_feel: number | null;
};

async function main() {
  const apply = process.argv.includes("--delete");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await sb
    .from("training_sessions")
    .select(
      "id, created_at, session_date, session_title, is_test, summary, homework, exercises, overall_feel"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data || []) as Row[];
  const targets = rows.filter((r) =>
    FOCUS_TITLE_RE.test((r.session_title || "").trim())
  );

  console.log(`Matched ${targets.length} of ${rows.length} rides:\n`);
  for (const r of targets) {
    const pending = (r.summary || "").includes("<<<brief_pending>>>");
    console.log(
      `  ${r.created_at.slice(0, 19)}  is_test=${r.is_test}  ${
        pending ? "stub" : "polished"
      }  ${r.session_title}`
    );
  }

  const keep = rows.filter((r) => !targets.includes(r));
  console.log(`\nKeeping ${keep.length}:`);
  for (const r of keep) {
    console.log(`  ${r.created_at.slice(0, 10)}  ${r.session_title}`);
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --delete to remove the matched rides.");
    return;
  }

  const ids = targets.map((r) => r.id);
  if (ids.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  // capture_sessions.training_session_id is ON DELETE SET NULL, but unlink
  // first so a half-deleted state never points at a missing ride.
  const { error: unlinkErr } = await sb
    .from("capture_sessions")
    .update({ training_session_id: null })
    .in("training_session_id", ids);
  if (unlinkErr) console.warn("unlink capture_sessions:", unlinkErr.message);

  const { error: delErr, count } = await sb
    .from("training_sessions")
    .delete({ count: "exact" })
    .in("id", ids);
  if (delErr) throw delErr;

  console.log(`\nDeleted ${count ?? ids.length} rides.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
