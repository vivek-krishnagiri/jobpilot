import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'jobs.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// WAL mode and foreign keys via PRAGMA
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS job_postings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source          TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    company         TEXT NOT NULL,
    title           TEXT NOT NULL,
    location        TEXT NOT NULL DEFAULT '',
    work_model      TEXT NOT NULL DEFAULT 'Remote',
    posted_at       TEXT,
    first_seen_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
    active_flag     INTEGER NOT NULL DEFAULT 1,
    applied_flag    INTEGER NOT NULL DEFAULT 0,
    applied_at      TEXT,
    notes           TEXT
  );

  CREATE TABLE IF NOT EXISTS sources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    type        TEXT NOT NULL DEFAULT 'github_readme',
    config_json TEXT NOT NULL DEFAULT '{}',
    enabled     INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sync_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    status      TEXT NOT NULL DEFAULT 'running',
    totals_json TEXT,
    error_msg   TEXT
  );

  CREATE TABLE IF NOT EXISTS applicant_profile (
    id                INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
    first_name        TEXT NOT NULL DEFAULT '',
    last_name         TEXT NOT NULL DEFAULT '',
    preferred_name    TEXT NOT NULL DEFAULT '',
    email             TEXT NOT NULL DEFAULT '',
    phone             TEXT NOT NULL DEFAULT '',
    country           TEXT NOT NULL DEFAULT '',
    linkedin_url      TEXT NOT NULL DEFAULT '',
    website_url       TEXT NOT NULL DEFAULT '',
    resume_file_path  TEXT,
    resume_text       TEXT,
    education_json    TEXT NOT NULL DEFAULT '[]',
    experience_json   TEXT NOT NULL DEFAULT '[]',
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS apply_sessions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id                INTEGER NOT NULL REFERENCES job_postings(id),
    job_url               TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'created',
    -- status: created | opening | form_detected | filling | filled | error | closed
    detected_fields_json  TEXT,
    fill_result_json      TEXT,
    error_msg             TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Column migrations (idempotent — safe to run on existing DBs) ─────────────

function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing('applicant_profile', 'preferred_browser', "TEXT NOT NULL DEFAULT 'chromium'");
addColumnIfMissing('apply_sessions', 'browser', "TEXT NOT NULL DEFAULT 'chromium'");

// Phase 3.7 — Expanded profile columns
// Contact / Address
addColumnIfMissing('applicant_profile', 'address_line1',    "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'address_line2',    "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'city',             "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'state_region',     "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'postal_code',      "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'phone_type',       "TEXT NOT NULL DEFAULT 'mobile'");
addColumnIfMissing('applicant_profile', 'phone_secondary',  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'email_secondary',  "TEXT NOT NULL DEFAULT ''");
// Work authorization
addColumnIfMissing('applicant_profile', 'legally_authorized',          "TEXT NOT NULL DEFAULT 'Yes'");
addColumnIfMissing('applicant_profile', 'requires_sponsorship',        "TEXT NOT NULL DEFAULT 'No'");
addColumnIfMissing('applicant_profile', 'work_authorization_country',  "TEXT NOT NULL DEFAULT 'United States'");
addColumnIfMissing('applicant_profile', 'willing_to_relocate',         "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'available_start_date',        "TEXT NOT NULL DEFAULT ''");
// Referral / history
addColumnIfMissing('applicant_profile', 'referred_by_employee',           "TEXT NOT NULL DEFAULT 'No'");
addColumnIfMissing('applicant_profile', 'referrer_name',                  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'worked_in_edtech',               "TEXT NOT NULL DEFAULT 'No'");
addColumnIfMissing('applicant_profile', 'edtech_employer',                "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'previously_worked_renaissance',  "TEXT NOT NULL DEFAULT 'No'");
// EEO (opt-in)
addColumnIfMissing('applicant_profile', 'allow_eeo_autofill',      "TEXT NOT NULL DEFAULT '0'");
addColumnIfMissing('applicant_profile', 'eeo_gender',              "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_race_ethnicity',      "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_sexual_orientation',  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_transgender',         "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_disability',          "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_veteran',             "TEXT NOT NULL DEFAULT ''");
// Documents
addColumnIfMissing('applicant_profile', 'cover_letter_file_path',  "TEXT");

export default db;
