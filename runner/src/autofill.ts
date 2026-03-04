import type { Page, Frame } from 'playwright';

// ─── Profile shape (mirrors server ProfileRow) ────────────────────────────────

export interface Profile {
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  country: string;
  linkedin_url: string;
  website_url: string;
  resume_file_path: string | null;
  // Phase 3.7
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_region?: string;
  postal_code?: string;
  phone_type?: string;
  phone_secondary?: string;
  email_secondary?: string;
  legally_authorized?: string;
  requires_sponsorship?: string;
  work_authorization_country?: string;
  willing_to_relocate?: string;
  available_start_date?: string;
  referred_by_employee?: string;
  referrer_name?: string;
  worked_in_edtech?: string;
  edtech_employer?: string;
  previously_worked_renaissance?: string;
  allow_eeo_autofill?: string;
  eeo_gender?: string;
  eeo_race_ethnicity?: string;
  eeo_sexual_orientation?: string;
  eeo_transgender?: string;
  eeo_disability?: string;
  eeo_veteran?: string;
  cover_letter_file_path?: string | null;
  experience_json?: string;
  education_json?: string;
}

// ─── Extended profile key (includes virtual keys for exp/edu) ─────────────────

type ProfileKey = keyof Profile | 'exp_company' | 'exp_title' | 'edu_school' | 'edu_degree' | 'edu_field';

// ─── Field → profile key mapping ──────────────────────────────────────────────

interface FieldPattern {
  labels: string[];
  attrs: string[];
  profileKey: ProfileKey;
}

const FIELD_PATTERNS: FieldPattern[] = [
  {
    profileKey: 'first_name',
    labels: ['first name', 'given name', 'first'],
    attrs: ['firstname', 'first_name', 'fname', 'given-name', 'givenname'],
  },
  {
    profileKey: 'last_name',
    labels: ['last name', 'surname', 'family name', 'last'],
    attrs: ['lastname', 'last_name', 'lname', 'family-name', 'familyname', 'surname'],
  },
  {
    profileKey: 'preferred_name',
    labels: ['preferred name', 'nickname', 'goes by'],
    attrs: ['preferred_name', 'preferredname', 'nickname'],
  },
  {
    profileKey: 'email',
    labels: ['email', 'e-mail', 'email address'],
    attrs: ['email', 'e-mail', 'emailaddress'],
  },
  {
    profileKey: 'phone',
    labels: ['phone', 'mobile', 'telephone', 'cell', 'phone number'],
    attrs: ['phone', 'mobile', 'telephone', 'cell', 'phonenumber'],
  },
  {
    profileKey: 'linkedin_url',
    labels: ['linkedin', 'linkedin url', 'linkedin profile'],
    attrs: ['linkedin', 'linkedin_url', 'linkedinurl', 'linkedinprofile'],
  },
  {
    profileKey: 'website_url',
    labels: ['website', 'portfolio', 'personal website', 'personal url', 'portfolio url'],
    attrs: ['website', 'portfolio', 'personalwebsite', 'websiteurl', 'portfoliourl'],
  },
  {
    profileKey: 'country',
    labels: ['country', 'country of residence', 'country/region'],
    attrs: ['country', 'country_id', 'countrycode'],
  },
  // Address
  {
    profileKey: 'address_line1',
    labels: ['address line 1', 'street address', 'address 1', 'address'],
    attrs: ['address1', 'address_line1', 'streetaddress', 'address-line1'],
  },
  {
    profileKey: 'address_line2',
    labels: ['address line 2', 'apt', 'suite', 'address 2'],
    attrs: ['address2', 'address_line2', 'apt', 'suite', 'address-line2'],
  },
  {
    profileKey: 'city',
    labels: ['city', 'town', 'city/town'],
    attrs: ['city', 'locality'],
  },
  {
    profileKey: 'state_region',
    labels: ['state', 'province', 'region', 'state/province'],
    attrs: ['state', 'province', 'region', 'administrative-area'],
  },
  {
    profileKey: 'postal_code',
    labels: ['zip', 'postal code', 'zip code', 'postcode'],
    attrs: ['zip', 'postal', 'postalcode', 'zipcode', 'postal-code'],
  },
  // Available start
  {
    profileKey: 'available_start_date',
    labels: ['start date', 'available', 'earliest start', 'when can you start'],
    attrs: ['startdate', 'start_date', 'availabledate'],
  },
  // Referrer name
  {
    profileKey: 'referrer_name',
    labels: ['referrer name', 'who referred you', 'employee name', 'referral name'],
    attrs: ['referrername', 'referrer_name', 'referral_name'],
  },
  // Edtech employer
  {
    profileKey: 'edtech_employer',
    labels: ['ed tech employer', 'edtech company', 'previous ed tech employer'],
    attrs: ['edtechemployer', 'edtech_employer'],
  },
  // Work authorization country
  {
    profileKey: 'work_authorization_country',
    labels: ['authorized in which country', 'authorization country', 'country of authorization'],
    attrs: ['authcountry', 'work_auth_country', 'workauthorizationcountry'],
  },
  // Education virtual keys
  {
    profileKey: 'edu_school',
    labels: ['school', 'university', 'college', 'institution', 'educational institution'],
    attrs: ['school', 'university', 'college', 'institution'],
  },
  {
    profileKey: 'edu_degree',
    labels: ['degree', 'degree type', 'qualification', 'level of education'],
    attrs: ['degree', 'qualification', 'degreetype'],
  },
  {
    profileKey: 'edu_field',
    labels: ['field of study', 'major', 'concentration', 'area of study'],
    attrs: ['major', 'fieldofstudy', 'field_of_study', 'concentration'],
  },
  // Experience virtual keys
  {
    profileKey: 'exp_company',
    labels: ['employer', 'company name', 'organization', 'employer name', 'current employer'],
    attrs: ['employer', 'company', 'organization', 'companyname'],
  },
  {
    profileKey: 'exp_title',
    labels: ['job title', 'position', 'role', 'title', 'current title'],
    attrs: ['jobtitle', 'job_title', 'position', 'title', 'role'],
  },
];

