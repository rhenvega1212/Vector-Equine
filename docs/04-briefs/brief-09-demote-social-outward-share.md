# Brief 09 — Demote social, lead with Vector, share outward

**For Cursor to build** in the existing app. Implements the launch decision: **lead with the
Vector product; keep social light; point sharing outward to real social (IG/TikTok).** Reuse the
existing feed/explore/challenges code — this is reprioritization + one new share feature, not a
rebuild.

Companion: `VE-decision-rider-trainer-model.md` and `brief-07-*` (the connection layer stays —
it is NOT "social," it's how coaching works). Brand + copy rules per brief-08.

**Build order:** A main nav → B keep connection layer → C outward share card → D light in-app feed
→ E flags → F verify.

---

## Principle (context)

"Social" is three different jobs; treat them differently:
1. **Connection layer** (trainer↔rider, barnmates, sharing a debrief) = core product. Keep, in
   Profile/Vector, not in "social."
2. **Public vanity feed / community** = high maintenance + cold-start ghost-town risk. **Demote &
   gate** at launch.
3. **Outward shareable clips** (a decoded ride → posted to real IG/TikTok) = the growth engine,
   with no in-app feed to keep alive. **Build this.**

The product is Vector; social is a lighter back room the rider visits when not training.

---

## STEP A — Main navigation: lead with Vector

Edit `components/shared/main-nav.tsx` and `components/shared/mobile-nav.tsx`.

- Make **Vector** the primary/first destination and the app's default landing after login
  (redirect `/` → `/train` for signed-in riders, unless product prefers a home).
- Target main nav (keep to ~4–5 items): **Vector** · **Horses/Progress** *(optional, or inside
  Vector)* · **Community** · **Profile**. Collapse **Feed + Explore** into a single lighter
  **Community** entry (secondary visual weight — not the front door).
- **Challenges** stays admin-gated (already is). Gate other community depth behind `COMMUNITY_ENABLED`.
- Do not delete feed/explore/challenges code — demote and gate. Preserve routes for later.

---

## STEP B — Keep the connection layer intact

- Trainer↔rider + barnmate connections (brief-07) are unaffected and live in **Profile** and
  inside **Vector** (e.g. "My coach," shared debriefs). They are not part of the demoted
  "Community."
- Sharing a debrief *to your coach* is a connection action (private), separate from the outward
  social share in STEP C.

---

## STEP C — Outward share card / clip (the growth feature)

Add a **Share** action on the **Debrief** (and on any highlight/ride) that produces a
post-ready asset for real social — no in-app feed required.

- **Format:** a **9:16** (1080×1920) share card sized for IG Stories/Reels & TikTok, plus a 1:1
  option for feed posts.
- **Content:** the ride's headline moment — e.g. execution score, one decoded line ("Right
  seatbone finding the sit"), horse name, and tasteful **Vector branding** (gold ◇ + wordmark,
  navy/cream/gold). Rider controls what's shown; default to non-sensitive (no health specifics,
  no PII beyond first name + horse name).
- **Generation:** render client-side (canvas or an OG-image/route) into a downloadable PNG; where
  a ride video exists, allow a short branded clip later (Phase 2 — start with the still card).
- **Delivery:** use the **Web Share API** (`navigator.share`) to open the native share sheet on
  mobile; fall back to a **Download** button. No dependency on any in-app feed.
- **Copy:** never print "AI"; keep it rider-native; "You ride. Vector assists." as an optional
  footer tag. This card *is* the marketing — make it beautiful and on-brand.

---

## STEP D — Light in-app feed (don't over-build)

- Keep a **feed**, but demoted and **connection-scoped** to avoid the ghost-town problem: show
  posts from the rider's connections/barn + their own shares — **not** a global empty feed.
- Progressive disclosure: if there's nothing to show, show an invitation ("Follow your barn" /
  "Share your first ride"), never an empty scroll.
- No new heavy community features at launch (no new challenge types, groups, etc.) — gated by
  `COMMUNITY_ENABLED=false`.

---

## STEP E — Config flags

Add clear config points so scope is a switch, not a rebuild:
- `SOCIAL_MODE = 'light'` (values: `off` | `light` | `full`)
- `COMMUNITY_ENABLED = false`
- `SHARE_OUTWARD_ENABLED = true`
Document them in one place so the founder can dial social up later without code archaeology.

---

## STEP F — Verify
- [ ] Vector is the primary nav item and the signed-in landing; Feed+Explore collapsed into a
      lighter Community; Challenges/community gated.
- [ ] Connection layer (coach/barn, shared debriefs) still works and is separate from Community.
- [ ] Debrief has a **Share** action that generates a 9:16 on-brand card and opens the native
      share sheet (with Download fallback); the card shows no PII beyond first name + horse and no
      health specifics by default.
- [ ] In-app feed is connection-scoped and shows an invitation when empty (no ghost town).
- [ ] `SOCIAL_MODE`, `COMMUNITY_ENABLED`, `SHARE_OUTWARD_ENABLED` flags exist and are honored.
- [ ] No visible "AI" string anywhere touched. List files touched.

---

### Cursor prompt
> Apply `brief-09-demote-social-outward-share.md`, STEP A→E, then STEP F. Reorder main + mobile
> nav so **Vector** leads and is the signed-in landing; collapse Feed+Explore into a lighter
> **Community** entry and gate community depth behind `COMMUNITY_ENABLED` (keep the code, don't
> delete). Leave the trainer/rider connection layer intact and separate. Build an outward
> **Share** action on the Debrief that renders a 9:16 on-brand PNG share card (score + one decoded
> line + horse name + Vector branding, no PII/health by default) and opens the Web Share sheet with
> a Download fallback. Keep the in-app feed but scope it to connections and show an invitation when
> empty. Add `SOCIAL_MODE`/`COMMUNITY_ENABLED`/`SHARE_OUTWARD_ENABLED` flags. Then run STEP F and
> list files touched.
