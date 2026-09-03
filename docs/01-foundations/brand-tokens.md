# Vector Equine — Token Foundation (paste into Cursor)

Canonical brand tokens. Apply these first; every component restyle references them.
Navy values are canonized from the logo and match the live site family.

---

## 1. `globals.css` — CSS variables

Paste into the `:root` block of `app/globals.css` (or wherever globals live).

```css
:root {
  /* Brand palette */
  --navy:        #0E1729; /* primary dark bg, hero sections */
  --cream:       #FCF2E6; /* warm content bg; text on navy */
  --gold:        #D1A955; /* accents, borders, icons (flat) */
  --gold-bright: #F0C967; /* logo gradient top-stop / rare hero highlight ONLY */
  --ink:         #1A2133; /* body text on cream */

  /* Logo gradient — reserve for the wordmark/mark, not UI */
  --gold-gradient: linear-gradient(135deg, #D1A955 0%, #F0C967 100%);

  /* Type */
  --font-sans:  var(--font-wordmark, ui-sans-serif, system-ui, sans-serif);
  --font-serif: Georgia, "Times New Roman", serif;
}
```

Rule: gold is a scalpel, not a highlighter. Use flat `--gold` everywhere in UI.
The `--gold-gradient` is for the logo and at most one or two hero accents — nowhere else.

---

## 2. `tailwind.config.js` — token extension

If colors live in Tailwind rather than CSS vars, paste into `theme.extend`:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        navy:        "#0E1729",
        cream:       "#FCF2E6",
        gold:        "#D1A955",
        "gold-bright":"#F0C967",
        ink:         "#1A2133",
      },
      fontFamily: {
        // sans = logo wordmark + nav labels + (headlines, if you keep sans)
        sans:  ["var(--font-wordmark)", "ui-sans-serif", "system-ui", "sans-serif"],
        // serif = editorial headlines + body on cream  (recommended for headlines)
        serif: ["Georgia", "Times New Roman", "serif"],
      },
      letterSpacing: {
        // spaced-caps nav labels: FEED · EXPLORE · TRAIN
        caps: "0.34em",
      },
    },
  },
};
```

Usage examples:
- Nav label: `className="uppercase tracking-caps text-gold text-[11px] font-semibold"`
- Flat gold button: `className="bg-gold text-navy font-semibold px-5 py-2.5 rounded-md"` (NO shadow/glow)
- Gold border ring: `className="border border-gold"` (replaces cyan rings)

---

## 3. Headline font — LOCKED: serif

Headlines / section titles use the editorial serif (`--font-serif`), matching the live
site. Logo wordmark + nav labels stay sans — the mismatch is intentional and on-brand.

```css
h1, h2, .section-title { font-family: var(--font-serif); }
```

Tailwind equivalent: `className="font-serif"` on headline elements.

Gold italic accent: one emotional phrase per section, e.g.
`<span class="text-gold italic">the moment.</span>` — restrained, never per-paragraph.

---

## 4. Section rhythm (the "vibe")

The app should alternate, not be one dark slab:

- Hero / nav band → `bg-navy text-cream`
- Content block → `bg-cream text-ink`
- Section break → centered gold diamond `◇` and/or corner brackets, small + restrained.

---

## 5. Cyan → brand mapping (apply during component pass)

| Current (cyan)            | Replace with                          |
|---------------------------|---------------------------------------|
| cyan text / wordmark      | `--cream` (or `--gold` for emphasis)  |
| cyan button + neon glow   | flat `--gold` fill, **no shadow**     |
| cyan borders / rings      | thin `--gold` border                  |
| cyan icons                | `--gold`                              |
| cyan circuit-horse badge  | gold logo mark (from logo PNG)        |
| uniform dark slab bg      | keep `--navy`; add `--cream` sections |

Kill the glow first — the cyan neon shadows are the most off-brand element.
