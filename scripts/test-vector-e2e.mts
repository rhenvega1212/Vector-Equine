/**
 * End-to-end: drives the real called-turn runtime against the real dev-server
 * routes (real Claude, real ElevenLabs, real Supabase writes) with fake ASR
 * text standing in for the microphone. Temporary dev harness.
 *
 *   npx tsx scripts/test-vector-e2e.mts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

const BASE = process.env.E2E_BASE || "http://localhost:3000";

// ---------- browser stubs ----------
let playbackCount = 0;
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  async resume() {}
  async decodeAudioData(buf: ArrayBuffer) {
    return { duration: buf.byteLength / 4000 };
  }
  createBufferSource() {
    const node: Record<string, unknown> = {
      buffer: null,
      onended: null,
      connect() {},
      stop() {},
      start() {
        playbackCount++;
        // Simulate a short clip finishing
        setTimeout(() => {
          const cb = node.onended as (() => void) | null;
          if (cb) cb();
        }, 250);
      },
    };
    return node;
  }
  createGain() {
    return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }
  createOscillator() {
    return {
      type: "",
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    };
  }
  createMediaStreamDestination() {
    return {
      stream: { getAudioTracks: () => [{ stop() {}, kind: "audio" }] },
    };
  }
}

const timers = new Set<NodeJS.Timeout>();
(globalThis as Record<string, unknown>).window = {
  setTimeout: (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.add(t);
    return t as unknown as number;
  },
  clearTimeout: (id: number) => clearTimeout(id as unknown as NodeJS.Timeout),
  AudioContext: FakeAudioContext,
  speechSynthesis: undefined,
};
(globalThis as Record<string, unknown>).AudioContext = FakeAudioContext;
(globalThis as Record<string, unknown>).Audio = class {
  src = "";
  volume = 0;
  async play() {}
  pause() {}
};

// ---------- log every call the client makes ----------
const calls: Array<{ path: string; body: Record<string, unknown>; status: number; type: string; ms: number }> = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const full = url.startsWith("http") ? url : `${BASE}${url}`;
  const t = Date.now();
  const res = await realFetch(full, init);
  const took = Date.now() - t;
  if (url.includes("/vector/")) {
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(String(init?.body));
    } catch {}
    calls.push({
      path: url.replace(/.*\/vector\//, "vector/"),
      body,
      status: res.status,
      type: res.headers.get("Content-Type") || "",
      ms: took,
    });
  }
  return res;
}) as typeof fetch;

// ---------- set up a real capture session ----------
const { createAdminClient } = await import("../src/lib/supabase/admin.ts");
const { signGuestCaptureToken, generateJoinCode, generateParticipantId } =
  await import("../src/lib/capture/guest-token.ts");

const admin = createAdminClient();
// Prefer a rider who actually has training history — that exercises the
// homework lookup and the topic filter, not just the general path.
const { data: withHistory } = await admin
  .from("training_sessions")
  .select("user_id")
  .limit(1)
  .maybeSingle();
const riderQuery = admin.from("profiles").select("id, display_name");
const { data: rider, error: riderErr } = (withHistory as { user_id?: string })
  ?.user_id
  ? await riderQuery
      .eq("id", (withHistory as { user_id: string }).user_id)
      .maybeSingle()
  : await riderQuery.limit(1).maybeSingle();
if (riderErr) throw new Error(`profile lookup failed: ${riderErr.message}`);
if (!rider) throw new Error("no profile to attach a test session to");

const joinCode = generateJoinCode();
const { data: session, error: sessErr } = await admin
  .from("capture_sessions")
  .insert({
    rider_id: (rider as { id: string }).id,
    join_code: joinCode,
    livekit_room: `e2e_${joinCode}`,
    status: "live",
    is_test: true,
  })
  .select("id")
  .single();
if (sessErr || !session) throw new Error(`create session failed: ${sessErr?.message}`);
const captureSessionId = (session as { id: string }).id;
console.log(`capture session ${captureSessionId} (rider ${(rider as { display_name?: string }).display_name || "?"})`);

const guestToken = signGuestCaptureToken({
  captureSessionId,
  participantId: generateParticipantId(),
});

// ---------- drive the real runtime ----------
const { createCalledTurnRuntime } = await import(
  "../src/lib/capture/called-turn-runtime.ts"
);

const ui: string[] = [];
const rt = createCalledTurnRuntime({
  getRoom: () => null,
  getCaptureSessionId: () => captureSessionId,
  getAuthHeaders: () => ({ Authorization: `Bearer ${guestToken}` }),
  getAskedBy: () => "rider",
  getRiderFirst: () => (rider as { display_name?: string }).display_name || null,
  getTrainerFirst: () => null,
  getOffsetMs: () => 0,
  isArmed: () => true,
  isCaptureLive: () => true,
  onUi: (u) => {
    if (u.line) ui.push(`SCREEN: ${u.line}`);
    if (u.strip === "idle") ui.push("SCREEN: (strip idle — turn closed)");
  },
  broadcast: () => {},
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function flush() {
  for (const l of ui) console.log("   " + l);
  ui.length = 0;
  for (const c of calls) {
    const q = c.body.question ? ` q="${c.body.question}"` : c.body.text ? ` text="${c.body.text}"` : "";
    console.log(
      `   HTTP ${c.path} ${c.status} ${c.type.includes("audio") ? "AUDIO" : "json"} ${c.ms}ms${q}`
    );
  }
  calls.length = 0;
}
async function say(text: string, settle = 600) {
  console.log(`\n RIDER: "${text}"`);
  rt.onAsrFinal(text);
  await wait(settle);
  flush();
}

console.log("\n=== bare wake → question → anything else → no ===");
await say("Hey, Vector.", 3000);
await say("Can you give me an exercise for leg yields?", 12000);
await say("No, I'm good.", 1000);

console.log("\n=== one breath ===");
await say("Hey Vector, how do I get a better trot?", 12000);
await say("Nope, that's it.", 1000);

console.log(`\naudio clips played: ${playbackCount}`);

// ---------- what landed in the transcript ----------
const { data: segs } = await admin
  .from("session_transcript_segments")
  .select("speaker, text, raw_json")
  .eq("capture_session_id", captureSessionId)
  .order("created_at", { ascending: true });
console.log(`\ntranscript rows written: ${(segs || []).length}`);
for (const s of (segs || []) as Array<{ speaker: string; text: string }>) {
  console.log(`   [${s.speaker}] ${s.text.slice(0, 110)}`);
}

// ---------- clean up ----------
rt.dispose();
await admin.from("session_transcript_segments").delete().eq("capture_session_id", captureSessionId);
await admin.from("capture_sessions").delete().eq("id", captureSessionId);
console.log("\ncleaned up test session");
for (const t of timers) clearTimeout(t);
process.exit(0);
