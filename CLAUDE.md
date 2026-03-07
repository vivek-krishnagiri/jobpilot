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
| Phase 4.1 | ✅ Complete | Workday multi-step autofill + ARIA combobox/radio support + field fingerprinting |
| Phase 5 | ✅ Complete | Multi-user auth (login/signup, per-user profiles, cookie sessions, route protection) |
| Phase 4.2 | ✅ Complete | CSS selector bug fix, `full_name` virtual key, `normalizeLabel`, `draftNeeded`, post-apply confirmation |
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
   └─ sessions Map<id, { page, status, detectedFields, fillResult, lastFillFingerprint, stepCount }>
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
│       │   ├── client.ts     # Shared apiFetch wrapper (credentials: 'include')
│       │   ├── auth.ts       # login, signup, logout, getMe
│       │   ├── jobs.ts       # fetchJobs, markApplied, updateJob
│       │   ├── sync.ts       # triggerSync, fetchSyncStatus
│       │   ├── profile.ts    # fetchProfile, saveProfile, uploadResume, uploadCoverLetter
│       │   └── apply.ts      # startApplySession, fetchApplySession, triggerAutofill
│       ├── contexts/
│       │   └── AuthContext.tsx  # AuthProvider + useAuth hook (user, isLoading, logout)
│       ├── hooks/
│       │   ├── useJobs.ts
│       │   └── useDebounce.ts
│       ├── utils/date.ts
│       ├── components/
│       │   ├── Layout.tsx        # Sidebar nav + user avatar + logout button
│       │   ├── FilterPanel.tsx   # Browse filters
│       │   ├── JobTable.tsx      # Job rows + Apply button → ApplyModal
│       │   ├── ApplyModal.tsx    # Session status + Autofill button + fill results
│       │   └── EmptyState.tsx
│       └── pages/
│           ├── LoginPage.tsx     # Login / Sign Up tabs, "Get hired soon!!" heading
│           ├── BrowseJobs.tsx    # Sync Jobs button, toast, filter panel
│           ├── CurrentJobs.tsx   # Applied jobs + notes
│           └── Settings.tsx      # My Profile (editable, resume upload) + sources
│
├── server/                   # Fastify + node:sqlite backend
│   └── src/
│       ├── index.ts          # Register: cors (credentials:true), multipart, global auth hook, all routes
│       ├── auth/
│       │   ├── session.ts    # In-memory session store (Map<token,{userId,username,expiresAt}>)
│       │   └── middleware.ts # FastifyRequest.user augmentation + requireAuth preHandler + populateUser
│       ├── db/index.ts       # Schema: job_postings, sources, sync_runs,
│       │                     #         users, applicant_profile (per-user), apply_sessions
│       ├── routes/
│       │   ├── auth.ts       # /api/auth/login, signup, logout, me
│       │   ├── jobs.ts       # /api/jobs CRUD
│       │   ├── sync.ts       # /api/sync POST+status
│       │   ├── profile.ts    # /api/profile GET/PUT/resume (requireAuth, user_id scoped)
│       │   └── apply.ts      # /api/apply/session CRUD + autofill (requireAuth, user_id scoped)
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
        └── autofill.ts       # detectFields, detectCustomFields, fillFields, FIELD_PATTERNS
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

### Authentication (Phase 5)
- **Password hashing:** `bcryptjs` (pure-JS, no native compilation) — cost factor 10
- **Session store:** in-memory `Map<token, {userId, username, expiresAt}>` with 7-day TTL — resets on server restart (acceptable for local-first tool)
- **Cookie:** `jp_session`, `HttpOnly`, `SameSite=Lax`, `Max-Age=604800` (7 days)
- **Cookie parsing:** manual from `request.headers.cookie` (no @fastify/cookie needed)
- **CORS:** `credentials: true` + explicit origin list (`localhost:5173`) — required for cross-origin cookies
- **TypeScript:** `declare module 'fastify' { interface FastifyRequest { user? } }` in middleware.ts
- **Global hook:** `fastify.addHook('preHandler', ...)` runs `populateUser()` on every request before route handlers
- **requireAuth:** Fastify `preHandler` function — returns 401 if `request.user` not set; added to every profile/apply route
- **Multi-user migration:** `applicant_profile` was a singleton (CHECK id=1); Phase 5 recreates it via rename/copy/drop dance to add `user_id UNIQUE` without the CHECK constraint — all existing data preserved
- **Default user:** seeded from `DEFAULT_USER_USERNAME` / `DEFAULT_USER_PASSWORD` env vars (defaults: vivek/chess123); existing profile row attached via `UPDATE ... WHERE user_id IS NULL`

