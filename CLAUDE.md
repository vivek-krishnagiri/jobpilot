# CLAUDE.md — Architecture & Implementation Reference

> Canonical architecture reference. Update every time you create, modify, or delete project files.

---

## Project Overview

**JobPilot** — personal job application automation system.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Job discovery dashboard (browse, filter, track) |
| Phase 2 | ✅ Complete | Real job ingestion from GitHub README boards |
| Phase 3 | ✅ Complete | Applicant profile + browser autofill via Playwright runner |
| Phase 3.5 | ✅ Complete | Form watcher (SPA detection) + browser selection (chromium/chrome/msedge/webkit) |
| Phase 3.7 | ✅ Complete | Expanded profile (25 new fields) + yes/no dropdown autofill + EEO opt-in + cover letter |
| Phase 4 | Planned | Smart matching, scoring, alerts |

---

## High-Level Architecture (Phase 3)

```
Browser (React)
   │  /api/*  (Vite proxy)
   ▼
Server (Fastify :3001)
   │  profile routes, apply routes, job routes, sync routes
   │  node:sqlite  →  server/data/jobs.db
   │
   │  HTTP calls to http://localhost:3002
   ▼
Runner (Playwright :3002)
   │  headful Chromium — opens job URL, detects form, fills fields
   └─ sessions Map<id, { page, status, detectedFields, fillResult }>
```

---

## Repository Structure

```
Job Application Automation/
├── package.json              # Root: dev/build scripts, concurrently (3 procs)
├── pnpm-workspace.yaml       # Workspaces: client, server, runner
├── .gitignore
├── CLAUDE.md                 # ← You are here
├── README.md
│
├── client/                   # React + Vite + Tailwind frontend
│   └── src/
│       ├── types/index.ts    # JobPosting, ApplicantProfile, ApplySession, FillResult
│       ├── api/
│       │   ├── jobs.ts       # fetchJobs, markApplied, updateJob
│       │   ├── sync.ts       # triggerSync, fetchSyncStatus
│       │   ├── profile.ts    # fetchProfile, saveProfile, uploadResume
│       │   └── apply.ts      # startApplySession, fetchApplySession, triggerAutofill
│       ├── hooks/
│       │   ├── useJobs.ts
│       │   └── useDebounce.ts
│       ├── utils/date.ts
│       ├── components/
│       │   ├── Layout.tsx        # Sidebar nav
│       │   ├── FilterPanel.tsx   # Browse filters
│       │   ├── JobTable.tsx      # Job rows + Apply button → ApplyModal
│       │   ├── ApplyModal.tsx    # Session status + Autofill button + fill results
│       │   └── EmptyState.tsx
│       └── pages/
│           ├── BrowseJobs.tsx    # Sync Jobs button, toast, filter panel
│           ├── CurrentJobs.tsx   # Applied jobs + notes
│           └── Settings.tsx      # My Profile (editable, resume upload) + sources
│
├── server/                   # Fastify + node:sqlite backend
│   └── src/
│       ├── index.ts          # Register: cors, multipart, all routes
│       ├── db/index.ts       # Schema: job_postings, sources, sync_runs,
│       │                     #         applicant_profile, apply_sessions
│       ├── routes/
│       │   ├── jobs.ts       # /api/jobs CRUD
│       │   ├── sync.ts       # /api/sync POST+status
│       │   ├── profile.ts    # /api/profile GET/PUT/resume
│       │   └── apply.ts      # /api/apply/session CRUD + autofill
│       ├── seed.ts           # Legacy mock seed (NOT called — kept for reference)
│       └── sync/
│           ├── types.ts
│           ├── urlUtils.ts
│           ├── dateUtils.ts
│           ├── markdownParser.ts   # parseMarkdownTables, parseHtmlTables, helpers
│           ├── syncEngine.ts
│           └── adapters/GitHubReadmeAdapter.ts
│
└── runner/                   # Playwright automation service
    ├── package.json          # playwright, fastify, tsx
    ├── tsconfig.json         # lib: ES2020 + DOM (needed for page.evaluate types)
    └── src/
        ├── index.ts          # Fastify HTTP server on :3002
        ├── session.ts        # openSession, getSession, fillSession, closeSession
        └── autofill.ts       # detectFields, fillFields, FIELD_PATTERNS
```

---

## Architecture Decisions

### Monorepo
- 3 pnpm workspaces: `client`, `server`, `runner`
- `pnpm dev` uses `concurrently` to start all three simultaneously

