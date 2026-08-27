# Skill N Success — Backend

A real, working backend for the Skill N Success platform: assessment persistence,
versioned scoring, AI-generated Success Plans (Claude), and an optional Razorpay
checkout — plus the marketing site, served as one deployable app.

**→ To go live on skillnsuccess.com, see [DEPLOY.md](./DEPLOY.md).** That file
has the exact GitHub → Render → GoDaddy DNS steps. This README covers what the
app does and how to run it locally.

## Payments are optional — the site is fully live-able without them

Set `ENABLE_PAYMENTS=false` (the default) and the pricing section shows a
**waitlist capture** instead of a checkout button — real emails get saved,
nothing breaks, and you don't need Razorpay or Anthropic keys to launch.
Flip `ENABLE_PAYMENTS=true` later, once those keys are ready, and the same
button becomes a live Razorpay checkout with no code changes.

## What's real vs. what needs your keys

| Piece | Status |
|---|---|
| Assessment start/resume/answer/complete | Working now, no keys needed |
| Scoring engine (versioned, deterministic) | Working now, no keys needed |
| Dashboard aggregation | Working now, no keys needed |
| Waitlist capture | Working now, no keys needed |
| Razorpay checkout | Code is correct and tested against bad/missing config — dormant until `ENABLE_PAYMENTS=true` + real keys |
| AI Success Plan generation (Claude) | Code is correct — gated behind a paid entitlement, so also dormant until payments are on |
| User auth | Simplified to email-only for MVP (no password/OTP). Fine for a soft launch |

## 1. Local setup

```bash
cd skillnsuccess-backend
npm install
cp .env.example .env      # then fill in real values (see below)
npm start                 # serves API + frontend at http://localhost:8080
```

## 2. Get your real keys (only needed once you enable payments — see DEPLOY.md)

**Razorpay** (dashboard.razorpay.com → Account & Settings → API Keys)
- Start in **Test Mode**: keys look like `rzp_test_...`
- Create a **Webhook** (Settings → Webhooks) pointing at
  `https://YOUR_DOMAIN/api/checkout/webhook`, subscribed to `payment.captured`
  and `order.paid`. Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.
- Switch to live keys (`rzp_live_...`) only once you've tested a full test-mode
  payment end to end.

**Anthropic** (console.anthropic.com → API Keys)
- Create a key, put it in `ANTHROPIC_API_KEY`.
- Generation is grounded: the prompt in `src/ai/anthropic.js` explicitly forbids
  inventing facts not present in the user's own profile/answers.

## 3. Deploying and connecting skillnsuccess.com

Full step-by-step (GitHub → Render → GoDaddy DNS) is in **[DEPLOY.md](./DEPLOY.md)**.
Short version: push to GitHub, connect the repo on Render, add two DNS records
in GoDaddy — no nameserver changes needed.

> **Scaling note:** SQLite is fine for MVP/early traffic. When you outgrow a
> single file (roughly hundreds of concurrent users), swap `src/db.js` for
> Postgres — the SQL is plain enough that the migration is mostly mechanical.

## 4. API reference (for your own testing / future mobile app)

```
POST /api/assessment/start           { name, email, source? }              → { assessment_id, user_id, resumed, answers }
POST /api/assessment/:id/answer      { questionIndex, optionIndex }        → { ok: true }
GET  /api/assessment/:id                                                    → { assessment, answers }
POST /api/assessment/:id/complete    { profile? }                          → { overall, dimensionScores, version }
GET  /api/assessment/:id/score                                              → latest score row

POST /api/waitlist                   { email, assessmentId? }             → { ok: true }

POST /api/checkout/create-order      { assessmentId, couponCode? }         → { order_id, razorpay_order_id, amount, currency, key_id }  (503 if payments disabled)
POST /api/checkout/verify            { razorpay_order_id, razorpay_payment_id, razorpay_signature } → { ok: true }
POST /api/checkout/webhook           (raw body, x-razorpay-signature header) → { received: true }

POST /api/generation/:assessmentId/generate                                 → { job_id, status }  (requires active entitlement)
GET  /api/generation/:assessmentId/result                                   → { status, artifact }

GET  /api/dashboard/:assessmentId                                           → { assessment, score, entitlement_active, generation_status }
GET  /api/config                                                            → { paymentsEnabled }
GET  /api/health                                                            → { ok: true }
```

## 5. What's intentionally left as a fast-follow, not a blocker

- Real OTP/email verification (currently email-only)
- Admin panel to view/edit scoring weights and coupons without a redeploy
- Background job queue for generation (currently runs inline — fine until volume grows)
- Postgres migration path for scale
- CV export as downloadable PDF/DOCX files (currently returns structured JSON content)