### Frontend
- React 18 + Vite 5 + Tailwind CSS 3
- React Router v6, local `useState` (no global store)
- `AuthContext` + `useAuth` hook wraps the entire app; `RequireAuth` component redirects to `/login` if unauthenticated
- Shared `apiFetch` wrapper in `api/client.ts` adds `credentials: 'include'` to all requests
- `LoginPage` shows login/signup tabs; on success sets user in context and navigates to `/browse`
- `Layout` sidebar footer shows username initial + logout button; logout calls `/api/auth/logout` and redirects to `/login`
- `ApplyModal` polls `GET /api/apply/session/:id` every 2s while status is transient

---

## Data Model

### `users` (Phase 5)
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `username` | TEXT UNIQUE COLLATE NOCASE | Case-insensitive unique |
| `password_hash` | TEXT | bcrypt hash (cost 10) — never stored in plaintext |
| `created_at` | TEXT | ISO timestamp |

Default user seeded on startup from env vars `DEFAULT_USER_USERNAME` / `DEFAULT_USER_PASSWORD` (defaults: `vivek` / `chess123`).

### `applicant_profile` (per-user, Phase 5)
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment (no longer constrained to 1) |
| `user_id` | INTEGER UNIQUE | FK → users.id; one profile per user |
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
| `user_id` | INTEGER | FK → users.id (Phase 5) |
| `detected_fields_json` | TEXT nullable | JSON array of field labels found by runner |
| `fill_result_json` | TEXT nullable | `{ filled[], skipped[], total }` |
| `error_msg` | TEXT nullable | Error message if status=error |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `job_postings`, `sync_runs`, `sources` — unchanged from Phase 2.

---

## API Endpoints

### Auth (Phase 5)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Body: `{username, password}`. Sets `jp_session` cookie. Returns `{user}` |
| POST | `/api/auth/signup` | Body: `{username, password}`. Creates user + blank profile. Sets cookie. Returns `{user}` |
| POST | `/api/auth/logout` | Clears `jp_session` cookie |
| GET | `/api/auth/me` | Returns `{user: {userId, username}}` or 401 |

All other `/api/*` routes (except `/api/jobs` and `/api/sync`) require the `jp_session` cookie. Missing/expired cookie → 401.

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

### Phase 4.1 — ARIA widget support

`detectCustomFields(page: Page | Frame)` — new export:
- Injects `data-jp-cb="N"` on `[role="combobox"]` elements, `data-jp-rg="N"` on `fieldset`/`[role="radiogroup"]` with ≥2 radios
- Returns `DetectedField[]` with `widgetType: 'combobox' | 'radio_group'`
- Results merged into `detectFieldsAllFrames()` alongside native fields

`fillCombobox(page, selector, desiredText, isBoolean)`:
- Click trigger → `locator('[role="listbox"]').waitFor({ state: 'visible' })` → score `[role="option"]` in browser context → click best option

`fillRadioGroup(page, selector, desiredText, isBoolean)`:
- Find radio inputs in container → score labels → click best via `label[for="id"]` or direct radio click

`fillFields()` routing (updated, step 5 added before file check):
1. `!key` → skip
2. EEO guard
3. Resolve value
4. No value → skip
5. `widgetType === 'combobox'` → `fillCombobox()`
6. `widgetType === 'radio_group'` → `fillRadioGroup()`
7. `type === 'file'` → `setInputFiles()`
8. `type === 'checkbox'|'radio'` (native) → skip
9. `type === 'select'` AND `BOOLEAN_KEYS` → `fillSelectYesNo()`
10. `type === 'select'` → `fillSelectSmart()`
11. Default → `locator.fill()`

