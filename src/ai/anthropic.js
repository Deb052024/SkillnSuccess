const fetch = require('node-fetch');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const GROUNDING_RULES = `
You are the AI Success Plan generator for Skill N Success.
Hard rules (never break these — they are product safety requirements, not style preferences):
1. Only use facts the user actually provided in their profile/answers below. Never invent employers,
   titles, dates, certifications, achievements, or numbers.
2. If something useful is missing (e.g. a quantified achievement), leave an explicit editable
   placeholder like "[Add a specific number or result here]" — do not fabricate one.
3. Never promise a hiring outcome, guaranteed salary, or guaranteed interview result. Use
   qualified, probabilistic language.
4. Output must be valid JSON only, matching the exact schema requested — no prose outside the JSON.
`;

async function callClaude(prompt, maxTokens = 4000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text content returned from Anthropic API');

  const cleaned = textBlock.text.trim().replace(/^```json/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

// Generates the full Success Plan artifact set in one grounded call.
// `profile` should contain only what the user actually submitted.
async function generateSuccessPlan(profile, score) {
  const prompt = `${GROUNDING_RULES}

USER PROFILE (only source of facts — do not add anything not present here):
${JSON.stringify(profile, null, 2)}

SKILL N SUCCESS SCORE:
${JSON.stringify(score, null, 2)}

Generate a JSON object with exactly these keys:
{
  "cv_variants": [ { "variant_name": string, "summary": string, "sections": { "experience": string, "skills": string, "education": string } } ]  // exactly 5 items, grounded only in profile
  "skill_gap_report": { "current_strengths": [string], "priority_gaps": [ { "skill": string, "why_it_matters": string, "recommended_action": string } ] },
  "role_recommendations": [ { "role": string, "fit_rationale": string, "key_strengths": [string], "key_gaps": [string] } ],  // 3-5 items
  "linkedin_guidance": { "headline": string, "about_section": string, "keywords": [string] },
  "interview_questions": [ { "question": string, "answer_framework": string } ],  // at least 20 items
  "action_plan_30_day": [ { "week": number, "goal": string, "tasks": [string] } ]  // 4 items, one per week
}
Return ONLY the JSON object, nothing else.`;

  return callClaude(prompt, 4096);
}

module.exports = { generateSuccessPlan };