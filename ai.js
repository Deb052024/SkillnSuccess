const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { generateSuccessPlan } = require('../ai/anthropic');

const router = express.Router();

function hasActiveEntitlement(userId) {
  return !!db
    .prepare("SELECT 1 FROM entitlements WHERE user_id = ? AND status = 'ACTIVE'")
    .get(userId);
}

// Called by checkout.js right after a payment is confirmed (order verify or webhook).
// Runs inline for MVP simplicity; swap for a real job queue (BullMQ/Cloud Tasks) once
// volume justifies it — the DB row already models PENDING/PROCESSING/COMPLETED/FAILED.
async function queueGeneration(userId, assessmentId) {
  const job_id = nanoid();
  db.prepare(
    'INSERT INTO generation_jobs (job_id, user_id, assessment_id, status) VALUES (?,?,?,?)'
  ).run(job_id, userId, assessmentId, 'PENDING');

  try {
    db.prepare("UPDATE generation_jobs SET status = 'PROCESSING' WHERE job_id = ?").run(job_id);

    const profileRow = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
    const scoreRow = db
      .prepare('SELECT * FROM scores WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(assessmentId);

    const profile = profileRow ? JSON.parse(profileRow.raw_json) : {};
    const score = scoreRow
      ? { overall: scoreRow.overall, dimensions: JSON.parse(scoreRow.dimension_scores) }
      : {};

    const artifact = await generateSuccessPlan(profile, score);

    db.prepare(
      "UPDATE generation_jobs SET status = 'COMPLETED', artifact_json = ?, model_version = ?, completed_at = datetime('now') WHERE job_id = ?"
    ).run(JSON.stringify(artifact), process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', job_id);
  } catch (err) {
    db.prepare(
      "UPDATE generation_jobs SET status = 'FAILED', error_message = ? WHERE job_id = ?"
    ).run(err.message, job_id);
  }

  return job_id;
}

// Manual retry/trigger endpoint — entitlement-gated per FR-050/FR-070.
router.post('/:assessmentId/generate', async (req, res) => {
  const { assessmentId } = req.params;
  const assessment = db.prepare('SELECT * FROM assessments WHERE assessment_id = ?').get(assessmentId);
  if (!assessment) return res.status(404).json({ error: 'assessment not found' });
  if (!hasActiveEntitlement(assessment.user_id)) {
    return res.status(402).json({ error: 'no active entitlement — purchase the Success Plan first' });
  }

  const job_id = await queueGeneration(assessment.user_id, assessmentId);
  const job = db.prepare('SELECT status, error_message FROM generation_jobs WHERE job_id = ?').get(job_id);
  res.json({ job_id, ...job });
});

router.get('/:assessmentId/result', (req, res) => {
  const { assessmentId } = req.params;
  const job = db
    .prepare('SELECT * FROM generation_jobs WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(assessmentId);
  if (!job) return res.status(404).json({ error: 'no generation job yet' });
  res.json({
    status: job.status,
    error_message: job.error_message,
    artifact: job.artifact_json ? JSON.parse(job.artifact_json) : null,
  });
});

module.exports = router;
module.exports.queueGeneration = queueGeneration;
