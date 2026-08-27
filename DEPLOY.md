# Going live on skillnsuccess.com — step by step

Your workflow from here on is simple and stays the same for every future change:

**edit code in this folder → commit → `git push` → Render redeploys automatically → live on skillnsuccess.com in ~1–2 minutes.**

This folder *is* your system folder — the whole repo, top to bottom, is the
single source of truth. There's nothing else to keep in sync.

---

## Step 1 — Push this folder to GitHub (one-time)

```bash
cd skillnsuccess-backend
git init
git add .
git commit -m "Initial commit — Skill N Success platform"
```

Then on github.com: **New repository** → name it e.g. `skillnsuccess` → **do not**
initialize with a README (you already have one) → create.

GitHub will show you two lines like this — run them:
```bash
git remote add origin https://github.com/YOUR_USERNAME/skillnsuccess.git
git branch -M main
git push -u origin main
```

From now on, any change is just:
```bash
git add .
git commit -m "describe the change"
git push
```

## Step 2 — Create the hosting service (Render, free tier)

1. Go to [render.com](https://render.com) → sign up/log in with GitHub.
2. **New** → **Web Service** → select your `skillnsuccess` repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free is fine to start.
4. **Environment** tab → add these (copy from `.env.example`, real values where you have them):
   ```
   ENABLE_PAYMENTS=false
   ALLOWED_ORIGINS=https://skillnsuccess.com,https://www.skillnsuccess.com
   ```
   Leave `RAZORPAY_*` and `ANTHROPIC_*` blank for now — the site runs fully
   without them (pricing section shows a waitlist instead of checkout).
5. **Disks** tab → add a disk, mount path `/opt/render/project/src/data` (1 GB
   is plenty) — this keeps your SQLite data across deploys/restarts.
6. Click **Create Web Service**. Render builds and deploys automatically.
   You'll get a URL like `https://skillnsuccess.onrender.com` — open it and
   confirm the site loads, and `https://skillnsuccess.onrender.com/api/health`
   returns `{"ok":true}`.

Every future `git push` to `main` triggers a new deploy automatically — no
extra step.

## Step 3 — Point skillnsuccess.com at it (GoDaddy)

You have two options. **Option A is simpler and is what I'd recommend** — it
doesn't touch your nameservers at all, just adds two records inside GoDaddy's
existing DNS.

### Option A — Add DNS records in GoDaddy (recommended)

1. In Render: your service → **Settings** → **Custom Domains** → **Add
   Custom Domain** → enter `skillnsuccess.com`, then again for
   `www.skillnsuccess.com`. Render will show you the exact records to add —
   typically:
   - Root domain (`skillnsuccess.com`): an **A** record pointing to Render's
     IP (Render shows you the current one).
   - `www`: a **CNAME** record pointing to `skillnsuccess.onrender.com`.
2. Log into **GoDaddy → My Products → DNS** (or "Manage DNS") for
   skillnsuccess.com.
3. Add/edit those two records under **DNS Management** (not nameservers):
   - Type `A`, Name `@`, Value = the IP Render gave you, TTL default.
   - Type `CNAME`, Name `www`, Value = `skillnsuccess.onrender.com`, TTL default.
4. Save. DNS usually propagates within 10–60 minutes (occasionally a few
   hours). Render auto-issues an SSL certificate once it detects the domain
   resolving correctly — you'll see a green "Verified" status on the Custom
   Domains page.

### Option B — Change nameservers (only if you want Render/Cloudflare managing all DNS)

Not necessary for this use case — Option A is simpler and keeps GoDaddy as
your DNS manager, which is fine long-term. Skip this unless you have a
specific reason to move DNS management elsewhere.

### If you'd like me to double check your records

Paste in whatever GoDaddy's DNS management page shows you (the record
type/name/value rows) and I'll tell you exactly what to change or confirm
it's already correct — I can't log into GoDaddy myself, but I can read back
whatever you paste here.

## Step 4 — Turn on payments later (whenever you're ready)

1. Get real Razorpay keys (test mode first) and an Anthropic API key.
2. In Render → Environment: set `ENABLE_PAYMENTS=true` and fill in
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
   `ANTHROPIC_API_KEY`.
3. In Razorpay Dashboard → Webhooks: add
   `https://skillnsuccess.com/api/checkout/webhook`, subscribed to
   `payment.captured` and `order.paid`.
4. Save — Render redeploys with the new env vars automatically, no code
   change needed. The pricing button switches from "Join the Waitlist" to a
   live Razorpay checkout the next time the page loads `/api/config`.

## Checking in on your waitlist

Everyone who clicks "Join the Waitlist" is saved in the `waitlist` table in
the SQLite database. Simplest way to check it for now:
```bash
# on the Render shell (Render dashboard → your service → Shell tab)
node -e "const db=require('./src/db'); console.log(db.prepare('SELECT * FROM waitlist ORDER BY created_at DESC').all())"
```
A proper admin view is on the fast-follow list — flag it if you want it
prioritized.
