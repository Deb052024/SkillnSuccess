const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { computeScore, QUESTIONS } = require('../scoring');

const router = express.Router();

function getOrCreateUser({ name, email }) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) return existing;
  const user_id = nanoid();
  db.prepare('INSERT INTO users (user_id, name, email) VALUES (?,?,?)').run(user_id, name || null, email);
  return db.prepare('SELECT * FROM users WHERE user_id = ?').get(user_id);
}

// FR-009 / FR-030: start assessment, detect recent duplicate session for the same identity
router.post('/start', (req, res) => {
  const { name, email, source, campaign } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const user = getOrCreateUser({ name, email });

  const recent = db
    .prepare(
      "SELECT * FROM assessments WHERE user_id = ? AND status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 1"
    )
    .get(user.user_id);
  if (recent) {
    const answers = db
      .prepare('SELECT question_index, option_index FROM assessment_answers WHERE assessment_id = ?')
      .all(recent.assessment_id);
    return res.json({ resumed: true, assessment_id: recent.assessment_id, user_id: user.user_id, answers });
  }

  const assessment_id = nanoid();
  db.prepare(
    'INSERT INTO assessments (assessment_id, user_id, source, campaign) VALUES (?,?,?,?)'
  ).run(assessment_id, user.user_id, source || null, campaign || null);

  res.json({ resumed: false, assessment_id, user_id: user.user_id, answers: [] });
});

// FR-026: persist each answer immediately. FR-027: back navigation just re-submits/overwrites.
router.post('/:id/answer', (req, res) => {
  const { id } = req.params;
  const { questionIndex, optionIndex } = req.body || {};
  const assessment = db.prepare('SELECT * FROM assessments WHERE assessment_id = ?').get(id);
  if (!assessment) return res.status(404).json({ error: 'assessment not found' });
  if (typeof questionIndex !== 'number' || typeof optionIndex !== 'number') {
    return res.status(400).json({ error: 'questionIndex and optionIndex are required numbers' });
  }

  db.prepare(
    `INSERT INTO assessment_answers (assessment_id, question_index, option_index)
     VALUES (?,?,?)
     ON CONFLICT(assessment_id, question_index) DO UPDATE SET option_index = excluded.option_index`
  ).run(id, questionIndex, optionIndex);

  res.json({ ok: true });
});

// FR-025: resume — return saved answers + status
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const assessment = db.prepare('SELECT * FROM assessments WHERE assessment_id = ?').get(id);
  if (!assessment) return res.status(404).json({ error: 'assessment not found' });
  const answers = db
    .prepare('SELECT question_index, option_index FROM assessment_answers WHERE assessment_id = ?')
    .all(id);
  res.json({ assessment, answers });
});

// FR-028 / FR-034-037: complete only when all mandatory questions answered, then score
router.post('/:id/complete', (req, res) => {
  const { id } = req.params;
  const { profile } = req.body || {}; // optional: target_role, target_industry, location, current_status, years_experience, skills_text

  const assessment = db.prepare('SELECT * FROM assessments WHERE assessment_id = ?').get(id);
  if (!assessment) return res.status(404).json({ error: 'assessment not found' });

  const answers = db
    .prepare('SELECT question_index, option_index FROM assessment_answers WHERE assessment_id = ?')
    .all(id);

  if (answers.length < QUESTIONS.length) {
    return res.status(400).json({
      error: 'incomplete',
      answered: answers.length,
      required: QUESTIONS.length,
    });
  }

  const byIndex = {};
  answers.forEach((a) => { byIndex[a.question_index] = a.option_index; });
  const result = computeScore(byIndex);

  db.prepare("UPDATE assessments SET status = 'COMPLETE', completed_at = datetime('now') WHERE assessment_id = ?").run(id);

  const score_id = nanoid();
  db.prepare(
    'INSERT INTO scores (score_id, assessment_id, user_id, overall, dimension_scores, model_version) VALUES (?,?,?,?,?,?)'
  ).run(score_id, id, assessment.user_id, result.overall, JSON.stringify(result.dimensionScores), result.version);

  if (profile) {
    db.prepare(
      `INSERT INTO profiles (user_id, target_role, target_industry, location, current_status, years_experience, skills_text, raw_json)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         target_role=excluded.target_role, target_industry=excluded.target_industry, location=excluded.location,
         current_status=excluded.current_status, years_experience=excluded.years_experience,
         skills_text=excluded.skills_text, raw_json=excluded.raw_json, updated_at=datetime('now')`
    ).run(
      assessment.user_id,
      profile.target_role || null,
      profile.target_industry || null,
      profile.location || null,
      profile.current_status || null,
      profile.years_experience || null,
      profile.skills_text || null,
      JSON.stringify(profile)
    );
  }

  res.json({ overall: result.overall, dimensionScores: result.dimensionScores, version: result.version });
});

router.get('/:id/score', (req, res) => {
  const { id } = req.params;
  const score = db
    .prepare('SELECT * FROM scores WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(id);
  if (!score) return res.status(404).json({ error: 'no score yet' });
  res.json({ ...score, dimension_scores: JSON.parse(score.dimension_scores) });
});

module.exports = router;