### Multi-step tracking (`runner/src/session.ts`)

`SessionState` gains:
- `lastFillFingerprint: string` — sorted `selector:type:profileKey` signature of last filled field set
- `stepCount: number` — increments on each successful fill

`computeFingerprint(fields)` — stable sorted join of field signatures.

After each `fillSession()` call: `lastFillFingerprint = computeFingerprint(fields)`, `stepCount++`.

### Client polling (Phase 4.1)

`POLLING_STATUSES` in `ApplyModal.tsx` now includes `'form_detected'` and `'filled'`, so the modal continues polling after each autofill step to detect when the next Workday step becomes available.

Fill history is accumulated in `fillHistory: FillResult[]` state. Each step's results are shown under "Step N results" labels.

Skipped automatically: native checkboxes/radios, unmapped fields, fields with no profile value, EEO fields when opt-in is off.

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

The watcher always starts (regardless of initial form detection) and runs for the session lifetime:

1. **MutationObserver injection** — `window.__jp_dom_changed` flag is set by an observer watching `document.documentElement`; reset after each read
2. **Navigation events** — `page.on('framenavigated')` and `page.on('domcontentloaded')` set a `navOccurred` flag
3. **1-second polling loop** — checks URL change, `__jp_dom_changed` flag, and `navOccurred`; if any changed, re-runs field detection
4. **Iframe support** — `detectFieldsAllFrames()` iterates `page.frames()` (1 level deep), calls `detectFields()` and `detectCustomFields()` on each, merges results deduped by selector
5. **Throttle guard** — `checkInProgress` boolean prevents concurrent checks within the same interval tick
6. **State machine** — watcher skips when `filling` or `form_detected`; only stops when `error | closed`

Detection threshold: **≥ 2 non-file fields** → `form_detected`.

### Browser Pool (`runner/src/session.ts` — `getBrowser()`)

`Map<string, Browser>` keyed by browser type. Browsers are reused across sessions of the same type. Launch rules:

| Type | Launch |
|------|--------|
| `chromium` | `chromium.launch({ headless: false })` |
| `chrome` | `chromium.launch({ channel: 'chrome', headless: false })` |
| `msedge` | `chromium.launch({ channel: 'msedge', headless: false })` |
| `webkit` | `webkit.launch({ headless: false })` |

### SPA Detection Flow (Phase 4.1)

```
openSession() → page.goto() → initial detectFieldsAllFrames()
    ↓ form found?
    YES → status=form_detected, banner injected
    NO  → status=open

    Always: watchForForm() starts (background)

    Watcher state machine (every 1s):
      status=filling|form_detected → skip
      status=open  → DOM/URL changed? → detectFieldsAllFrames() → ≥2 fields? → form_detected
      status=filled → DOM/URL changed?
                      → detectFieldsAllFrames()
                      → fingerprint ≠ lastFillFingerprint AND ≥2 fields?
                      → form_detected (new Workday step!)
      status=error|closed → stop
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
| 2026-03-04 | Phase 4.1: detectCustomFields (combobox + radio_group ARIA widgets) + fillCombobox + fillRadioGroup + field fingerprinting + multi-step watcher (never stops at filled) + stepCount + fillHistory in modal + POLLING_STATUSES expanded |
| 2026-03-05 | Phase 5: Multi-user auth — users table, bcryptjs password hashing, in-memory session store, jp_session cookie, requireAuth preHandler, per-user profile + apply_sessions, login/signup/logout/me endpoints, LoginPage, AuthContext, RequireAuth, apiFetch wrapper, Layout user menu |
| 2026-03-05 | Phase 4.2: Fixed CSS selector bug (UUID IDs → `[id="..."]` attribute selector), added `full_name` virtual key + normalizeLabel (strips filler words), added `draftNeeded` to FillResult for open-ended fields, post-apply "Did you apply?" confirmation flow in ApplyModal, wired onMarkApplied through JobTable |