// ─── Boolean yes/no patterns ──────────────────────────────────────────────────

interface BooleanPattern {
  profileKey: keyof Profile;
  labels: string[];
  attrs: string[];
}

const BOOLEAN_PATTERNS: BooleanPattern[] = [
  {
    profileKey: 'legally_authorized',
    labels: ['legally authorized', 'authorized to work', 'work authorization', 'legally eligible', 'eligible to work'],
    attrs: ['legallyauthorized', 'workauth', 'authorized', 'legally_authorized'],
  },
  {
    profileKey: 'requires_sponsorship',
    labels: ['sponsorship', 'immigration', 'h-1b', 'h1b', 'visa sponsorship', 'require sponsor', 'will you now or in the future'],
    attrs: ['sponsorship', 'visa', 'immigration', 'requires_sponsorship'],
  },
  {
    profileKey: 'referred_by_employee',
    labels: ['referred by', 'referral', 'employee referral', 'current employee', 'were you referred'],
    attrs: ['referred', 'referral', 'employee_referral'],
  },
  {
    profileKey: 'worked_in_edtech',
    labels: ['ed tech', 'edtech', 'education technology', 'previously employed in ed'],
    attrs: ['edtech', 'ed_tech', 'worked_in_edtech'],
  },
  {
    profileKey: 'previously_worked_renaissance',
    labels: ['renaissance', 'renaissance learning', 'previously worked for renaissance'],
    attrs: ['renaissance', 'previously_worked_renaissance'],
  },
  {
    profileKey: 'willing_to_relocate',
    labels: ['relocate', 'relocation', 'willing to relocate', 'open to relocation', 'are you willing to relocate'],
    attrs: ['relocate', 'relocation', 'willing_to_relocate'],
  },
];

// ─── EEO patterns ─────────────────────────────────────────────────────────────

interface EEOPattern {
  profileKey: keyof Profile;
  labels: string[];
  attrs: string[];
}

