import type { Browser, Page } from 'playwright';
import { chromium, webkit } from 'playwright';
import { detectFields, detectCustomFields, fillFields } from './autofill';
import type { DetectedField, FillResult, Profile } from './autofill';

// ─── Session state ─────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'opening'
  | 'open'
  | 'form_detected'
  | 'filling'
  | 'filled'
  | 'error'
  | 'closed';

export interface SessionState {
  id: number;
  url: string;
  status: SessionStatus;
  browser: string;
  detectedFields: DetectedField[];
  fillResult: FillResult | null;
  errorMsg: string | null;
  lastUpdated: string;
  page: Page | null;
  // Phase 4.1: multi-step tracking
  lastFillFingerprint: string;
  stepCount: number;
}

// ─── In-memory session store ──────────────────────────────────────────────────

const sessions = new Map<number, SessionState>();

// Browser pool: keyed by browser type ('chromium' | 'chrome' | 'msedge' | 'webkit')
const browserPool = new Map<string, Browser>();

async function getBrowser(browserType: string): Promise<Browser> {
  const existing = browserPool.get(browserType);
  if (existing && existing.isConnected()) return existing;

  let b: Browser;
  switch (browserType) {
    case 'chrome':
      b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1280,900'] });
      break;
    case 'msedge':
      b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1280,900'] });
      break;
    case 'webkit':
      b = await webkit.launch({ headless: false });
      break;
    default: // 'chromium' and anything unknown
      b = await chromium.launch({ headless: false, args: ['--window-size=1280,900'] });
  }

  browserPool.set(browserType, b);
  return b;
}

// ─── Fingerprint: stable hash of detected field set ──────────────────────────
//
// Used to detect when a Workday wizard step has changed — if the fingerprint
// differs from lastFillFingerprint after the user clicks "Next", we know a
// new step with new fields has loaded and we should re-enable Autofill.

function computeFingerprint(fields: DetectedField[]): string {
  return fields
    .map((f) => `${f.selector}:${f.type}:${f.profileKey ?? ''}`)
    .sort()
    .join('|');
}

// ─── Detect fields across main frame + 1-level-deep child frames ──────────────

async function detectFieldsAllFrames(page: Page): Promise<DetectedField[]> {
  const allFields: DetectedField[] = [];
  const seenSelectors = new Set<string>();

  // Main frame — native inputs
  try {
    const mainFields = await detectFields(page);
    for (const f of mainFields) {
      if (f.selector && !seenSelectors.has(f.selector)) {
        seenSelectors.add(f.selector);
        allFields.push(f);
      }
    }
  } catch { /* ignore */ }

  // Main frame — custom ARIA widgets (comboboxes, radio groups)
  try {
    const customFields = await detectCustomFields(page);
    for (const f of customFields) {
      if (f.selector && !seenSelectors.has(f.selector)) {
        seenSelectors.add(f.selector);
        allFields.push(f);
      }
    }
  } catch { /* ignore */ }

  // Child frames (1 level deep)
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const frameFields = await detectFields(frame);
      for (const f of frameFields) {
        if (f.selector && !seenSelectors.has(f.selector)) {
          seenSelectors.add(f.selector);
          allFields.push(f);
        }
      }
    } catch { /* ignore — iframe may be cross-origin */ }

    try {
      const frameCustomFields = await detectCustomFields(frame);
      for (const f of frameCustomFields) {
        if (f.selector && !seenSelectors.has(f.selector)) {
          seenSelectors.add(f.selector);
          allFields.push(f);
        }
      }
    } catch { /* ignore */ }
  }

  return allFields;
}

// ─── Show "form detected" banner in page ─────────────────────────────────────

