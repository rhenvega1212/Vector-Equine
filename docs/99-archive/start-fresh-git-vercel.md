# Start Over: Git + Vercel (Step-by-Step)

You deleted your GitHub repos. Here’s how to put this project back on GitHub and Vercel from scratch.

---

## Step 1: Create a new repository on GitHub

1. Go to **https://github.com/new**
2. **Repository name:** e.g. `Vector-Equine` (or any name you like)
3. **Description:** optional (e.g. "Vector Equine – equestrian community app")
4. Choose **Public**
5. **Do not** check "Add a README file" (you already have code)
6. Click **Create repository**

GitHub will show a page with a URL like:  
`https://github.com/YOUR_USERNAME/Vector-Equine.git`  
Copy that URL; you’ll use it in Step 3.

---

## Step 2: Point your project at the new repo and push (on your computer)

In your project folder (`Equinti` on your Desktop), run these in a terminal.  
**Replace `YOUR_NEW_REPO_URL` with the URL from Step 1** (e.g. `https://github.com/rhenvega1212/Vector-Equine.git`).

```bash
cd "c:\Users\chris\OneDrive\Desktop\Equinti"

# Use the new repo as the only remote
git remote set-url origin YOUR_NEW_REPO_URL

# Push your code to the new repo (this uploads everything)
git push -u origin main
```

If Git asks you to log in, use your GitHub username and a **Personal Access Token** (not your GitHub password).  
To create a token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token. Give it “repo” scope.

---

## Step 3: Connect Vercel to the new repo

1. Go to **https://vercel.com** and log in
2. Click **Add New…** → **Project**
3. **Import** the **GitHub** repo you just created (e.g. `Vector-Equine`)
4. Click **Import**
5. **Environment Variables:** Add the same ones you use locally (from `.env.example`), at least:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL for now, e.g. `https://your-project.vercel.app`
6. Click **Deploy**

When the deployment finishes, your app will be live at the URL Vercel shows (e.g. `https://vector-equine.vercel.app`).

---

## Quick recap

| Step | Where        | What to do |
|------|--------------|------------|
| 1    | GitHub       | Create a new repo (no README), copy its URL |
| 2    | Your computer| `git remote set-url origin NEW_URL` then `git push -u origin main` |
| 3    | Vercel       | New Project → Import your new repo → Add env vars → Deploy |

After that, when you change code: **commit** → **push to main** → Vercel will auto-deploy.
