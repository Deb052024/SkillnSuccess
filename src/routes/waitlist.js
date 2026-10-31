const express = require('express');
const fetch = require('node-fetch');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

// Render's free plan has no persistent disk, so the SQLite file can be wiped on any
// redeploy or restart. Every sign-up is therefore also sent to a Google Sheet through a
// Google Apps Script web app (see docs/leads-google-sheet.md). The script appends a row
// and emails the owner. Set LEADS_WEBHOOK_URL on Render to the web app's /exec URL.
const LEADS_WEBHOOK_URL = /^https:\/\//i.test(process.env.LEADS_WEBHOOK_URL || '')
  ? process.env.LEADS_WEBHOOK_URL.trim()
  : '';
const LEADS_WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

async function forwardLead(lead) {
  if (!LEADS_WEBHOOK_URL) return false;
  try {
    const r = await fetch(LEADS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, secret: LEADS_WEBHOOK_SECRET }),
      timeout: 8000,
    });
    if (!r.ok) console.error('[leads] webhook responded', r.status);
    return r.ok;
  } catch (err) {
    console.error('[leads] webhook failed:', err.message);
    return false;
  }
}

// Waitlist capture. `name` is used by the pages as the product/source tag
// (e.g. "rooted-rising", "dealer-playbook").
router.post('/join', async (req, res) => {
  const body = req.body || {};
  const email = clip(body.email, 254).toLowerCase();
  const product = clip(body.name, 80);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'a valid email is required' });
  }

  const lead = {
    email,
    product,
    page: clip(body.page, 300),
    utm_source: clip(body.utm_source, 100),
    utm_medium: clip(body.utm_medium, 100),
    utm_campaign: clip(body.utm_campaign, 100),
    utm_content: clip(body.utm_content, 200),
    created_at: new Date().toISOString(),
  };

  let saved = false;
  let waitlist_id = null;
  let already = false;
  try {
    const existing = db.prepare('SELECT * FROM waitlist WHERE email = ?').get(email);
    if (existing) {
      already = true;
      waitlist_id = existing.waitlist_id;
    } else {
      waitlist_id = nanoid();
      db.prepare('INSERT INTO waitlist (waitlist_id, email, name) VALUES (?,?,?)').run(waitlist_id, email, product || null);
    }
    saved = true;
  } catch (err) {
    console.error('[leads] sqlite save failed:', err.message);
  }

  // Always forward, even for an email already on file: the same person may be
  // signing up for a different book, and the sheet is the durable record.
  const forwarded = await forwardLead(lead);

  if (!saved && !forwarded) {
    return res.status(500).json({ error: 'failed to join waitlist' });
  }
  res.json({ ok: true, waitlist_id, message: already ? 'Already on the waitlist' : 'Added to waitlist' });
});

// Backup export of what is in the local database: /api/waitlist/export?key=ADMIN_KEY
router.get('/export', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(404).end();
  const rows = db.prepare('SELECT email, name AS product, created_at FROM waitlist ORDER BY created_at DESC').all();
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = ['email,product,created_at', ...rows.map((r) => [r.email, r.product, r.created_at].map(esc).join(','))].join('\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="waitlist.csv"');
  res.send(csv);
});

module.exports = router;