async function showFormDetectedBanner(page: Page, count: number, step?: number): Promise<void> {
  const label = step && step > 1
    ? `JobPilot: step ${step} detected (${count} fields) — click Autofill in dashboard`
    : `JobPilot: form detected (${count} fields) — click Autofill in dashboard`;

  await page.evaluate((text) => {
    const existing = document.getElementById('__jobpilot_banner__');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = '__jobpilot_banner__';
    div.style.cssText = [
      'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
      'background:#f0fdf4', 'color:#15803d', 'border:1.5px solid #86efac',
      'font-family:system-ui,sans-serif', 'font-size:13px', 'font-weight:600',
      'padding:8px 14px', 'border-radius:8px', 'box-shadow:0 4px 12px rgba(0,0,0,.15)',
    ].join(';');
    div.textContent = text;
    document.body.appendChild(div);
  }, label).catch(() => { /* ignore */ });
}

// ─── Watcher: continuously watch for application form ────────────────────────
//
// Phase 4.1 changes from Phase 3.5:
//   - TERMINAL is now only ['error', 'closed'] — watcher never stops at form_detected or filled
//   - State machine:
//       'filling'       → skip (fill in progress)
//       'form_detected' → skip (waiting for user to click Autofill)
//       'open'          → scan → if ≥2 fields → form_detected
//       'filled'        → scan → if fingerprint ≠ lastFillFingerprint → form_detected (new step)

