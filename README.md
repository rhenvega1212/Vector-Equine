# Vector Equine

Vector Equine reads a rider's aids — pressure, timing, release — through biosensors on horse and
rider, and coaches in real time. This repository is the web application, plus the agent that runs on
the in-arena capture device.

**Before you write any code, read [`CLAUDE.md`](./CLAUDE.md).** It holds hard constraints on
language, brand and layout that apply to every change. Then read
[`docs/README.md`](./docs/README.md) for the guided path into the rest of the documentation.

---

## The one-paragraph mental model

**The ride is a moment, the horse is a timeline.** Anything that happens today belongs to the ride;
anything that accrues over time belongs to the horse.

There is **one app**, on phones — web now, native later. The capture device is *equipment*, like a
camera. The app uses it when it's there and works without it when it isn't. A ride without the box
routes audio phone → internet → phone. A ride with the box routes it phone → box → phone and gains
video and sensor data. Same session object either way, so the debrief is one code path.

The section of the app branded **Vector** is the training surface. It is never called "AI" in any
rendered copy — see `CLAUDE.md` for why, and for the full list of banned words.

---

## Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14, App Router |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database, auth, storage | Supabase (PostgreSQL) |
| Live session audio | LiveKit (`livekit-client`, `livekit-server-sdk`) |
| Transcription | OpenAI Whisper (`whisper-1`), hosted API |
| Language models | Vercel AI SDK with Anthropic and OpenAI providers |
| Payments | Stripe (Checkout, Subscriptions, Webhooks) |
| Data fetching | TanStack Query |
| Forms and validation | React Hook Form + Zod |
| Tests | Vitest |

**Every screen is designed at 390 × 844 and must be correct at phone width before desktop.** If it
looks right on a laptop and wrong on a phone, it's wrong.

---

## Getting started

Prerequisites: Node 18+, a Supabase project, and the Supabase CLI.

```bash
npm install
cp .env.example .env.local     # then fill it in
supabase link --project-ref YOUR_PROJECT_REF
npm run db:push                # applies supabase/migrations
npm run dev                    # http://localhost:3000
```

Scripts:

| Command | Does |
|---------|------|
| `npm run dev` | Dev server, bound to `0.0.0.0` so you can open it on a phone on the same network |
| `npm run build` | Production build |
| `npm test` | Vitest, single run |
| `npm run lint` | Next lint |
| `npm run db:push` | Push migrations to the linked Supabase project |

**Test on a real phone early.** Because `dev` binds to `0.0.0.0`, you can reach it from your phone at
`http://<your-laptop-ip>:3000`. Capture work involving microphones cannot be meaningfully tested in a
desktop browser.

Some migrations have hand-runnable equivalents in `supabase/manual/` for when `db:push` isn't an
option. Feature flags live in the `feature_flags` table — several capture surfaces are gated, so if a
screen seems missing, check the flag before assuming the code is broken.

---

## Project structure

```
src/
├── app/
│   ├── (auth)/           login, signup, onboarding
│   ├── (join)/           trainer scan-in by join code
│   ├── (invite)/         connection invites
│   ├── (main)/
│   │   ├── train/        Vector: ride, live session, debrief, lab
│   │   ├── feed/         social feed
│   │   ├── events/       events hub
│   │   ├── explore/      discovery
│   │   └── profile/ settings/ pricing/ payments/
│   ├── admin/            admin dashboard, flags, reports
│   ├── trainer/          trainer tools
│   └── api/
│       ├── capture/      live session lifecycle, audio, transcript, Vector turns
│       ├── edge/         device pairing, attach, heartbeat, video upload
│       ├── train/        rides, journal, debrief, horses, feel ratings
│       └── …             feed, events, payments, webhooks, admin
├── components/
│   ├── capture/          live session UI (the most complex area)
│   ├── train/            Vector screens
│   ├── ui/               shadcn/ui primitives
│   └── feed/ events/ profile/ admin/ shared/ layouts/
├── lib/
│   ├── capture/          Whisper, ASR cleanup, wake word, called turns, edge tokens
│   ├── vector/           Vector config and prompts
│   ├── supabase/         browser, server and admin clients
│   ├── train/ ask/       ride journal and debrief Q&A
│   └── permissions/ flags/ stripe/ validations/ security/
├── services/             sensor stubs, not yet implemented
└── types/                database.ts is generated from the schema

edge/jetson-agent/        the program that runs on the capture device (Python)
supabase/migrations/      schema, applied in filename order
supabase/manual/          hand-runnable equivalents of selected migrations
scripts/                  seeding, probes and one-off maintenance
docs/                     see docs/README.md
```

### Where things actually happen

| If you're working on | Start at |
|----------------------|----------|
| The live session | `src/components/capture/capture-room.tsx` — large, and the centre of the capture flow |
| Session lifecycle | `src/app/api/capture/sessions/route.ts` and `…/[id]/end/route.ts` |
| Transcription | `src/lib/capture/whisper.ts` and `src/lib/capture/asr-cleanup.ts` |
| Wake word and called turns | `src/lib/capture/wake-word.ts`, `called-turn-runtime.ts` |
| The capture device | `src/app/api/edge/**` and `edge/jetson-agent/agent.py` |
| Ride journal and debrief | `src/app/api/train/**`, `src/lib/train/` |
| Schema | `supabase/migrations/`, newest last. Types mirror in `src/types/database.ts` |

---

## Two things that will bite you

**The app and the device agent must agree on what a session is.** They're in one repo for exactly
that reason. The app is TypeScript and the agent is Python, so nothing currently enforces the
agreement — if you change the shape of a session, check `edge/jetson-agent/` by hand.

**A session's clock is owned by the cloud.** `capture_sessions.t0` is the reference, and every
transcript segment, video chunk and sensor sample is stamped as an offset from it. Never introduce a
second clock, and never assume the device's local time matches.

---

## User roles

Roles are booleans on `profiles`, so one person can be both a rider and a trainer.

- **Rider** — the default. Owns their sessions, always.
- **Trainer** — teaches sessions; sees what they were present for plus anything a rider shares.
- **Admin** — user management, moderation, feature flags.

Owning hardware grants no visibility into a rider's private sessions. This is a standing commitment,
not an implementation detail.

---

## Deployment

Vercel. See [`docs/05-ops/deployment-checklist.md`](./docs/05-ops/deployment-checklist.md) and
[`docs/05-ops/stripe-setup.md`](./docs/05-ops/stripe-setup.md).

---

## License

Private. All rights reserved.
