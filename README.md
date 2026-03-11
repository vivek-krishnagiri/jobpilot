# JobPilot — Job Application Automation Dashboard

JobPilot is a **local-first, human-in-the-loop** job application assistant. It lets you browse job postings aggregated from GitHub-hosted boards, maintain a rich applicant profile, and autofill application forms in a real browser with a single click. You always review and submit the form yourself — JobPilot never auto-submits anything.

> **Safety disclaimer:** JobPilot **never** auto-submits forms. You control every submission. Autofill is triggered manually, and you review everything before clicking the site's own submit button.

---

## Requirements

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | **23 or later** (uses built-in `node:sqlite`) |
| [pnpm](https://pnpm.io/installation) | 8+ |
| Git | any |

> **Why Node 23?** JobPilot uses `node:sqlite` (the built-in `DatabaseSync` API introduced in Node 23). No native compilation, no `better-sqlite3` build issues.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/vivek-krishnagiri/jobpilot.git
cd jobpilot

# 2. Install dependencies for all workspaces
pnpm install

# 3. Download Playwright's Chromium browser (one-time, ~120 MB)
pnpm --filter runner exec playwright install chromium

# 4. Start all three services
pnpm dev
```

| Service | URL |
|---------|-----|
| Dashboard (client) | http://localhost:5173 |
| API server | http://localhost:3001 |
| Autofill runner | http://localhost:3002 |

The database and resume upload folder are created automatically in `server/data/` on first run.

**5. Log in** — open `http://localhost:5173`. You'll be redirected to the login page. Default credentials:

| Field | Value |
|-------|-------|
| Username | `vivek` |
| Password | `chess123` |

You can also create a new account via the **Sign up** tab.

---

## Authentication

JobPilot uses **cookie-based sessions** with bcrypt-hashed passwords. Sessions are persisted to SQLite and survive server restarts — you stay logged in across restarts.

- Accounts are created via the **Sign up** tab on the login page
- Each account has its own private profile, resume, and apply session history
- Profiles and sessions are completely isolated between users

### Changing the default credentials

Set environment variables before starting the server (or create `server/.env`):

```bash
DEFAULT_USER_USERNAME=yourname
DEFAULT_USER_PASSWORD=your-secure-password
```

These are only used when the default user doesn't already exist in the database. Passwords are hashed with bcrypt (cost 10) and never stored in plaintext.

---

## Environment Variables

JobPilot requires **no API keys or secrets** by default. All data is stored locally. See `.env.example` for all available variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_USER_USERNAME` | `vivek` | Username for the default account created on first run |
| `DEFAULT_USER_PASSWORD` | `chess123` | Password for the default account (bcrypt-hashed before storage) |

---

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Browse Jobs | `/browse` | Search, filter, and apply to job postings |
| Current Jobs | `/current` | Jobs you've applied to, with notes |
| Settings | `/settings` | My Profile + job source config |

---

## Setting Up Your Profile

Before using autofill, fill in your profile in **Settings → My Profile**.

**Option A — Upload your resume (recommended):**
1. Go to **Settings**
2. Click **Upload** next to the Resume row and select your resume (`.pdf`, `.doc`, or `.docx`)
3. JobPilot automatically extracts your name, email, phone, LinkedIn URL, and website into the form (only fills empty fields — never overwrites existing data)
4. Review the pre-filled values, correct anything, and click **Save Profile**

**Option B — Manual entry:**
1. Go to **Settings**
2. Fill in Basic Info (name, email, phone, country, LinkedIn, website) and select your Preferred Browser
3. Expand the accordion sections to fill in address, work authorization, referral history, and employment/education history
4. Click **Save Profile**

**Cover letter:**
Click **Upload** next to the Cover Letter row. When a form has a cover letter file upload field, Autofill will attach it automatically.

### Profile sections

| Section | What it covers |
|---------|---------------|
| **Basic Info** | Name, email, phone, country, LinkedIn, website, browser |
| **Address** | Street, city, state, ZIP |
| **Work Authorization** | Legally authorized (Yes/No), sponsorship (Yes/No), country, relocation, start date |
| **Referral & History** | Employee referral, EdTech history, Renaissance history |
| **Employment History** | Multiple positions — company, title, dates |
| **Education** | Multiple entries — school, degree, field, years |
| **Voluntary EEO** | Opt-in toggle + demographic fields (disabled by default) |

---

## Applying to a Job with Autofill

1. Find a job in **Browse Jobs**
2. Click the **Apply →** button — a browser window opens pointing to the job URL
3. The runner immediately watches for the application form
4. **For SPA boards (Workday, Greenhouse, Lever):** navigate to the actual form in the browser window (e.g. click "Apply Now", sign in). The runner detects the form automatically as soon as it appears
5. The dashboard modal updates to **"Form detected — ready to autofill"** when ≥ 2 fillable fields are found
6. Click **Autofill** — JobPilot fills all matching fields from your profile
7. Review what was filled, complete any remaining questions manually, then **submit the form yourself**

> JobPilot **never** auto-submits forms. You are always in control of submission.

---

## What Autofill Fills

Autofill matches form fields by label text, `aria-label`, and `name`/`id`/`autocomplete` attributes. It handles both native HTML controls and Workday-style ARIA widgets.

| Field type | Strategy |
|-----------|---------|
| Text / email / tel / textarea | `fill()` with profile value |
| `<select>` — yes/no fields | Synonym-matched: "No, I do not require sponsorship" correctly matches profile value `No` |
| `<select>` — general dropdowns | Centralized scoring: exact → starts-with → contains → token overlap |
| `[role="combobox"]` (Workday) | Click trigger → wait for listbox → score `[role="option"]` texts in Node.js → click best |
| `[role="radiogroup"]` / `fieldset` | Extract labels to Node.js → score → click best; works with `<input type="radio">` AND `[role="radio"]` card-style elements |
| Bare radio groups (shared `name` attr) | Extract labels to Node.js → score → click best match |
| `aria-haspopup="listbox"` triggers | Treated as combobox — click trigger → wait for listbox → score options |
| File upload (resume) | `setInputFiles()` with saved resume path |
| File upload (cover letter) | `setInputFiles()` with saved cover letter path |
| Native checkbox / radio | **Skipped** — needs manual input |
| EEO fields | **Skipped unless** you enable EEO autofill in Settings |

Fields that cannot be filled are listed in the **"Needs manual input"** section of the modal with a reason code (`low_confidence`, `eeo_disabled`, `no_profile_value`, `unmapped`). Filled fields show the actual value that was selected (e.g. "Sponsorship → No", "Race → White (Not Hispanic or Latino)").

---

## Form Watcher (SPA Support)

After clicking Apply, JobPilot watches for the form using three mechanisms:

- **URL change detection** — re-scans immediately when the browser navigates
- **DOM MutationObserver** — a `MutationObserver` is injected into the page; signals the runner when DOM changes
- **1-second polling fallback** — catch-all loop

The runner also checks **iframes** (1 level deep) for embedded form fields, and detects ARIA widgets (`[role="combobox"]`, `[role="radiogroup"]`). Once ≥ 2 non-file fields are found, the status transitions to `form_detected` and the Autofill button enables.

**Multi-step forms (Workday wizard):** The watcher never stops after the first fill. After you click Autofill and then click **Next** in the browser, the runner detects the new step's fields by comparing a fingerprint of the current field set against what was last filled. When the fields differ, the status transitions back to `form_detected` and the Autofill button re-enables for the next step. The modal shows "Step 2 results", "Step 3 results", etc.

---

## Browser Selection

Choose your browser in **Settings → My Profile → Preferred Browser**:

| Option | Notes |
|--------|-------|
| **Chromium** (default) | Always available — no extra install needed |
| Google Chrome | Requires system Chrome to be installed |
| Microsoft Edge | Requires system Edge to be installed |
| WebKit | Safari-like; bundled with Playwright |

```bash
# Install all Playwright browsers if you want Chrome/Edge/WebKit
pnpm --filter runner exec playwright install

# Or install WebKit only
pnpm --filter runner exec playwright install webkit
```

---

## Syncing New Jobs

Click **Sync Jobs** in Browse Jobs to pull fresh listings:

- **SimplifyJobs New Grad** — parses the GitHub README HTML table
- **Jobright 2026 SWE** — parses the GitHub README Markdown table

New postings are upserted; listings that disappear are marked inactive.

---

## Filters

| Filter | Options |
|--------|---------|
| Search | Keyword across company, title, location |
| Posted age | Today / 3 days / 1 week / 1 month |
| Work model | Remote / Hybrid / On-site |
| Location | Text filter |
| Company | Text filter |
| Source | SimplifyJobs / Jobright / Greenhouse / Lever / Manual |
| Active only | Toggle |
| Sort | Newest posted / Newest discovered / Company A–Z |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, TypeScript |
| Backend | Fastify v4, `node:sqlite` (built-in), TypeScript |
| Autofill runner | Playwright (headful, multi-engine), Fastify v4, TypeScript |
| Package manager | pnpm workspaces (3 packages: client, server, runner) |

---

## Data Storage

All data is stored locally in `server/data/` (git-ignored):
- `jobs.db` — SQLite database (job postings, profile, sessions)
- `resumes/` — uploaded resume and cover letter files

The database is created automatically on first run. New columns are added via `ALTER TABLE` migrations — safe to run on existing databases.

---

## Local Development Workflow

```bash
# Run individual workspaces
pnpm --filter server dev    # API server on :3001
pnpm --filter client dev    # Vite dev server on :5173
pnpm --filter runner dev    # Playwright runner on :3002

# Run all three together
pnpm dev

# TypeScript check (all workspaces)
pnpm -r exec tsc --noEmit

# Build for production
pnpm build
```

**Branch naming:**
- `main` — stable, always runnable
- `feature/<short-name>` — new features
- `fix/<short-name>` — bug fixes

**Typical workflow:**
```bash
git checkout -b feature/my-feature
# ... make changes ...
pnpm -r exec tsc --noEmit   # verify types pass
git add -p                   # stage selectively
git commit -m "feat: describe your change"
git push origin feature/my-feature
```

---

## Troubleshooting

**Playwright / Chromium not found**
```bash
pnpm --filter runner exec playwright install chromium
```

**Chrome or Edge not launching**
Chrome and Edge require the system browser to be installed. If not found, switch back to Chromium in Settings.

**Ports already in use (EADDRINUSE)**
```bash
lsof -ti:3001,3002,5173 | xargs kill -9
```

**Status stays "Browser open — watching for application form…" indefinitely**
The runner is watching but hasn't found ≥ 2 form fields yet:
1. Look at the open browser window
2. Navigate manually to the actual application form (click "Apply Now", sign in, etc.)
3. The modal updates automatically within 1–2 seconds once the form is visible

**"0 fields filled" after autofill**
Some form inputs are inside cross-origin iframes that cannot be accessed. Fill those fields manually.

**Resume text not extracted**
- Ensure the file is `.pdf`, `.doc`, or `.docx`
- Scanned PDFs (image-only) cannot be parsed — use a text-based PDF
- Max file size: 20 MB

**Workday / SPA navigation notes**
Workday, Greenhouse, and Lever load their forms dynamically. After the browser opens, you typically need to:
1. Click "Apply Now" on the company site
2. Sign in or create an account if prompted
3. Navigate to the form page — the runner will detect it automatically

**401 Unauthorized / redirected to login unexpectedly**
Sessions are stored in SQLite and survive server restarts. If you see a 401, your session likely expired (7-day TTL). Just log in again.

**"Username already taken" on signup**
Username comparison is case-insensitive. Try a different name.

**Node version**
JobPilot uses `node:sqlite` (built-in `DatabaseSync` API) which requires **Node.js 23+**.

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | Complete | Job discovery dashboard — browse, filter, sort |
| Phase 2 | Complete | Real job ingestion from GitHub README boards |
| Phase 3 | Complete | Applicant profile + browser autofill via Playwright |
| Phase 3.5 | Complete | Form watcher (SPA detection) + browser selection |
| Phase 3.7 | Complete | Expanded profile + yes/no dropdown autofill + EEO opt-in + cover letter |
| Phase 4.1 | Complete | Workday multi-step autofill + ARIA combobox + radio group support |
| Phase 5 | Complete | Multi-user authentication — login/signup, per-user profiles, cookie sessions |
| Phase 4.2 | Complete | Autofill accuracy improvements — UUID selector fix, full-name matching, open-ended field detection, post-apply confirmation |
| Phase 4.3 | Complete | Bare radio group autofill, EEO/radio grouping (one result per question), modal scrolling fix |
| Phase 4.4 | Complete | ARIA radio element clicking, `aria-haspopup="listbox"` combobox detection, applied jobs auto-removed from Browse Jobs |
| Phase 4.5 | Complete | Synonym matching + confidence scoring — verbose dropdown options (e.g. "White (Not Hispanic or Latino)") now correctly matched from short profile values |
| Phase 4 | Planned | Smart matching, scoring, email alerts |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