const EEO_PATTERNS: EEOPattern[] = [
  { profileKey: 'eeo_gender',             labels: ['gender', 'sex'],                    attrs: ['gender', 'sex'] },
  { profileKey: 'eeo_race_ethnicity',     labels: ['race', 'ethnicity', 'racial'],      attrs: ['race', 'ethnicity'] },
  { profileKey: 'eeo_veteran',            labels: ['veteran', 'military service'],       attrs: ['veteran', 'military'] },
  { profileKey: 'eeo_disability',         labels: ['disability', 'disabled', 'accommodation'], attrs: ['disability', 'disabled'] },
  { profileKey: 'eeo_sexual_orientation', labels: ['sexual orientation'],               attrs: ['orientation', 'sexual_orientation'] },
  { profileKey: 'eeo_transgender',        labels: ['transgender', 'trans'],             attrs: ['transgender'] },
];

// ─── Key sets for routing logic ───────────────────────────────────────────────

const BOOLEAN_KEYS = new Set<string>(BOOLEAN_PATTERNS.map((p) => p.profileKey));
const EEO_KEYS = new Set<string>(EEO_PATTERNS.map((p) => p.profileKey));
const VIRTUAL_EXP_KEYS = new Set(['exp_company', 'exp_title']);
const VIRTUAL_EDU_KEYS = new Set(['edu_school', 'edu_degree', 'edu_field']);

// ─── Detected field descriptor ────────────────────────────────────────────────

export interface DetectedField {
  selector: string;
  label: string;
  type: string;           // text | email | tel | select | file | textarea | checkbox | radio
  profileKey: ProfileKey | null;
  value: string | null;   // profile value that would fill it, null if unmapped
}

// Escape a value for use inside a CSS attribute selector (e.g. [for="..."])
function cssAttr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ─── Helper: get label text for an input ─────────────────────────────────────

async function getLabelText(page: Page | Frame, inputId: string, inputName: string): Promise<string> {
  // Try <label for="inputId">
  if (inputId) {
    try {
      const labelText = await page.$eval(
        `label[for="${cssAttr(inputId)}"]`,
        (el) => el.textContent ?? '',
      );
      if (labelText.trim()) return labelText.trim().toLowerCase();
    } catch { /* no label found */ }
  }

  // Try aria-label attribute
  if (inputName) {
    try {
      const ariaLabel = await page.$eval(
        `[name="${cssAttr(inputName)}"]`,
        (el) => el.getAttribute('aria-label') ?? '',
      );
      if (ariaLabel.trim()) return ariaLabel.trim().toLowerCase();
    } catch { /* ignore */ }
  }

  // Try placeholder as fallback
  try {
    const selector = inputName ? `[name="${cssAttr(inputName)}"]` : `[id="${cssAttr(inputId)}"]`;
    const placeholder = await page.$eval(
      selector,
      (el) => (el as HTMLInputElement).placeholder ?? '',
    );
    if (placeholder.trim()) return placeholder.trim().toLowerCase();
  } catch { /* ignore */ }

  return '';
}

// ─── Main: detect all fillable fields on page ─────────────────────────────────

