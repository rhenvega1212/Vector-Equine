# Brief 04 — Logo assets + nav mark

New brand assets are in the project's `brand-assets/` folder (sibling of the repo). This
brief places them in `public/` and renders the mark in the nav. Run on `rebrand/*`.

The old `public/logo.png` is the cyan circuit-horse on solid black — that baked-in black is
the "black box" problem. These replace it with clean transparent / navy-correct files.

---

## STEP 1 — Copy assets into `public/`

Copy from `../brand-assets/` (project root) into `Vector-Equine/public/`, replacing where noted:

| From `brand-assets/`   | To `public/`            | Notes                                  |
|------------------------|-------------------------|----------------------------------------|
| `logo-mark.png`        | `logo-mark.png`         | NEW — transparent gold mark, for nav   |
| `logo-full.png`        | `logo.png`              | REPLACE — transparent full lockup      |
| `og-image.png`         | `og-image.png`          | REPLACE — navy 1200×630 social card     |
| `favicon.png`          | `favicon.png`           | REPLACE — navy square mark             |
| `icon-192.png`         | `icon-192.png`          | REPLACE                                |
| `icon-512.png`         | `icon-512.png`          | REPLACE                                |
| `apple-touch-icon.png` | `apple-touch-icon.png`  | REPLACE                                |

(You can drag these in Finder, or `cp ../brand-assets/<file> public/<dest>`.)
The old `public/horse-head-icon.png` is now unused — leave or delete.

---

## STEP 2 — Render the mark in the nav  ·  `src/components/shared/main-nav.tsx`

The wordmark is still the old cyan `magical-text` span. Replace it with the mark image —
**no background wrapper** (that's what was creating the black box).

```tsx
// add at top with the other imports:
import Image from "next/image";

// replace the logo <Link> block (the one with <span ... magical-text>Vector Equine</span>) with:
<Link href="/feed" className="mr-4 sm:mr-6 flex items-center">
  <Image
    src="/logo-mark.png"
    alt="Vector Equine"
    width={48}
    height={36}
    priority
    className="h-8 w-auto"
  />
</Link>
```

Mark-only, transparent, gold-on-nothing — it reads on the cream header now and will read on
navy sections later. No `bg-*` on the link or any wrapper.

---

## STEP 3 — Check other logo spots

`grep -rn "/logo.png\|magical-text\|horse-head-icon" src` and confirm:
- `loading-screen.tsx` (`/logo.png`) — now the transparent lockup; fine on its background
- `app/page.tsx` landing (`/logo.png`) — fine
- `mobile-nav.tsx` — if it shows a text wordmark, swap to the same `<Image src="/logo-mark.png">`
- Remove any leftover `.magical-text` usage (class can stay in globals, just unused)

---

## STEP 4 — Verify
- Hard-refresh (favicons cache hard): nav shows the gold horse mark, no black box
- Browser tab favicon is the navy/gold square
- Login/loading show the full lockup
- `grep -rn "magical-text" src` → only the (now-unused) class def, no usages
- List files touched.

---

### Cursor prompt
> Apply `brief-04-logo-assets.md`. STEP 1: copy the 7 files from the project's
> `brand-assets/` folder into `Vector-Equine/public/` per the table (replacing existing).
> STEP 2: in `src/components/shared/main-nav.tsx` replace the cyan `magical-text` wordmark
> span with the `<Image src="/logo-mark.png">` mark, no background wrapper. STEP 3: swap any
> other text wordmark (e.g. mobile-nav) to the same mark. Visual only, no logic changes.
> List files touched.
