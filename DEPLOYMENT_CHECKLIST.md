# How to Get Vector Equine Live on the Internet (Simple Version)

Think of it like this: **your computer has the new game, but the internet is still showing the old one.** These steps make the internet use the new version.

---

## Part 1: Make Sure Vercel Is Using YOUR Project

**What’s going on:** Vercel (the place that puts your app on the internet) has to be pointed at your code. If it’s pointed at the wrong place, it will keep showing the old “Equinti” app.

1. Go to [vercel.com](https://vercel.com) and log in.
2. Open **your project** (the one for this app).
3. Click **Settings** (top menu).
4. Click **Git** in the left sidebar.
5. Check:
   - **Repository:** Should be **your** GitHub repo (e.g. `rhenvega1212/Vector-Equine` or `rhenvega1212/Equinti`). If you renamed the repo to “Vector-Equine,” make sure Vercel is connected to that repo.
   - **Production Branch:** Should be `main` (so when you push to `main`, Vercel builds the new version).

If the repo or branch is wrong, fix it and save. Then do a new deploy (see Part 3).

---

## Part 2: Give Vercel the Secret Keys It Needs

**What’s going on:** Your app needs a few “secret keys” to talk to Supabase (your database) and other services. If those keys aren’t in Vercel, the site can break or act weird.

1. In Vercel, open your project.
2. Go to **Settings** → **Environment Variables**.
3. Add **every variable** you have in your `.env.example` (or the list below).  
   For each one:
   - **Name:** exactly like in the list (e.g. `NEXT_PUBLIC_SUPABASE_URL`).
   - **Value:** the real value (from your Supabase dashboard or wherever you got it).
   - **Environment:** check **Production** (and Preview if you want).

**Minimum you need:**

- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL (from Supabase → Settings → API).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon/public key (same place).
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key (same place; keep this secret).
- `NEXT_PUBLIC_APP_URL` = your live site URL, e.g. `https://your-app.vercel.app` or `https://vectorequine.com`.

If you use Stripe, add those from `.env.example` too.  
**Save** after adding or changing any variable.

---

## Part 3: Build a Brand-New Version (So the Old One Goes Away)

**What’s going on:** Sometimes Vercel reuses an old “build” (a snapshot of your app). So even though your code is new, the site is still the old snapshot. You want one **new** build with no old cache.

1. In Vercel, open your project.
2. Go to the **Deployments** tab.
3. Find the **latest** deployment (top of the list).
4. Click the **three dots (⋮)** on the right of that deployment.
5. Click **Redeploy**.
6. **Important:** When the popup appears, turn **ON** the option like **“Clear build cache and redeploy”** (or similar). Then confirm **Redeploy**.

Wait until the new deployment shows **Ready**. That’s the new version of Vector Equine.

**Optional (to always avoid old cache):**  
In **Settings** → **Environment Variables**, add:

- Name: `VERCEL_FORCE_NO_BUILD_CACHE`  
- Value: `1`  
- Environment: Production (and Preview if you want)

Then the next time you push code or redeploy, Vercel won’t reuse old build cache.

---

## Part 4: Make Sure Your Phone Shows the New Version

**What’s going on:** Your phone might have saved the old version of the site (like an old screenshot). You need to force it to load the new one.

1. On your phone, open the **same URL** you use for the app (e.g. `https://your-app.vercel.app`).
2. **Option A – Hard refresh:**
   - **iPhone (Safari):** Hold the refresh button and choose “Reload without content blockers” or close the tab and open a new one.
   - **Android (Chrome):** Menu (⋮) → **History** → **Clear browsing data** → choose “Cached images and files” (and maybe “Cookies and site data” for this site) → Clear.
3. **Option B – Private/incognito:**  
   Open the app URL in a **private/incognito** window. That always loads a fresh version. If you see “Vector Equine” there, the deploy is correct and the issue was cache.
4. If you **added the app to your home screen** (like an app icon), remove that shortcut, clear cache as above, then open the site in the browser again and “Add to Home Screen” again so it uses the new version.

---

## Quick Checklist (Triple-Check These)

- [ ] **Git:** Latest code is pushed to GitHub (`main` branch).  
  - In your project folder: `git status` should say “nothing to commit, working tree clean” and “Your branch is up to date with 'origin/main'.”
- [ ] **Vercel – Git:** Project is connected to the **correct repo** and **Production Branch = main**.
- [ ] **Vercel – Env vars:** At least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_APP_URL` are set for Production.
- [ ] **Vercel – Deploy:** You clicked **Redeploy** with **“Clear build cache and redeploy”** and the new deployment is **Ready**.
- [ ] **Phone/browser:** You cleared cache or opened the site in a private window so you’re not seeing an old cached version.

If all of these are done, the internet and your phone should show **Vector Equine** with all your latest changes.
