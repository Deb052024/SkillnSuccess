const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/:assessmentId', (req, res) => {
  const { assessmentId } = req.params;
  const assessment = db.prepare('SELECT * FROM assessments WHERE assessment_id = ?').get(assessmentId);
  if (!assessment) return res.status(404).json({ error: 'assessment not found' });

  const score = db
    .prepare('SELECT * FROM scores WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(assessmentId);

  const entitlement = db
    .prepare("SELECT * FROM entitlements WHERE user_id = ? AND status = 'ACTIVE'")
    .get(assessment.user_id);

  const job = db
    .prepare('SELECT status, completed_at FROM generation_jobs WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(assessmentId);

  res.json({
    assessment: { status: assessment.status, completed_at: assessment.completed_at },
    score: score
      ? { overall: score.overall, dimensions: JSON.parse(score.dimension_scores), version: score.model_version }
      : null,
    entitlement_active: !!entitlement,
    generation_status: job ? job.status : 'NOT_STARTED',
  });
});

module.exports = router;