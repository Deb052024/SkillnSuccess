const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

// Simple waitlist capture — stores email for later outreach.
router.post('/join', (req, res) => {
  const { email, name } = req.body || {};
  
  if (!email) return res.status(400).json({ error: 'email is required' });
  
  try {
    const existing = db.prepare('SELECT * FROM waitlist WHERE email = ?').get(email);
    if (existing) {
      return res.status(200).json({ message: 'Already on the waitlist', waitlist_id: existing.waitlist_id });
    }
    
    const waitlist_id = nanoid();
    db.prepare(
      'INSERT INTO waitlist (waitlist_id, email, name) VALUES (?,?,?)'
    ).run(waitlist_id, email, name || null);
    
    res.json({ ok: true, waitlist_id, message: 'Added to waitlist' });
  } catch (err) {
    res.status(500).json({ error: 'failed to join waitlist', detail: err.message });
  }
});

// Check if email is on waitlist
router.get('/:email', (req, res) => {
  const { email } = req.params;
  const entry = db.prepare('SELECT * FROM waitlist WHERE email = ?').get(email);
  res.json({ on_waitlist: !!entry });
});

module.exports = router;