async function watchForForm(sessionId: number): Promise<void> {
  const state = sessions.get(sessionId);
  if (!state || !state.page) return;

  const page = state.page;
  let lastUrl = page.url();
  let navOccurred = false;
  let checkInProgress = false;

  // Only truly terminal states stop the watcher
  const TERMINAL: Set<SessionStatus> = new Set(['error', 'closed']);

  // Inject MutationObserver into the page
  try {
    await page.evaluate(() => {
      (window as unknown as { __jp_dom_changed: boolean }).__jp_dom_changed = false;
      const observer = new MutationObserver(() => {
        (window as unknown as { __jp_dom_changed: boolean }).__jp_dom_changed = true;
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
    });
  } catch { /* page may have navigated away */ }

  // Listen to navigation events
  page.on('framenavigated', () => { navOccurred = true; });
  page.on('domcontentloaded', () => { navOccurred = true; });

  const interval = setInterval(async () => {
    // Stop only when truly terminal
    if (TERMINAL.has(state.status)) {
      clearInterval(interval);
      return;
    }

    // Skip while filling or already waiting for autofill
    if (state.status === 'filling' || state.status === 'form_detected') return;

    // Throttle: skip if check already running
    if (checkInProgress) return;
    checkInProgress = true;

    try {
      const currentUrl = page.url();
      const urlChanged = currentUrl !== lastUrl;

      // Read & reset DOM mutation flag
      let domChanged = false;
      try {
        domChanged = await page.evaluate(() => {
          const w = window as unknown as { __jp_dom_changed: boolean };
          const changed = w.__jp_dom_changed;
          w.__jp_dom_changed = false;
          return changed;
        });
      } catch { /* page navigated — treat as changed */ domChanged = true; }

      if (urlChanged || domChanged || navOccurred) {
        lastUrl = currentUrl;
        navOccurred = false;

        // Re-inject observer after navigation
        if (urlChanged) {
          try {
            await page.evaluate(() => {
              (window as unknown as { __jp_dom_changed: boolean }).__jp_dom_changed = false;
              const observer = new MutationObserver(() => {
                (window as unknown as { __jp_dom_changed: boolean }).__jp_dom_changed = true;
              });
              observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
            });
          } catch { /* ignore */ }
        }

        const fields = await detectFieldsAllFrames(page);
        const hasForm = fields.length >= 2 && fields.some((f) => f.type !== 'file');

        if (hasForm) {
          const fingerprint = computeFingerprint(fields);

          if (state.status === 'open') {
            // First form detection
            state.detectedFields = fields;
            state.status = 'form_detected';
            state.lastUpdated = new Date().toISOString();
            console.log(`[runner] session=${sessionId} form_detected fields=${fields.length} url=${currentUrl}`);
            await showFormDetectedBanner(page, fields.length);

          } else if (state.status === 'filled' && fingerprint !== state.lastFillFingerprint) {
            // New Workday wizard step: different fields appeared after user clicked "Next"
            state.detectedFields = fields;
            state.status = 'form_detected';
            state.lastUpdated = new Date().toISOString();
            const step = state.stepCount + 1;
            console.log(`[runner] session=${sessionId} new_step=${step} fields=${fields.length} url=${currentUrl}`);
            await showFormDetectedBanner(page, fields.length, step);
          }
        }
      }

      state.lastUpdated = new Date().toISOString();
    } catch {
      // Page closed or navigated — check if terminal and clean up
      if (TERMINAL.has(state.status)) clearInterval(interval);
    } finally {
      checkInProgress = false;
    }
  }, 1000);
}

// ─── Open a new session ───────────────────────────────────────────────────────

export async function openSession(sessionId: number, url: string, browserType = 'chromium'): Promise<void> {
  const state: SessionState = {
    id: sessionId,
    url,
    status: 'opening',
    browser: browserType,
    detectedFields: [],
    fillResult: null,
    errorMsg: null,
    lastUpdated: new Date().toISOString(),
    page: null,
    lastFillFingerprint: '',
    stepCount: 0,
  };
  sessions.set(sessionId, state);

  try {
    const b = await getBrowser(browserType);
    const page = await b.newPage();
    state.page = page;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    state.status = 'open';
    state.lastUpdated = new Date().toISOString();

    // Initial detection (catches simple forms that load with the page)
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => { /* ok */ });
    const initialFields = await detectFieldsAllFrames(page);
    const hasForm = initialFields.length >= 2 && initialFields.some((f) => f.type !== 'file');

    if (hasForm) {
      state.detectedFields = initialFields;
      state.status = 'form_detected';
      state.lastUpdated = new Date().toISOString();
      console.log(`[runner] session=${sessionId} status=form_detected fields=${initialFields.length} url=${url}`);
      await showFormDetectedBanner(page, initialFields.length);
    } else {
      console.log(`[runner] session=${sessionId} status=open fields=${initialFields.length} url=${url} — watching…`);
    }

    // Always start the watcher — it handles multi-step forms and SPA navigation.
    // The watcher skips when status is 'form_detected' or 'filling', so it's safe
    // to start even when the form was already detected above.
    watchForForm(sessionId).catch(() => { /* background — ignore errors */ });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    state.status = 'error';
    state.errorMsg = msg;
    state.lastUpdated = new Date().toISOString();
    console.error(`[runner] session=${sessionId} FAILED: ${msg}`);
  }
}

// ─── Get session state ────────────────────────────────────────────────────────

export function getSession(sessionId: number): SessionState | undefined {
  return sessions.get(sessionId);
}

// ─── Fill session ─────────────────────────────────────────────────────────────

export async function fillSession(sessionId: number, profile: Profile): Promise<FillResult> {
  const state = sessions.get(sessionId);
  if (!state) throw new Error(`Session ${sessionId} not found.`);
  if (!state.page) throw new Error(`Session ${sessionId} has no open page.`);
  if (state.status !== 'form_detected') {
    throw new Error(`Session ${sessionId} is not in form_detected state (current: ${state.status}).`);
  }

  state.status = 'filling';
  state.lastUpdated = new Date().toISOString();

  try {
    // Re-detect fields to get fresh state (page may have changed)
    const fields = await detectFieldsAllFrames(state.page);
    state.detectedFields = fields;

    const result = await fillFields(state.page, fields, profile);
    state.fillResult = result;

    // Save fingerprint so the watcher can detect when a new step loads
    state.lastFillFingerprint = computeFingerprint(fields);
    state.stepCount++;

    state.status = 'filled';
    state.lastUpdated = new Date().toISOString();

    console.log(
      `[runner] session=${sessionId} step=${state.stepCount} filled=${result.filled.length} skipped=${result.skipped.length}`,
    );

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    state.status = 'error';
    state.errorMsg = msg;
    state.lastUpdated = new Date().toISOString();
    throw new Error(msg);
  }
}

// ─── Close session ────────────────────────────────────────────────────────────

export async function closeSession(sessionId: number): Promise<void> {
  const state = sessions.get(sessionId);
  if (!state) return;
  if (state.page) {
    await state.page.close().catch(() => { /* ignore */ });
    state.page = null;
  }
  state.status = 'closed';
  state.lastUpdated = new Date().toISOString();
}
