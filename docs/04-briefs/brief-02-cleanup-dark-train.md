# Brief 02 — Cyan cleanup + dark Train + gate Challenges

For Cursor to execute on the `rebrand/*` branch. Do Phase 0 (re-run Brief 01 STEP 1/2/3a)
FIRST if `--primary` in `globals.css` is still `191 80% 32%`. Then this.

Brand hexes: navy `#0E1729` · cream `#FCF2E6` · gold `#D1A955` · gold-bright `#F0C967` · ink `#1A2133`.

---

## STEP A — Add brand colors to `tailwind.config.ts`

In `theme.extend.colors`, ADD (keep all existing semantic colors):

```ts
navy:  "#0E1729",
cream: "#FCF2E6",
ink:   "#1A2133",
gold: {
  DEFAULT: "#D1A955",
  bright:  "#F0C967",
},
```

Now `text-gold`, `bg-gold/20`, `border-gold/40`, `text-gold-bright`, `bg-navy`, etc. all work.

---

## STEP B — Replace hardcoded cyan/blue classes

These ignore the theme, so the token remap doesn't touch them. Find-and-replace across
`src/`, **preserving any `/NN` opacity suffix**:

| Find                | Replace             |
|---------------------|---------------------|
| `cyan-400`          | `gold`              |
| `cyan-500`          | `gold`              |
| `cyan-300`          | `gold-bright`       |
| `blue-400`          | `gold`              |
| `blue-500`          | `gold`              |

Examples: `text-cyan-400` → `text-gold` · `bg-cyan-400/20` → `bg-gold/20` ·
`border-cyan-400/40` → `border-gold/40`.

Files affected (from grep): `components/ui/slider.tsx`, `components/train/*`
(horse-card, session-form, horse-form, ai-trainer-chat, ai-upload-form),
`components/shared/*` (profile-header, profile-tabs, cover-image-upload, avatar-cropper,
admin-badge, upload-progress-bar), `app/(main)/train/train-layout-client.tsx`.

After replacing, run `grep -rnE "(cyan|sky|teal|blue)-[0-9]" src` — should be empty.

---

## STEP C — Kill glows + flatten gradient buttons (the on-brand part)

Plain color-swapping the gradient buttons keeps a glow. Instead flatten them.

**`profile-tabs.tsx` (~line 138) "Create Post" button** — replace the className:
```tsx
// from:
className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-semibold shadow-lg shadow-cyan-500/25"
// to:
className="gap-2 bg-gold text-navy font-semibold hover:bg-gold/90"
```

**`profile-header.tsx` (~line 228) Follow button** — same idea:
```tsx
// the !isFollowing branch becomes:
"bg-gold text-navy font-semibold hover:bg-gold/90"
```

**`profile-header.tsx` (~line 132) avatar "glow ring"** — delete the blurred gradient div:
```tsx
// remove this line entirely:
<div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-500 rounded-full opacity-30 blur-sm" />
```
The Avatar already has `border-primary/40 ring-primary/20` (now gold) — that's the accent.

**Trainer badge (`profile-header.tsx` ~line 150)** — keep it visually distinct from the
gold Admin badge. Use a quiet ink outline instead of gold:
```tsx
className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
```

Also remove any remaining `shadow-cyan-500/25`, `shadow-primary/…` glow shadows you find in
these files.

---

## STEP D — Slider (`components/ui/slider.tsx`)
`bg-cyan-400` → `bg-gold` ; `border-cyan-400` → `border-gold` (covered by STEP B, just confirm).

---

## STEP E — Section rhythm + gating

### E1 — Dark Train workspace
Train is already admin-gated (layout redirects non-admins). Make the workspace cinematic
navy by wrapping the client layout in a `dark` scope.

In `src/app/(main)/train/train-layout-client.tsx`, wrap the returned root:
```tsx
return (
  <div className="dark bg-background text-foreground min-h-screen -mx-3 sm:-mx-4 px-3 sm:px-4 py-6 rounded-none">
    <div className="space-y-6">
      {/* existing nav + children */}
    </div>
  </div>
);
```
(Adjust the negative-margin/padding to bleed the navy full-width under the existing header.)
Note: the top header stays light for now — dark content under a light header reads as
"entering the tool." Header-aware dark is a fast-follow, not today.

Also change the Train sub-nav border `border-gold/20` (already swapped in STEP B) — confirm
it's gold, not cyan.

### E2 — Gate Challenges to admin
In `src/components/shared/main-nav.tsx`:

1. Add the flag to the Challenges nav item:
```tsx
{ href: "/challenges", label: "Challenges", icon: Trophy, comingSoon: true, adminOnly: true },
```
2. Generalize the gating logic (currently hardcoded to `/train`). Replace the per-item
   `isTrain` checks with:
```tsx
const requiresAdmin = !!item.adminOnly;
const canAccess = !requiresAdmin || profile.role === "admin";
const showAsDisabled = requiresAdmin && !canAccess;
```
   and use `item.comingSoon` (not `isTrain`) to decide whether to render the "Coming soon" badge.
3. **True gate (not just nav):** add a server redirect to the Challenges route so non-admins
   can't reach it by URL. Mirror the Train layout. Create
   `src/app/(main)/challenges/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ChallengesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/feed");
  return <>{children}</>;
}
```

---

## STEP F — Verify
- `grep -rnE "(cyan|sky|teal|blue)-[0-9]" src` → empty
- Feed/profile: gold buttons, no glow, no blue Follow text
- Train: dark navy with gold accents
- Challenges: hidden in nav for non-admins, redirects to /feed by URL
- List every file touched.

---

### Cursor prompt
> Apply `brief-02-cleanup-dark-train.md` in order, STEP A through E. Preserve `/NN` opacity
> suffixes during replacements. Flatten the gradient buttons to solid gold per STEP C (don't
> keep gradients). Don't change logic or data except the documented gating in STEP E. After,
> run `grep -rnE "(cyan|sky|teal|blue)-[0-9]" src` and paste the result, then list files touched.