### Backend
- Node.js 23+, TypeScript (CommonJS, tsx watch)
- Fastify v4 + `@fastify/cors` + `@fastify/multipart`
- **`node:sqlite` (DatabaseSync)** — built-in, no native compilation (unlike better-sqlite3 which breaks on Node 23)
  - Returns `BigInt` for `lastInsertRowid`/`changes` → always wrap with `Number()`
  - `.get()/.all()` return `Record<string, SQLOutputValue>` → cast via `as unknown as T`
  - No `.transaction()` — use `db.exec('BEGIN')` / `db.exec('COMMIT')`
- Resume parsing: `pdf-parse` (PDF) + `mammoth` (DOCX) — CommonJS; use `require()` or dynamic `import()`
- Data dir: `server/data/` (git-ignored); resumes in `server/data/resumes/`

### Runner
- Playwright — headful, visible browser (never headless)
- **Browser pool:** `Map<string, Browser>` keyed by type (`'chromium' | 'chrome' | 'msedge' | 'webkit'`); Chrome/Edge use `chromium.launch({ channel })`, WebKit uses `webkit.launch()`
- Sessions stored in-memory `Map<number, SessionState>` (includes `browser`, `lastUpdated` fields)
- Runner's tsconfig includes `"DOM"` in lib (needed for `page.evaluate()` callback types)
- CSS attribute selectors use a local `cssAttr()` escape helper (not `CSS.escape` which is browser-only)
- `autofill.ts` functions accept `Page | Frame` so field detection works on iframes

### Frontend
- React 18 + Vite 5 + Tailwind CSS 3
- React Router v6, local `useState` (no global store)
- Native `fetch` proxied via Vite → `:3001`
- ApplyModal polls `GET /api/apply/session/:id` every 2s while status is transient

---

## Data Model

### `applicant_profile` (singleton: id = 1)
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Always 1 — singleton row |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `preferred_name` | TEXT | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `country` | TEXT | |
| `linkedin_url` | TEXT | |
| `website_url` | TEXT | |
| `resume_file_path` | TEXT nullable | Absolute path to saved file |
| `resume_text` | TEXT nullable | Extracted plain text from resume |
| `education_json` | TEXT | JSON array of `{school, degree, field_of_study, start_year, end_year}` |
| `experience_json` | TEXT | JSON array of `{company, title, start_month, start_year, end_month, end_year, current}` |
| `preferred_browser` | TEXT | `'chromium'` (default) / `'chrome'` / `'msedge'` / `'webkit'` |
| `updated_at` | TEXT | ISO timestamp |
| `address_line1/2` | TEXT | Street address fields |
| `city, state_region, postal_code` | TEXT | Address components |
| `phone_type` | TEXT | `'mobile'` / `'home'` / `'work'` |
| `phone_secondary, email_secondary` | TEXT | Alternate contact |
| `legally_authorized` | TEXT | `'Yes'` / `'No'` (default `'Yes'`) |
| `requires_sponsorship` | TEXT | `'Yes'` / `'No'` (default `'No'`) |
| `work_authorization_country` | TEXT | Default `'United States'` |
| `willing_to_relocate` | TEXT | `'Yes'` / `'No'` / `''` |
| `available_start_date` | TEXT | ISO date string |
| `referred_by_employee` | TEXT | `'Yes'` / `'No'` (default `'No'`) |
| `referrer_name` | TEXT | |
| `worked_in_edtech` | TEXT | `'Yes'` / `'No'` (default `'No'`) |
| `edtech_employer` | TEXT | |
| `previously_worked_renaissance` | TEXT | `'Yes'` / `'No'` (default `'No'`) |
| `allow_eeo_autofill` | TEXT | `'0'` (disabled, default) / `'1'` (enabled) |
| `eeo_gender` | TEXT | EEO self-ID — only filled if opt-in enabled |
| `eeo_race_ethnicity` | TEXT | |
| `eeo_sexual_orientation` | TEXT | |
| `eeo_transgender` | TEXT | |
| `eeo_disability` | TEXT | |
| `eeo_veteran` | TEXT | |
| `cover_letter_file_path` | TEXT nullable | Absolute path to saved cover letter |

### `apply_sessions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `job_id` | INTEGER | FK → job_postings.id |
| `job_url` | TEXT | URL passed to runner |
| `status` | TEXT | `created→opening→open→form_detected→filling→filled` or `error/closed` |
| `browser` | TEXT | Browser used (`chromium` / `chrome` / `msedge` / `webkit`) |
| `detected_fields_json` | TEXT nullable | JSON array of field labels found by runner |
| `fill_result_json` | TEXT nullable | `{ filled[], skipped[], total }` |
| `error_msg` | TEXT nullable | Error message if status=error |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `job_postings`, `sync_runs`, `sources` — unchanged from Phase 2.