export async function detectFields(page: Page | Frame): Promise<DetectedField[]> {
  const inputs = await page.$$eval(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea',
    (els) =>
      els.map((el) => ({
        tagName: el.tagName.toLowerCase(),
        type: el.getAttribute('type') ?? el.tagName.toLowerCase(),
        id: el.id ?? '',
        name: el.getAttribute('name') ?? '',
        autocomplete: el.getAttribute('autocomplete') ?? '',
        placeholder: (el as HTMLInputElement).placeholder ?? '',
        selector: el.id
          ? `#${el.id}`
          : el.getAttribute('name')
            ? `[name="${el.getAttribute('name')}"]`
            : '',
      })),
  );

  const detected: DetectedField[] = [];

  for (const input of inputs) {
    if (!input.selector) continue;

    const labelText = await getLabelText(page, input.id, input.name).catch(() => '');
    const attrLower = `${input.name} ${input.id} ${input.autocomplete}`.toLowerCase();

    // File inputs: check label for cover letter vs resume
    if (input.type === 'file') {
      const isCoverLetter = labelText.includes('cover letter') || attrLower.includes('cover') || attrLower.includes('coverletter');
      detected.push({
        selector: input.selector,
        label: labelText || 'file upload',
        type: 'file',
        profileKey: isCoverLetter ? 'cover_letter_file_path' : 'resume_file_path',
        value: null,
      });
      continue;
    }

    // Match against all pattern lists in priority order
    let matched: ProfileKey | null = null;

    // 1. Core field patterns
    for (const pattern of FIELD_PATTERNS) {
      const labelMatch = pattern.labels.some((l) => labelText.includes(l));
      const attrMatch = pattern.attrs.some((a) => attrLower.includes(a));
      if (labelMatch || attrMatch) {
        matched = pattern.profileKey;
        break;
      }
    }

    // 2. Boolean yes/no patterns (selects and text)
    if (!matched) {
      for (const pattern of BOOLEAN_PATTERNS) {
        const labelMatch = pattern.labels.some((l) => labelText.includes(l));
        const attrMatch = pattern.attrs.some((a) => attrLower.includes(a));
        if (labelMatch || attrMatch) {
          matched = pattern.profileKey;
          break;
        }
      }
    }

    // 3. EEO patterns
    if (!matched) {
      for (const pattern of EEO_PATTERNS) {
        const labelMatch = pattern.labels.some((l) => labelText.includes(l));
        const attrMatch = pattern.attrs.some((a) => attrLower.includes(a));
        if (labelMatch || attrMatch) {
          matched = pattern.profileKey;
          break;
        }
      }
    }

    detected.push({
      selector: input.selector,
      label: labelText || input.placeholder || input.name || input.id || '?',
      type: input.type,
      profileKey: matched,
      value: null,
    });
  }

  return detected;
}

// ─── Fill result ──────────────────────────────────────────────────────────────

export interface FillResult {
  filled: string[];
  skipped: string[];
  total: number;
}

// ─── Smart select helpers ─────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

async function fillSelectSmart(
  locator: ReturnType<Page['locator']>,
  desiredText: string,
  timeout = 2000,
): Promise<boolean> {
  const options = await locator.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => ({ v: o.value, t: o.text.trim() })),
  );

  const target = norm(desiredText);
  const scored = options.map((o) => {
    const n = norm(o.t);
    if (n === target) return { ...o, score: 100 };
    if (n.startsWith(target)) return { ...o, score: 80 };
    if (n.includes(target)) return { ...o, score: 60 };
    if (target.startsWith(n) && n.length > 2) return { ...o, score: 50 };
    return { ...o, score: 0 };
  }).filter((o) => o.score > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return false;
  await locator.selectOption({ value: scored[0].v }, { timeout });
  return true;
}

function yesScore(n: string): number {
  if (n === 'yes') return 3;
  if (n === 'y' || n === '1' || n === 'true') return 2;
  if (n.startsWith('yes')) return 1;
  return 0;
}

function noScore(n: string): number {
  if (n === 'no') return 3;
  if (n === 'n' || n === '0' || n === 'false') return 2;
  if (n.startsWith('no')) return 1;
  return 0;
}

async function fillSelectYesNo(
  locator: ReturnType<Page['locator']>,
  yesNo: 'Yes' | 'No',
  timeout = 2000,
): Promise<boolean> {
  const options = await locator.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => ({ v: o.value, t: o.text.trim() })),
  );

  const scoreFn = yesNo === 'Yes' ? yesScore : noScore;
  const best = options
    .map((o) => ({ ...o, score: scoreFn(norm(o.t)) }))
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return false;
  await locator.selectOption({ value: best.v }, { timeout });
  return true;
}

// ─── Resolve virtual exp/edu keys from JSON ───────────────────────────────────

