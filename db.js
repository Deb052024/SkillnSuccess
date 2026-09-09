const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbFile = process.env.DATABASE_FILE || './data/skillnsuccess.db';
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

// --- Schema (subset of the FRD's Section 8 data model, MVP scope) ---
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assessments (
  assessment_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS | COMPLETE
  version TEXT NOT NULL DEFAULT 'v1.0',
  source TEXT,
  campaign TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS assessment_answers (
  assessment_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assessment_id, question_index)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  target_role TEXT,
  target_industry TEXT,
  location TEXT,
  current_status TEXT,
  years_experience TEXT,
  skills_text TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  score_id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  overall INTEGER NOT NULL,
  dimension_scores TEXT NOT NULL, -- JSON
  model_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,          -- our internal id
  razorpay_order_id TEXT,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED | PAID | FAILED
  provider_reference TEXT,
  coupon_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entitlements (
  entitlement_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT 'success_plan',
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | REVOKED
  activated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSING | COMPLETED | FAILED
  artifact_json TEXT,
  error_message TEXT,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id TEXT PRIMARY KEY,
  actor TEXT,
  action TEXT,
  target TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
