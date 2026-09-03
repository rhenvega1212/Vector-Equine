# Vector Equine Rebrand Checklist

This checklist covers **backend, external services, and manual steps** to complete the rebrand from Equinti to Vector Equine. Code and in-app branding have already been updated.

---

## ✅ Done in Codebase

- **App name & copy**: All "Equinti" → "Vector Equine" in UI, metadata, terms, privacy, auth, payments.
- **Contact email**: support@equinti.com → support@vectorequine.com (Terms, Privacy).
- **Domain references**: equinti.com → vectorequine.com in `.env.example`, `sitemap.ts`, `robots.txt`.
- **Package name**: `equinti` → `vector-equine` in `package.json` and `package-lock.json`.
- **Logo**: Vector Equine logo image copied to `public/logo.png` and `public/og-image.png` (used on login, loading screen, nav, and Open Graph).
- **Seed data**: Test user emails → *@vectorequine.com, display name "Vector Equine Admin", event title and venue updated.
- **README & STRIPE_SETUP**: Titles and references updated to Vector Equine.

---

## 🔲 Backend & Hosting

### Environment variables

- [ ] **Production/staging `.env`**
  - Set `NEXT_PUBLIC_APP_URL=https://vectorequine.com` (or your actual domain).
- [ ] **Supabase**
  - In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to `https://vectorequine.com`.
  - Add `https://vectorequine.com` (and `https://www.vectorequine.com` if used) to **Redirect URLs** if needed.

### Domain & DNS

- [ ] Register or configure domain **vectorequine.com** (and www if desired).
- [ ] Point DNS to your host (Vercel, etc.) and ensure SSL is active.

### Supabase project (optional)

- [ ] **`supabase/config.toml`** still has `project_id = "equinti"`. If you create a new Supabase project for Vector Equine, update this and run `supabase link` again. If you keep the same project, you can leave it or rename the project in the Supabase dashboard for clarity.

---

## 🔲 External Services

### Stripe

- [ ] In Stripe Dashboard, update **Business name** / branding to "Vector Equine" if shown to customers.
- [ ] Check **Customer email** templates and any hardcoded "Equinti" text.
- [ ] If you use Stripe Customer Portal or Checkout branding, set name/logo to Vector Equine.

### Email (if applicable)

- [ ] Create or update **support@vectorequine.com** and use it for support (Terms/Privacy already reference it).
- [ ] If you use transactional email (e.g. Resend, SendGrid), update sender name to "Vector Equine" and any templates that mention Equinti.

### OAuth / social login (if used)

- [ ] In Google, GitHub, or other OAuth apps, update **Application name** and **Authorized redirect URIs** to use vectorequine.com.

### Analytics & monitoring

- [ ] Rename the project/site in **Vercel Analytics**, **Google Analytics**, **Sentry**, or similar to "Vector Equine".
- [ ] Update any saved links or bookmarks that point to equinti.com.

---

## 🔲 Favicon & PWA Icons

The app expects these in `public/`:

- `favicon.png` (e.g. 32×32)
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `apple-touch-icon.png` (180×180)

**To do:**

- [ ] Generate these sizes from the Vector Equine logo (icon only or full logo, depending on design).
- [ ] Place the files in `public/`. The layout and manifest already reference them.

If you only add `favicon.png`, the app will still run; other icons improve PWA and mobile experience.

---

## 🔲 Existing Data (if already live as Equinti)

- [ ] **Supabase Auth**: Existing users keep their emails; no change required. New seed/test users use *@vectorequine.com.
- [ ] **Stripe**: Existing customers and subscriptions are unchanged; only branding in dashboard and customer-facing copy need updates.
- [ ] **Content**: Search for "Equinti" in stored content (e.g. profiles, posts, event descriptions) and update or leave as-is per your policy.

---

## 🔲 Repo & Deployment

- [ ] Commit and push rebrand changes; deploy to production.
- [ ] If the repo or GitHub/GitLab project is still named "Equinti", consider renaming to "vector-equine" or "VectorEquine" for consistency.
- [ ] Update any CI/CD or deployment config that references the old name or domain.

---

## Quick reference

| Item           | Old            | New                |
|----------------|----------------|--------------------|
| App name       | Equinti        | Vector Equine      |
| Domain         | equinti.com    | vectorequine.com   |
| Support email  | support@equinti.com | support@vectorequine.com |
| Package name   | equinti        | vector-equine      |
