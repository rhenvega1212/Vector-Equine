# Brief 03 — Auth screens go navy-forward (login / signup / onboarding)

Goal: make the auth experience the cinematic navy hero from the landing page, not a white
card on cream. One shared layout change covers all three pages; then small per-page fixes.

Run on the `rebrand/*` branch after Brief 02. Brand: navy `#0E1729` · cream `#FCF2E6` ·
gold `#D1A955` · ink `#1A2133`. Assumes the `gold`/`navy`/`cream` Tailwind colors from
Brief 02 STEP A exist.

---

## STEP 1 — Auth layout goes navy  ·  `src/app/(auth)/layout.tsx`

Replace the whole file with:

```tsx
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-[#0B1220] p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <Image
          src="/logo.png"
          alt="Vector Equine"
          width={120}
          height={120}
          priority
          className="mb-8 h-16 w-auto"
        />
        {children}
      </div>
    </div>
  );
}
```

What this does: the `dark` class flips every shadcn token to the navy theme, so the Card
becomes lifted navy (`--card` = `220 42% 14%`), text becomes cream, and the gold button +
gold focus ring finally read against a dark surface. The logo mark sits above the card.

> Confirm `public/logo.png` reads on navy (transparent or navy-badge version). If it's a
> light-background lockup, use the navy/transparent mark instead.

---

## STEP 2 — Card lift + serif headlines (all three pages)

The cards now sit on navy; give them a touch of elevation and make titles editorial.

On the `<Card>` in `login/page.tsx`, `signup/page.tsx`, `onboarding/page.tsx`, add:
```tsx
<Card className="border-gold/15 shadow-2xl shadow-black/30">
```

On every `<CardTitle className="text-2xl">`, make it serif + larger:
```tsx
<CardTitle className="text-3xl font-serif">…</CardTitle>
```
(applies to "Welcome back", "Create an account", "Check your email!", "Complete your profile")

Optional brand warmth on the login card only — under `<CardDescription>`, add one restrained
gold italic line:
```tsx
<p className="mt-1 text-sm italic text-gold">Every rider knows the moment.</p>
```

---

## STEP 3 — Kill remaining cyan in auth

`login/page.tsx` (footer links ~158, 161):
```tsx
className="hover:text-gold transition-colors"   // was hover:text-cyan-400
```

`signup/page.tsx`:
- line ~69 icon: `className="mx-auto mb-4 h-12 w-12 text-gold"`   (was text-cyan-400)
- lines ~85, 140, 144 links: `text-gold hover:underline`   (was text-cyan-400)

After: `grep -rnE "(cyan|sky|teal|blue)-[0-9]" "src/app/(auth)"` → empty.

---

## STEP 4 — Input contrast on navy (optional but recommended)

On navy, the default inputs can feel flat. If they look low-contrast in the screenshot,
add to each auth `<Input>`:
```tsx
className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
```
Leave it out if the defaults already read cleanly — judge from the running app.

---

## STEP 5 — Verify
- Login/signup/onboarding all render on navy with the logo mark above the card
- Headlines are serif cream; Sign In / Create Account buttons are gold and pop
- No cyan anywhere in `(auth)`
- Compare side-by-side with vectorequine.com — should feel like the same brand
- List files touched.

---

### Cursor prompt
> Apply `brief-03-auth-screens.md` STEP 1–5. STEP 1 replaces `src/app/(auth)/layout.tsx`
> entirely. STEP 2 and STEP 3 edit `login/page.tsx`, `signup/page.tsx`, `onboarding/page.tsx`.
> Don't change any form logic, validation, or submit handlers — visual only. After, run
> `grep -rnE "(cyan|sky|teal|blue)-[0-9]" "src/app/(auth)"` and paste the result, then list
> files touched.
