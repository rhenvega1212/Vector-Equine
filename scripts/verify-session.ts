/**
 * Verify a capture session right after a ride.
 *
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/verify-session.ts --capture <id>
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/verify-session.ts --session <training_session_id>
 *
 * Writes tmp/session-verify/<id>-<time>.md and .json. The markdown verdict
 * is the thing to read. Console only prints the file path.
 */
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import {
  verifyCaptureSession,
  writeVerifyReport,
} from "../src/lib/capture/session-verify";

function parseArgs(argv: string[]) {
  let capture: string | null = null;
  let session: string | null = null;
  let out = path.join(process.cwd(), "tmp", "session-verify");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--capture" && argv[i + 1]) capture = argv[++i];
    else if (argv[i] === "--session" && argv[i + 1]) session = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
    else if (!argv[i].startsWith("--") && !capture) capture = argv[i];
  }
  return { capture, session, out };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.capture && !args.session) {
    throw new Error("Pass --capture <capture_session_id> or --session <training_session_id>");
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  let captureId = args.capture;
  if (!captureId && args.session) {
    const { data, error } = await db
      .from("capture_sessions")
      .select("id")
      .eq("training_session_id", args.session);
    if (error) throw new Error(error.message);
    const rows = data || [];
    if (rows.length === 0) {
      throw new Error(`No capture session for training session ${args.session}`);
    }
    if (rows.length > 1) {
      throw new Error(
        `Training session ${args.session} has ${rows.length} capture sessions — pass --capture <id>`
      );
    }
    captureId = rows[0]!.id as string;
  }

  const report = await verifyCaptureSession(db, captureId!);
  const files = writeVerifyReport(report, args.out);
  process.stdout.write(`${files.md}\n`);
  if (!report.verdict.usable_as_baseline) process.exitCode = 2;
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