---

## API Endpoints

### Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Returns singleton profile (auto-creates if missing) |
| PUT | `/api/profile` | Update profile fields (all 35+ fields accepted) |
| POST | `/api/profile/resume` | Multipart (.pdf/.doc/.docx); extracts text + fields (doesn't overwrite non-empty) |
| POST | `/api/profile/cover-letter` | Multipart (.pdf/.doc/.docx/.txt); saves file path only |

### Apply Sessions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/apply/session` | Body: `{jobId}`. Creates session, fires runner to open URL. Returns session |
| GET | `/api/apply/session/:id` | Poll status; proxies runner for latest state |
| POST | `/api/apply/session/:id/autofill` | Loads profile, calls runner `/fill`, returns FillResult |

### Jobs (unchanged)
`GET /api/jobs`, `POST /api/jobs`, `POST /api/jobs/:id/mark-applied`, `PATCH /api/jobs/:id`

### Sync (unchanged)
`POST /api/sync`, `GET /api/sync/status`

---

## Runner API (internal, port 3002)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ status: 'ok', port: 3002 }` |
| POST | `/sessions` | Body: `{sessionId, url}`. Opens browser tab async. Returns 202 |
| GET | `/sessions/:id` | Returns session status + detected fields |
| POST | `/sessions/:id/fill` | Body: `{profile}`. Fills form. Returns `{filled[], skipped[], total}` |
| DELETE | `/sessions/:id` | Closes browser tab |

---

## Autofill Heuristics (`runner/src/autofill.ts`)

Field matching priority for each `<input>/<select>/<textarea>`:
1. **Label text** (`<label for="...">`) — substring match (case-insensitive)
2. **`aria-label`** attribute — substring match
3. **`name` / `id` / `autocomplete`** attributes — substring match

Field matching priority per input: label text → aria-label → name/id/autocomplete attrs.

Pattern categories (in priority order):
1. **`FIELD_PATTERNS`** — core profile fields (name, email, phone, address, LinkedIn, etc.) + education/employment virtual keys
2. **`BOOLEAN_PATTERNS`** — yes/no fields (sponsorship, authorization, referral, edtech, renaissance, relocation)
3. **`EEO_PATTERNS`** — demographic fields (gender, race, veteran, disability, orientation, transgender)

### Select filling strategies
- **`fillSelectYesNo(locator, 'Yes'|'No')`** — scores each option against yes/no variants; picks highest scorer
- **`fillSelectSmart(locator, desiredText)`** — normalizes option text, scores exact(100) / starts-with(80) / contains(60) / reverse-starts-with(50)

### EEO opt-in guard
EEO fields are skipped unless `profile.allow_eeo_autofill === '1'`. Reason shown in skipped results.

### Virtual keys (resolved at fill time)
| Virtual key | Resolved from |
|-------------|---------------|
| `exp_company` | `experience_json[0].company` |
| `exp_title` | `experience_json[0].title` |
| `edu_school` | `education_json[0].school` |
| `edu_degree` | `education_json[0].degree` |
| `edu_field` | `education_json[0].field_of_study` |

### Cover letter vs resume file detection
File inputs labeled with "cover letter" or attrs containing "cover"/"coverletter" → `cover_letter_file_path`. All others → `resume_file_path`.

Skipped automatically: checkboxes, radios, unmapped fields, fields with no profile value, EEO fields when opt-in is off.

**NEVER clicks Submit.** Injects a visible overlay badge when autofill completes.

### Known Limitations
- SPA forms that render dynamically after user interaction (Workday, Greenhouse) may show 0 fields on first page load — the user needs to navigate to the application form page first
- Shadow DOM inputs not supported
- CAPTCHA / auth-gated forms will not be detected
- `country` select options vary by site; matching may fail if option values differ from profile text

---

## Running the Project

```bash
pnpm install
pnpm --filter runner exec playwright install chromium   # one-time browser download
pnpm dev          # starts server (:3001) + client (:5173) + runner (:3002)
```

### Individual workspaces
```bash
pnpm --filter server dev
pnpm --filter client dev
pnpm --filter runner dev
```

---

## Ports
| Service | Port |
|---------|------|
| Client (Vite dev) | 5173 |
| Server (Fastify) | 3001 |
| Runner (Playwright) | 3002 |
| Client → API proxy | `/api/*` → `localhost:3001` |

---

## Phase 3.5 Architecture

### Form Watcher (`runner/src/session.ts` — `watchForForm()`)

After initial page load, if a form is not immediately detected, a background watcher starts:

1. **MutationObserver injection** — `window.__jp_dom_changed` flag is set by an observer watching `document.documentElement`; reset after each read
2. **Navigation events** — `page.on('framenavigated')` and `page.on('domcontentloaded')` set a `navOccurred` flag
3. **1-second polling loop** — checks URL change, `__jp_dom_changed` flag, and `navOccurred`; if any changed, re-runs field detection
4. **Iframe support** — `detectFieldsAllFrames()` iterates `page.frames()` (1 level deep), calls `detectFields()` on each, and merges results deduped by selector
5. **Throttle guard** — `checkInProgress` boolean prevents concurrent checks within the same interval tick
6. **Auto-stop** — interval clears when status reaches `form_detected | filled | error | closed`

Detection threshold: **≥ 2 non-file fields** → `form_detected`.

### Browser Pool (`runner/src/session.ts` — `getBrowser()`)

`Map<string, Browser>` keyed by browser type. Browsers are reused across sessions of the same type. Launch rules:

| Type | Launch |
|------|--------|
| `chromium` | `chromium.launch({ headless: false })` |
| `chrome` | `chromium.launch({ channel: 'chrome', headless: false })` |
| `msedge` | `chromium.launch({ channel: 'msedge', headless: false })` |
| `webkit` | `webkit.launch({ headless: false })` |

### SPA Detection Flow

```
openSession() → page.goto() → initial detectFields()
    ↓ form found?
    YES → status=form_detected, banner injected
    NO  → status=open, watchForForm() starts (background)
              ↓ every 1s
              DOM changed / URL changed / nav occurred?
              YES → detectFieldsAllFrames()
                    ≥2 fields? → status=form_detected, watcher stops
```

### DB Column Migrations

`addColumnIfMissing()` in `server/src/db/index.ts` uses `PRAGMA table_info()` to check column existence before `ALTER TABLE`. Safe to run on both new and existing databases.

---

## Phase 3.7 Architecture

### Profile Expansion

25 new columns added via `addColumnIfMissing()` — all idempotent. The `PUT /api/profile` `allowed` array was expanded to include all new fields. Resume upload no longer overwrites non-empty profile fields (checks existing value before applying extracted value).

### Dropdown Autofill Strategy (`runner/src/autofill.ts`)

`fillFields()` routing logic per field:
1. `profileKey === null` → skip (unmapped)
2. `EEO_KEYS.has(key)` AND `allow_eeo_autofill !== '1'` → skip with reason
3. Resolve value: virtual keys → parse JSON arrays; regular keys → `profile[key]`
4. No value → skip
5. `type === 'file'` → `setInputFiles()`
6. `type === 'checkbox'|'radio'` → skip
7. `type === 'select'` AND `BOOLEAN_KEYS.has(key)` → `fillSelectYesNo()`
8. `type === 'select'` → `fillSelectSmart()`
9. Default → `locator.fill()`

### Settings UI Accordion

`AccordionSection` component wraps collapsible sections. `SelectField` renders a `<select>` with consistent styling. Experience/Education list editors manage `ExpItem[]`/`EduItem[]` state separately; serialized to JSON on save.

### `api/profile.ts`
`uploadCoverLetter(file)` — POST to `/api/profile/cover-letter`, returns `{ profile }` (no text extraction).

---

## File Change Log

| Date | Change |
|------|--------|
| 2026-03-03 | Phase 1: monorepo scaffold, Fastify+SQLite server, React+Vite+Tailwind client, 25 mock jobs, filter/sort dashboard |
| 2026-03-03 | Phase 2: Real job ingestion — sync engine, GitHub README adapters (HTML+markdown), POST /api/sync, Sync Jobs UI |
| 2026-03-04 | Phase 3: Applicant profile + browser autofill — runner package (Playwright), /api/profile, /api/apply/session, My Profile UI in Settings, Apply button + modal in JobTable |
| 2026-03-04 | Phase 3.5: Form watcher (MutationObserver + SPA nav detection + iframe merge) + browser selection (chromium/chrome/msedge/webkit) + preferred_browser profile field |
| 2026-03-04 | Phase 3.7: 25 new profile columns (address/work-auth/referral/EEO/cover-letter) + BOOLEAN_PATTERNS + EEO_PATTERNS + fillSelectSmart/fillSelectYesNo + virtual exp/edu keys + Settings accordion UI + ApplyModal dropdown hint |
