// Canonical Skill N Success question set + scoring logic.
// Versioned per FR-036 / FR-101: bump SCORE_VERSION whenever weights or
// question mapping change, so historical scores stay reproducible.
const SCORE_VERSION = 'score-v1.0';

// Each question maps to one of 5 dimensions (0-4). 4 options per question,
// scored 0..3 (low..high).
const QUESTIONS = [
  { dim: 0, q: 'How would you rate your hands-on expertise in your core skill area?' },
  { dim: 0, q: 'How recently have you used your top skill in real work?' },
  { dim: 1, q: 'How complete is your LinkedIn / CV story right now?' },
  { dim: 1, q: 'Do you have quantified achievements you can point to?' },
  { dim: 2, q: 'How closely does your experience match the roles you want next?' },
  { dim: 2, q: "How's demand for your target role or industry right now?" },
  { dim: 3, q: 'How active is your job search right now?' },
  { dim: 3, q: "How's your network in your target space?" },
  { dim: 4, q: 'How comfortable are you in interviews?' },
  { dim: 4, q: 'When did you last practice interviewing?' },
];

const DIMENSIONS = [
  'skill_strength',
  'profile_strength',
  'market_fit',
  'opportunity_readiness',
  'interview_readiness',
];

// weights sum to 1 — configurable per FR-036/FR-101; kept in code for MVP,
// move to an admin-editable config table before scaling.
const WEIGHTS = [0.25, 0.2, 0.2, 0.15, 0.2];

function computeScore(answersByQuestionIndex) {
  const dimSums = [0, 0, 0, 0, 0];
  const dimCounts = [0, 0, 0, 0, 0];

  QUESTIONS.forEach((item, i) => {
    const raw = answersByQuestionIndex[i];
    const v = typeof raw === 'number' ? Math.min(3, Math.max(0, raw)) : 1;
    dimSums[item.dim] += v;
    dimCounts[item.dim] += 1;
  });

  const dimensionScores = {};
  let weightedSum = 0;
  DIMENSIONS.forEach((key, i) => {
    const pct = Math.round((dimSums[i] / (dimCounts[i] || 1) / 3) * 100);
    dimensionScores[key] = pct;
    weightedSum += pct * WEIGHTS[i];
  });

  return {
    overall: Math.round(weightedSum),
    dimensionScores,
    version: SCORE_VERSION,
  };
}

module.exports = { QUESTIONS, DIMENSIONS, computeScore, SCORE_VERSION };