function resolveVirtualKey(key: string, profile: Profile): string | null {
  if (VIRTUAL_EXP_KEYS.has(key)) {
    try {
      const items = JSON.parse(profile.experience_json ?? '[]') as Array<Record<string, string>>;
      if (!items.length) return null;
      const first = items[0];
      if (key === 'exp_company') return first.company ?? first.employer ?? null;
      if (key === 'exp_title') return first.title ?? first.job_title ?? null;
    } catch { return null; }
  }
  if (VIRTUAL_EDU_KEYS.has(key)) {
    try {
      const items = JSON.parse(profile.education_json ?? '[]') as Array<Record<string, string>>;
      if (!items.length) return null;
      const first = items[0];
      if (key === 'edu_school') return first.school ?? first.institution ?? null;
      if (key === 'edu_degree') return first.degree ?? null;
      if (key === 'edu_field') return first.field_of_study ?? first.major ?? null;
    } catch { return null; }
  }
  return null;
}

// ─── Main: fill detected fields using profile ────────────────────────────────

export async function fillFields(
  page: Page | Frame,
  fields: DetectedField[],
  profile: Profile,
): Promise<FillResult> {
  const filled: string[] = [];
  const skipped: string[] = [];

  for (const field of fields) {
    const key = field.profileKey;

    // Unmapped
    if (!key) {
      skipped.push(`${field.label} (unmapped)`);
      continue;
    }

    // EEO — skip unless opt-in is enabled
    if (EEO_KEYS.has(key) && profile.allow_eeo_autofill !== '1') {
      skipped.push(`${field.label} (eeo — toggle is off in profile)`);
      continue;
    }

    // Resolve the value
    let profileValue: string | null = null;
    if (VIRTUAL_EXP_KEYS.has(key) || VIRTUAL_EDU_KEYS.has(key)) {
      profileValue = resolveVirtualKey(key, profile);
    } else {
      const raw = (profile as unknown as Record<string, unknown>)[key];
      profileValue = raw != null && raw !== '' ? String(raw) : null;
    }

    if (!profileValue) {
      skipped.push(`${field.label} (no value in profile)`);
      continue;
    }

    try {
      // File upload
      if (field.type === 'file') {
        const fileInput = page.locator(field.selector);
        await fileInput.setInputFiles(profileValue);
        filled.push(`${field.label} (file attached)`);
        continue;
      }

      // Checkbox / radio — skip
      if (field.type === 'checkbox' || field.type === 'radio') {
        skipped.push(`${field.label} (checkbox/radio — needs manual input)`);
        continue;
      }

      // Select elements
      if (field.type === 'select') {
        const locator = page.locator(field.selector).first();

        // Boolean yes/no fields
        if (BOOLEAN_KEYS.has(key)) {
          const yesNo = profileValue === 'Yes' || profileValue === 'yes' ? 'Yes' : 'No';
          const ok = await fillSelectYesNo(locator, yesNo);
          if (ok) {
            filled.push(field.label);
          } else {
            skipped.push(`${field.label} (no yes/no option found in select)`);
          }
          continue;
        }

        // General smart select
        const ok = await fillSelectSmart(locator, profileValue);
        if (ok) {
          filled.push(field.label);
        } else {
          skipped.push(`${field.label} (no match in select options)`);
        }
        continue;
      }

      // Text / email / tel / url / textarea
      const locator = page.locator(field.selector).first();
      await locator.fill(profileValue, { timeout: 3000 });
      filled.push(field.label);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped.push(`${field.label} (error: ${msg.split('\n')[0]})`);
    }
  }

  // Inject visual overlay to confirm autofill ran
  await page.evaluate((count) => {
    const existing = document.getElementById('__jobpilot_overlay__');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = '__jobpilot_overlay__';
    div.style.cssText = [
      'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
      'background:#4f46e5', 'color:#fff', 'font-family:system-ui,sans-serif',
      'font-size:13px', 'font-weight:600', 'padding:8px 14px',
      'border-radius:8px', 'box-shadow:0 4px 12px rgba(0,0,0,.25)',
      'cursor:default', 'user-select:none',
    ].join(';');
    div.textContent = `JobPilot: ${count} field${count === 1 ? '' : 's'} filled`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 8000);
  }, filled.length).catch(() => { /* ignore if page closed */ });

  return { filled, skipped, total: fields.length };
}
