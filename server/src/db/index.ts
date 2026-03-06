import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

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
    id                INTEGER PRIMARY KEY CHECK (id = 1),
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
addColumnIfMissing('applicant_profile', 'address_line1',    "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'address_line2',    "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'city',             "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'state_region',     "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'postal_code',      "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'phone_type',       "TEXT NOT NULL DEFAULT 'mobile'");
addColumnIfMissing('applicant_profile', 'phone_secondary',  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'email_secondary',  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'legally_authorized',          "TEXT NOT NULL DEFAULT 'Yes'");
addColumnIfMissing('applicant_profile', 'requires_sponsorship',        "TEXT NOT NULL DEFAULT 'No'");
addColumnIfMissing('applicant_profile', 'work_authorization_country',  "TEXT NOT NULL DEFAULT 'United States'");
addColumnIfMissing('applicant_profile', 'willing_to_relocate',         "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'available_start_date',        "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'referred_by_employee',           "TEXT NOT NULL DEFAULT 'No'");
addColumnIfMissing('applicant_profile', 'referrer_name',                  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'worked_in_edtech',               "TEXT NOT NULL DEFAULT 'No'");
addColumnIfMissing('applicant_profile', 'edtech_employer',                "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'previously_worked_renaissance',  "TEXT NOT NULL DEFAULT 'No'");
addColumnIfMissing('applicant_profile', 'allow_eeo_autofill',      "TEXT NOT NULL DEFAULT '0'");
addColumnIfMissing('applicant_profile', 'eeo_gender',              "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_race_ethnicity',      "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_sexual_orientation',  "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_transgender',         "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_disability',          "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'eeo_veteran',             "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('applicant_profile', 'cover_letter_file_path',  "TEXT");

// ─── Phase 5 — Multi-user migration ──────────────────────────────────────────

// 1. Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 2. Migrate applicant_profile from singleton (CHECK id=1) → per-user
//    Recreates the table without the CHECK constraint and adds user_id UNIQUE.
//    All existing data is preserved; user_id starts as NULL (backfilled below).
{
  const profileCols = db.prepare('PRAGMA table_info(applicant_profile)').all() as Array<{ name: string }>;
  if (!profileCols.some((c) => c.name === 'user_id')) {
    console.log('[db] Migrating applicant_profile for multi-user support…');
    db.exec(`
      CREATE TABLE applicant_profile_new (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id           INTEGER UNIQUE,
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
        updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
        preferred_browser TEXT NOT NULL DEFAULT 'chromium',
        address_line1     TEXT NOT NULL DEFAULT '',
        address_line2     TEXT NOT NULL DEFAULT '',
        city              TEXT NOT NULL DEFAULT '',
        state_region      TEXT NOT NULL DEFAULT '',
        postal_code       TEXT NOT NULL DEFAULT '',
        phone_type        TEXT NOT NULL DEFAULT 'mobile',
        phone_secondary   TEXT NOT NULL DEFAULT '',
        email_secondary   TEXT NOT NULL DEFAULT '',
        legally_authorized          TEXT NOT NULL DEFAULT 'Yes',
        requires_sponsorship        TEXT NOT NULL DEFAULT 'No',
        work_authorization_country  TEXT NOT NULL DEFAULT 'United States',
        willing_to_relocate         TEXT NOT NULL DEFAULT '',
        available_start_date        TEXT NOT NULL DEFAULT '',
        referred_by_employee           TEXT NOT NULL DEFAULT 'No',
        referrer_name                  TEXT NOT NULL DEFAULT '',
        worked_in_edtech               TEXT NOT NULL DEFAULT 'No',
        edtech_employer                TEXT NOT NULL DEFAULT '',
        previously_worked_renaissance  TEXT NOT NULL DEFAULT 'No',
        allow_eeo_autofill      TEXT NOT NULL DEFAULT '0',
        eeo_gender              TEXT NOT NULL DEFAULT '',
        eeo_race_ethnicity      TEXT NOT NULL DEFAULT '',
        eeo_sexual_orientation  TEXT NOT NULL DEFAULT '',
        eeo_transgender         TEXT NOT NULL DEFAULT '',
        eeo_disability          TEXT NOT NULL DEFAULT '',
        eeo_veteran             TEXT NOT NULL DEFAULT '',
        cover_letter_file_path  TEXT
      );
      INSERT INTO applicant_profile_new (
        id, first_name, last_name, preferred_name, email, phone, country,
        linkedin_url, website_url, resume_file_path, resume_text,
        education_json, experience_json, updated_at, preferred_browser,
        address_line1, address_line2, city, state_region, postal_code,
        phone_type, phone_secondary, email_secondary,
        legally_authorized, requires_sponsorship, work_authorization_country,
        willing_to_relocate, available_start_date, referred_by_employee, referrer_name,
        worked_in_edtech, edtech_employer, previously_worked_renaissance, allow_eeo_autofill,
        eeo_gender, eeo_race_ethnicity, eeo_sexual_orientation,
        eeo_transgender, eeo_disability, eeo_veteran, cover_letter_file_path
      )
      SELECT
        id, first_name, last_name, preferred_name, email, phone, country,
        linkedin_url, website_url, resume_file_path, resume_text,
        education_json, experience_json, updated_at, preferred_browser,
        address_line1, address_line2, city, state_region, postal_code,
        phone_type, phone_secondary, email_secondary,
        legally_authorized, requires_sponsorship, work_authorization_country,
        willing_to_relocate, available_start_date, referred_by_employee, referrer_name,
        worked_in_edtech, edtech_employer, previously_worked_renaissance, allow_eeo_autofill,
        eeo_gender, eeo_race_ethnicity, eeo_sexual_orientation,
        eeo_transgender, eeo_disability, eeo_veteran, cover_letter_file_path
      FROM applicant_profile;
      DROP TABLE applicant_profile;
      ALTER TABLE applicant_profile_new RENAME TO applicant_profile;
    `);
    console.log('[db] applicant_profile migration complete.');
  }
}

// 3. Add user_id to apply_sessions
addColumnIfMissing('apply_sessions', 'user_id', 'INTEGER');

// 4. Seed default user and attach any unowned profile row
{
  const username = process.env.DEFAULT_USER_USERNAME ?? 'vivek';
  const password = process.env.DEFAULT_USER_PASSWORD ?? 'chess123';

  let user = db
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
    .get(username) as { id: number } | undefined;

  if (!user) {
    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, hash);
    user = { id: Number(result.lastInsertRowid) };
    console.log(`[db] Created default user '${username}'.`);
  }

  // Attach any unowned profile row to this user (handles existing data)
  db.prepare('UPDATE applicant_profile SET user_id = ? WHERE user_id IS NULL').run(user.id);
}

export default db;
