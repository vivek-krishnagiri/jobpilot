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

type ProfileKey = keyof Profile | 'full_name' | 'exp_company' | 'exp_title' | 'edu_school' | 'edu_degree' | 'edu_field';

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
    profileKey: 'full_name',
    labels: ['full name', 'legal name', 'complete name', 'full legal name', 'applicant name', 'candidate name', 'name'],
    attrs: ['fullname', 'full_name', 'legalname', 'legal_name', 'candidatename'],
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
    labels: [
      'legally authorized', 'authorized to work', 'work authorization', 'legally eligible',
      'eligible to work', 'right to work', 'currently authorized', 'currently eligible',
      'legally permitted', 'are you authorized', 'authorized in the',
    ],
    attrs: ['legallyauthorized', 'workauth', 'authorized', 'legally_authorized'],
  },
  {
    profileKey: 'requires_sponsorship',
    labels: [
      'sponsorship', 'immigration', 'h-1b', 'h1b', 'visa sponsorship', 'require sponsor',
      'will you now or in the future', 'require now or in the future',
      'currently require sponsorship', 'require immigration sponsorship',
      'require work authorization sponsorship',
    ],
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
  { profileKey: 'eeo_gender',             labels: ['gender', 'sex'],                                             attrs: ['gender', 'sex'] },
  { profileKey: 'eeo_race_ethnicity',     labels: ['race', 'ethnicity', 'racial'],                               attrs: ['race', 'ethnicity'] },
  { profileKey: 'eeo_veteran',            labels: ['veteran', 'military service', 'protected veteran', 'veteran status'], attrs: ['veteran', 'military'] },
  { profileKey: 'eeo_disability',         labels: ['disability', 'disabled', 'accommodation', 'section 503', 'do you have a disability'], attrs: ['disability', 'disabled'] },
  { profileKey: 'eeo_sexual_orientation', labels: ['sexual orientation'],                                        attrs: ['orientation', 'sexual_orientation'] },
  { profileKey: 'eeo_transgender',        labels: ['transgender', 'trans'],                                      attrs: ['transgender'] },
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
  type: string;              // text | email | tel | select | file | textarea | checkbox | radio
  profileKey: ProfileKey | null;
  value: string | null;      // profile value that would fill it, null if unmapped
  widgetType?: 'native' | 'combobox' | 'radio_group' | 'bare_radio_group';
}

// Escape a value for use inside a CSS attribute selector (e.g. [for="..."])
function cssAttr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Strip filler words so "Please enter your full name" → "full name" for cleaner matching
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\b(please|enter|provide|type|input|your|the|a|an|here|below|us)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

// ─── Main: detect native fillable fields on page ──────────────────────────────

export async function detectFields(page: Page | Frame): Promise<DetectedField[]> {
  // $$eval callback must be pure JS — no TypeScript syntax or closures over outer scope,
  // because Playwright serialises it via Function.prototype.toString() and eval()s it in
  // the browser context. Selector generation happens OUTSIDE the callback using cssAttr().
  const rawInputs = await page.$$eval(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="radio"]):not([type="checkbox"]), select, textarea',
    (els) => els.map((el) => ({
      tagName: el.tagName.toLowerCase(),
      type: el.getAttribute('type') ?? el.tagName.toLowerCase(),
      id: el.id ?? '',
      name: el.getAttribute('name') ?? '',
      autocomplete: el.getAttribute('autocomplete') ?? '',
      placeholder: (el as HTMLInputElement).placeholder ?? '',
    })),
  );

  // Build safe CSS attribute selectors in TypeScript (cssAttr handles UUID ids, special chars)
  const inputs = rawInputs.map((input) => ({
    ...input,
    selector: input.id
      ? `[id="${cssAttr(input.id)}"]`
      : input.name
        ? `[name="${cssAttr(input.name)}"]`
        : '',
  }));

  console.log(`[runner] detectFields: raw=${rawInputs.length} with-selector=${inputs.filter((i) => i.selector).length}`);

  const detected: DetectedField[] = [];

  for (const input of inputs) {
    if (!input.selector) continue;

    const labelText = await getLabelText(page, input.id, input.name).catch(() => '');
    const normalizedLabel = normalizeLabel(labelText);
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
        widgetType: 'native',
      });
      continue;
    }

    // Match against all pattern lists in priority order
    let matched: ProfileKey | null = null;

    // 1. Core field patterns — check raw label AND normalized label (strips filler words)
    for (const pattern of FIELD_PATTERNS) {
      const labelMatch = pattern.labels.some((l) => labelText.includes(l) || normalizedLabel === l || normalizedLabel.startsWith(l + ' ') || (normalizedLabel.includes(l) && l.length > 4));
      const attrMatch = pattern.attrs.some((a) => attrLower.includes(a));
      if (labelMatch || attrMatch) {
        matched = pattern.profileKey;
        break;
      }
    }

    // 2. Boolean yes/no patterns (selects and text)
    if (!matched) {
      for (const pattern of BOOLEAN_PATTERNS) {
        const labelMatch = pattern.labels.some((l) => labelText.includes(l) || normalizedLabel.includes(l));
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
        const labelMatch = pattern.labels.some((l) => labelText.includes(l) || normalizedLabel.includes(l));
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
      widgetType: 'native',
    });
  }

  return detected;
}

// ─── Detect custom widgets: comboboxes + radio groups ─────────────────────────
//
// Workday and similar ATSes use ARIA widgets instead of native <select>/<input>.
// This function injects stable data-jp-* attributes and returns DetectedField
// descriptors for each widget, to be merged with detectFields() results.

export async function detectCustomFields(page: Page | Frame): Promise<DetectedField[]> {
  // Inject data-jp-cb / data-jp-rg attributes and collect label + index metadata
  type RawWidget = { selector: string; label: string; widgetType: 'combobox' | 'radio_group' | 'bare_radio_group' };

  const rawWidgets = await page.evaluate((): RawWidget[] => {
    function getLabel(el: Element): string {
      // 1. aria-labelledby → look up element
      const lby = el.getAttribute('aria-labelledby');
      if (lby) {
        const ids = lby.split(/\s+/);
        const text = ids.map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
        if (text) return text;
      }
      // 2. aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel?.trim()) return ariaLabel.trim();
      // 3. Walk up and look for label / legend text
      let node: Element | null = el.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!node) break;
        const lbl = node.querySelector('label, legend');
        if (lbl) {
          const t = lbl.textContent?.trim();
          if (t && t.length < 300) return t;
        }
        node = node.parentElement;
      }
      return '';
    }

    const results: RawWidget[] = [];

    // Comboboxes: [role="combobox"] not inside aria-hidden containers
    const comboboxEls = document.querySelectorAll('[role="combobox"]');
    comboboxEls.forEach((el, i) => {
      // Skip if aria-hidden ancestor
      let ancestor: Element | null = el;
      let hidden = false;
      while (ancestor) {
        if (ancestor.getAttribute('aria-hidden') === 'true') { hidden = true; break; }
        ancestor = ancestor.parentElement;
      }
      if (hidden) return;

      el.setAttribute('data-jp-cb', String(i));
      results.push({
        selector: `[data-jp-cb="${i}"]`,
        label: getLabel(el),
        widgetType: 'combobox',
      });
    });

    // aria-haspopup="listbox" triggers not already covered by [role="combobox"]
    // (e.g. Lever / custom ATS dropdown buttons that reveal a listbox portal)
    const listboxTriggers = document.querySelectorAll('[aria-haspopup="listbox"]:not([role="combobox"])');
    let lbtIndex = 0;
    listboxTriggers.forEach((el) => {
      let ancestor: Element | null = el;
      let hidden = false;
      while (ancestor) {
        if (ancestor.getAttribute('aria-hidden') === 'true') { hidden = true; break; }
        ancestor = ancestor.parentElement;
      }
      if (hidden) return;

      const label = getLabel(el);
      if (!label) { lbtIndex++; return; }

      el.setAttribute('data-jp-lbt', String(lbtIndex));
      results.push({ selector: `[data-jp-lbt="${lbtIndex}"]`, label, widgetType: 'combobox' });
      lbtIndex++;
    });

    // Radio groups: role="radiogroup" or fieldset with ≥2 radios.
    // Count both native <input type="radio"> AND ARIA [role="radio"] elements
    // (Greenhouse EEO / Ashby-style cards use [role="radio"] divs).
    const rgEls = document.querySelectorAll('[role="radiogroup"], fieldset');
    let rgIndex = 0;
    rgEls.forEach((el) => {
      const nativeRadios = el.querySelectorAll('input[type="radio"]').length;
      const ariaRadios   = el.querySelectorAll('[role="radio"]').length;
      if (nativeRadios + ariaRadios < 2) return;
      el.setAttribute('data-jp-rg', String(rgIndex));
      const legend = el.querySelector('legend');
      const label = legend?.textContent?.trim() ?? getLabel(el);
      results.push({
        selector: `[data-jp-rg="${rgIndex}"]`,
        label,
        widgetType: 'radio_group',
      });
      rgIndex++;
    });

    // ── Bare radio groups ─────────────────────────────────────────────────────
    // Radios NOT inside a formal [role="radiogroup"] or fieldset, grouped by name.
    // selector is stored as the raw name attribute; TypeScript converts it to a
    // proper CSS selector after page.evaluate returns.
    const processedBareNames = new Set();
    document.querySelectorAll('input[type="radio"]').forEach((radio) => {
      const name = radio.getAttribute('name');
      if (!name || processedBareNames.has(name)) return;
      if (radio.closest('[role="radiogroup"]') || radio.closest('fieldset')) return;

      const siblings = Array.from(document.querySelectorAll('input[type="radio"]'))
        .filter((r) => r.getAttribute('name') === name
          && !r.closest('[role="radiogroup"]')
          && !r.closest('fieldset'));

      if (siblings.length < 2) return;
      processedBareNames.add(name);

      let groupLabel = '';

      // 1. aria-labelledby / aria-label on immediate parent
      const par = siblings[0].parentElement;
      if (par) {
        const lby = par.getAttribute('aria-labelledby');
        if (lby) {
          groupLabel = lby.split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .join(' ').trim();
        }
        if (!groupLabel) {
          const al = par.getAttribute('aria-label');
          if (al && al.trim()) groupLabel = al.trim();
        }
      }

      // 2. Preceding sibling of the first radio (text element, no radio children)
      if (!groupLabel) {
        let prev: Element | null = siblings[0].previousElementSibling;
        while (prev && !groupLabel) {
          if (!prev.querySelector('input[type="radio"]')) {
            const t = prev.textContent?.trim();
            if (t && t.length > 0 && t.length < 200) groupLabel = t;
          }
          prev = prev.previousElementSibling;
        }
      }

      // 3. Preceding sibling of the parent element
      if (!groupLabel && par) {
        let prev: Element | null = par.previousElementSibling;
        while (prev && !groupLabel) {
          if (!prev.querySelector('input[type="radio"]')) {
            const t = prev.textContent?.trim();
            if (t && t.length > 0 && t.length < 200) groupLabel = t;
          }
          prev = prev.previousElementSibling;
        }
      }

      // 4. Fall back to humanized name attribute
      if (!groupLabel) groupLabel = name.replace(/[-_]/g, ' ').trim();

      // selector = raw name value; converted to CSS selector after evaluate
      results.push({ selector: name, label: groupLabel, widgetType: 'bare_radio_group' });
    });

    return results;
  });

  // Build proper CSS attribute selectors for bare radio groups
  const processedWidgets = rawWidgets.map((w) =>
    w.widgetType === 'bare_radio_group'
      ? { ...w, selector: `input[type="radio"][name="${cssAttr(w.selector)}"]` }
      : w,
  );

  const detected: DetectedField[] = [];
  const allPatterns = [...FIELD_PATTERNS, ...BOOLEAN_PATTERNS, ...EEO_PATTERNS];

  for (const { selector, label, widgetType } of processedWidgets) {
    if (!label) continue;
    const labelLower = label.toLowerCase();
    const normalizedWidgetLabel = normalizeLabel(labelLower);
    let matched: ProfileKey | null = null;

    for (const pattern of allPatterns) {
      if (pattern.labels.some((l) => labelLower.includes(l) || normalizedWidgetLabel.includes(l))) {
        matched = pattern.profileKey;
        break;
      }
    }

    detected.push({
      selector,
      label: labelLower,
      // logical type for routing in fillFields
      type: widgetType === 'combobox' ? 'select' : 'radio',
      profileKey: matched,
      value: null,
      widgetType,
    });
  }

  return detected;
}

// ─── Fill result ──────────────────────────────────────────────────────────────

export interface FillResult {
  filled: string[];
  skipped: string[];
  draftNeeded: string[];
  total: number;
}

// ─── Answer normalization ─────────────────────────────────────────────────────
//
// Converts raw option/profile text into a comparable canonical form:
// lowercase, strip punctuation, remove common filler words.

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d\u2013\u2014]/g, ' ') // smart quotes / dashes
    .replace(/[^a-z0-9\s]/g, ' ')                             // strip all punctuation
    .replace(/\b(i|the|a|an|or|to|do|not|will|you|now|in|future|that|is|am|are)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Synonym map ──────────────────────────────────────────────────────────────
//
// profileKey → canonical profile value → list of option text fragments
// that indicate a match. The conflict-detection code in scoreOption uses this
// map to reject options that match a DIFFERENT canonical value.

const SYNONYM_MAP: Record<string, Record<string, string[]>> = {
  requires_sponsorship: {
    'no':  ['no', 'n', 'false', '0', 'no i do not', 'do not require', 'no sponsorship', 'no immigration', 'not require', 'not need'],
    'yes': ['yes', 'y', 'true', '1', 'yes i will', 'will require', 'need sponsorship', 'require immigration'],
  },
  legally_authorized: {
    'yes': ['yes', 'y', 'true', '1', 'i am authorized', 'yes i am', 'authorized to work', 'legally authorized', 'legally eligible'],
    'no':  ['no', 'n', 'false', '0', 'i am not authorized', 'not authorized'],
  },
  referred_by_employee: {
    'yes': ['yes', 'i was referred', 'employee referral', 'referred by'],
    'no':  ['no', 'not referred', 'i was not referred'],
  },
  willing_to_relocate: {
    'yes': ['yes', 'willing', 'open to relocation', 'i am willing', 'can relocate'],
    'no':  ['no', 'not willing', 'not open', 'cannot relocate', 'unable to relocate'],
  },
  worked_in_edtech: {
    'yes': ['yes', 'i have worked', 'previously worked'],
    'no':  ['no', 'i have not', 'have not worked'],
  },
  previously_worked_renaissance: {
    'yes': ['yes', 'i have worked', 'previously worked'],
    'no':  ['no', 'i have not', 'have not worked'],
  },
  eeo_gender: {
    'male':      ['male', 'man', 'he him'],
    'female':    ['female', 'woman', 'she her'],
    'nonbinary': ['non binary', 'nonbinary', 'genderqueer', 'gender non'],
    'decline':   ['decline', 'prefer not', 'not disclose', 'not wish', 'not say'],
  },
  eeo_race_ethnicity: {
    'white':              ['white', 'caucasian'],
    'black':              ['black', 'african american'],
    'asian':              ['asian'],
    'hispanic_or_latino': ['hispanic', 'latino', 'latina', 'latinx'],
    'native':             ['american indian', 'alaska native', 'native american'],
    'pacific_islander':   ['pacific islander', 'native hawaiian', 'pacific'],
    'two_or_more':        ['two or more', 'multiracial', 'mixed', 'multiple'],
    'decline':            ['decline', 'prefer not', 'not wish', 'not disclose'],
  },
  eeo_veteran: {
    'yes':     ['protected veteran', 'i identify', 'i am a veteran', 'yes veteran', 'active duty'],
    'no':      ['not a protected veteran', 'i am not a protected', 'no i am not'],
    'decline': ['decline', 'prefer not', 'not wish', 'not disclose'],
  },
  eeo_disability: {
    'yes':     ['yes i have', 'have a disability', 'i do have', 'disability yes'],
    'no':      ['no i do not', 'do not have a disability', 'no disability', 'none'],
    'decline': ['decline', 'prefer not', 'not wish', 'not disclose'],
  },
  eeo_sexual_orientation: {
    'straight':  ['straight', 'heterosexual'],
    'gay':       ['gay', 'lesbian', 'homosexual'],
    'bisexual':  ['bisexual', 'bi'],
    'decline':   ['decline', 'prefer not', 'not wish', 'not disclose', 'not say'],
  },
  eeo_transgender: {
    'yes':     ['yes', 'transgender', 'trans'],
    'no':      ['no', 'not transgender', 'cisgender'],
    'decline': ['decline', 'prefer not', 'not wish'],
  },
};

// ─── Centralized option scoring ───────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 40; // minimum score required to auto-select

/**
 * Score how well `optionText` matches `profileValue` given the question's
 * profile key. Returns 0-100 (higher = better), or -1 for a conflicting match.
 */
function scoreOption(optionText: string, profileValue: string, profileKey: string | null): number {
  const normOpt = normalizeText(optionText);
  const normVal = normalizeText(profileValue);
  if (!normOpt || !normVal) return 0;

  // 1. Synonym-map lookup (category-aware, highest precision)
  if (profileKey && SYNONYM_MAP[profileKey]) {
    const categoryMap = SYNONYM_MAP[profileKey];
    const canon = profileValue.toLowerCase().trim();
    const synonyms = categoryMap[canon] ?? categoryMap[normVal];

    if (synonyms) {
      for (const syn of synonyms) {
        const ns = normalizeText(syn);
        if (!ns) continue;
        if (normOpt === ns)          return 95;
        if (normOpt.startsWith(ns)) return 85;
        if (normOpt.includes(ns))   return 75;
      }
    }

    // Conflict: option matches a DIFFERENT canonical value → reject outright
    for (const [canon2, syns] of Object.entries(categoryMap)) {
      if (canon2 === canon || canon2 === normVal) continue;
      for (const syn of syns) {
        const ns = normalizeText(syn);
        if (ns && ns.length > 2 && (normOpt === ns || normOpt.startsWith(ns))) return -1;
      }
    }
  }

  // 2. Generic text scoring (no category map available)
  if (normOpt === normVal)                                return 100;
  if (normOpt.startsWith(normVal) && normVal.length > 2) return 75;
  if (normOpt.includes(normVal)   && normVal.length > 3) return 55;
  if (normVal.startsWith(normOpt) && normOpt.length > 2) return 45;

  // 3. Token overlap (partial match fallback)
  const optTokens = new Set(normOpt.split(' ').filter((t) => t.length > 2));
  const valTokens = normVal.split(' ').filter((t) => t.length > 2);
  if (valTokens.length > 0) {
    const overlap = valTokens.filter((t) => optTokens.has(t)).length;
    if (overlap > 0) return Math.round(30 * overlap / valTokens.length);
  }
  return 0;
}

/**
 * Pick the best option from a list, applying confidence threshold and
 * ambiguity guard. Returns null if no confident match found.
 */
function chooseBestOption(
  options: Array<{ v?: string; t: string }>,
  profileValue: string,
  profileKey: string | null,
): { value?: string; text: string } | null {
  const scored = options
    .map((o) => ({ ...o, score: scoreOption(o.t, profileValue, profileKey) }))
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  const best = scored[0];
  if (best.score < CONFIDENCE_THRESHOLD) return null;
  // Ambiguity: two options within 10 pts of each other, neither is clearly dominant
  if (scored.length >= 2 && (best.score - scored[1].score) < 10 && best.score < 85) return null;

  return { value: best.v, text: best.t };
}

// ─── Native <select> helpers ──────────────────────────────────────────────────

async function fillSelectSmart(
  locator: ReturnType<Page['locator']>,
  desiredText: string,
  profileKey: string | null = null,
  timeout = 2000,
): Promise<string | null> {
  const options = await locator.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => ({ v: o.value, t: o.text.trim() })),
  ) as Array<{ v: string; t: string }>;

  const winner = chooseBestOption(options, desiredText, profileKey);
  if (!winner) return null;
  await locator.selectOption({ value: winner.value! }, { timeout });
  return winner.text;
}

async function fillSelectYesNo(
  locator: ReturnType<Page['locator']>,
  yesNo: 'Yes' | 'No',
  profileKey: string | null = null,
  timeout = 2000,
): Promise<string | null> {
  // Delegate to fillSelectSmart — SYNONYM_MAP entries cover all yes/no variants
  return fillSelectSmart(locator, yesNo, profileKey, timeout);
}

// ─── ARIA combobox helper ─────────────────────────────────────────────────────
//
// Workday uses [role="combobox"] divs with a portal [role="listbox"] / [role="option"].
// Strategy: click trigger → wait for listbox → extract option texts to Node.js →
// score with chooseBestOption → click winner by index.

async function fillCombobox(
  page: Page | Frame,
  selector: string,
  desiredText: string,
  isBoolean: boolean,          // kept for API compat; scoring is now handled by SYNONYM_MAP
  profileKey: string | null = null,
  timeout = 3000,
): Promise<string | null> {
  try {
    await page.locator(selector).first().click({ timeout });
  } catch { return null; }

  try {
    await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout });
  } catch {
    if ('keyboard' in page) await (page as Page).keyboard.press('Escape').catch(() => {});
    return null;
  }

  // Extract option texts to Node.js (no scoring in browser context)
  const options = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="option"]'))
      .map((el, idx) => ({ idx, text: (el as HTMLElement).textContent?.trim() ?? '' }))
      .filter((o) => o.text),
  ) as Array<{ idx: number; text: string }>;

  const mapped = options.map((o) => ({ v: String(o.idx), t: o.text }));
  const winner = chooseBestOption(mapped, desiredText, profileKey);

  if (!winner) {
    if ('keyboard' in page) await (page as Page).keyboard.press('Escape').catch(() => {});
    return null;
  }

  try {
    await page.locator('[role="option"]').nth(Number(winner.value)).click({ timeout });
    return winner.text;
  } catch { return null; }
}

// ─── Radio group helper ───────────────────────────────────────────────────────
//
// Handles [role="radiogroup"] or fieldset containers with ≥2 radio inputs.
// Labels are extracted to Node.js then scored by chooseBestOption.

async function fillRadioGroup(
  page: Page | Frame,
  selector: string,
  desiredText: string,
  isBoolean: boolean,          // kept for API compat
  profileKey: string | null = null,
  timeout = 2000,
): Promise<string | null> {
  // Extract radio option labels to Node.js (no scoring in browser)
  const options = await page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return [];
    const results: Array<{ index: number; text: string; isAria: boolean; radioId: string }> = [];

    const natives = Array.from(container.querySelectorAll('input[type="radio"]'));
    if (natives.length > 0) {
      natives.forEach((radio, idx) => {
        const r = radio as HTMLInputElement;
        let text = '';
        if (r.id) {
          const lbl = document.querySelector('label[for="' + r.id + '"]');
          if (lbl) text = lbl.textContent?.trim() ?? '';
        }
        if (!text) { const cl = r.closest('label'); if (cl) text = cl.textContent?.trim() ?? ''; }
        if (!text) text = r.getAttribute('aria-label') ?? r.value ?? '';
        results.push({ index: idx, text, isAria: false, radioId: r.id ?? '' });
      });
      return results;
    }

    Array.from(container.querySelectorAll('[role="radio"]')).forEach((el, idx) => {
      const e = el as HTMLElement;
      results.push({ index: idx, text: e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '', isAria: true, radioId: '' });
    });
    return results;
  }, selector) as Array<{ index: number; text: string; isAria: boolean; radioId: string }>;

  const winner = chooseBestOption(options.map((o) => ({ v: String(o.index), t: o.text })), desiredText, profileKey);
  if (!winner) return null;

  const idx = Number(winner.value);
  const opt = options[idx];
  try {
    if (opt.isAria) {
      await page.locator(`${selector} [role="radio"]`).nth(idx).click({ timeout });
    } else if (opt.radioId) {
      try { await page.locator(`label[for="${cssAttr(opt.radioId)}"]`).first().click({ timeout }); }
      catch { await page.locator(`${selector} input[type="radio"]`).nth(idx).click({ timeout }); }
    } else {
      await page.locator(`${selector} input[type="radio"]`).nth(idx).click({ timeout });
    }
    return winner.text;
  } catch { return null; }
}

// ─── Bare radio group helper ──────────────────────────────────────────────────
//
// Handles radios sharing a [name] attribute but NOT inside a formal
// [role="radiogroup"] or <fieldset>. The selector is a full CSS attribute
// selector: input[type="radio"][name="..."]

async function fillBareRadioGroup(
  page: Page | Frame,
  radioSelector: string,
  desiredText: string,
  isBoolean: boolean,          // kept for API compat
  profileKey: string | null = null,
  timeout = 2000,
): Promise<string | null> {
  // Extract radio labels to Node.js
  const options = await page.evaluate((sel) =>
    Array.from(document.querySelectorAll(sel)).map((radio, idx) => {
      const r = radio as HTMLInputElement;
      let text = '';
      if (r.id) {
        const lbl = document.querySelector('label[for="' + r.id + '"]');
        if (lbl) text = lbl.textContent?.trim() ?? '';
      }
      if (!text) { const cl = r.closest('label'); if (cl) text = cl.textContent?.trim() ?? ''; }
      if (!text) text = r.getAttribute('aria-label') ?? r.value ?? '';
      return { index: idx, text, radioId: r.id ?? '' };
    }),
  radioSelector) as Array<{ index: number; text: string; radioId: string }>;

  const winner = chooseBestOption(options.map((o) => ({ v: String(o.index), t: o.text })), desiredText, profileKey);
  if (!winner) return null;

  const idx = Number(winner.value);
  const opt = options[idx];
  try {
    if (opt.radioId) {
      const labelLoc = page.locator(`label[for="${cssAttr(opt.radioId)}"]`);
      if (await labelLoc.count() > 0) {
        await labelLoc.first().click({ timeout });
        return winner.text;
      }
    }
    await page.locator(radioSelector).nth(idx).click({ timeout });
    return winner.text;
  } catch { return null; }
}

// ─── Resolve virtual exp/edu keys from JSON ───────────────────────────────────

function resolveVirtualKey(key: string, profile: Profile): string | null {
  if (key === 'full_name') {
    const parts = [profile.first_name, profile.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  }
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
  const draftNeeded: string[] = [];

  // Labels that suggest open-ended questions needing a written answer
  const QUESTION_WORDS = /\b(why|how|describe|tell|explain|what|share|elaborate|summary|cover|additional|comments|message|statement)\b/;

  for (const field of fields) {
    const key = field.profileKey;

    // Unmapped — textareas and question-like text fields go to draftNeeded
    if (!key) {
      if (field.type === 'textarea' || (field.type === 'text' && QUESTION_WORDS.test(field.label))) {
        draftNeeded.push(`${field.label} (open-ended — fill manually)`);
      } else {
        skipped.push(`${field.label} — unmapped`);
      }
      continue;
    }

    // EEO — skip unless opt-in is enabled
    if (EEO_KEYS.has(key) && profile.allow_eeo_autofill !== '1') {
      skipped.push(`${field.label} — eeo_disabled`);
      continue;
    }

    // Resolve the value
    let profileValue: string | null = null;
    if (key === 'full_name' || VIRTUAL_EXP_KEYS.has(key) || VIRTUAL_EDU_KEYS.has(key)) {
      profileValue = resolveVirtualKey(key, profile);
    } else {
      const raw = (profile as unknown as Record<string, unknown>)[key];
      profileValue = raw != null && raw !== '' ? String(raw) : null;
    }

    if (!profileValue) {
      skipped.push(`${field.label} — no_profile_value`);
      continue;
    }

    try {
      // ── ARIA combobox (Workday-style custom dropdown) ──────────────────────
      if (field.widgetType === 'combobox') {
        const isBoolean = BOOLEAN_KEYS.has(key);
        const desiredText = isBoolean
          ? (profileValue === 'Yes' || profileValue === 'yes' ? 'Yes' : 'No')
          : profileValue;
        const selected = await fillCombobox(page, field.selector, desiredText, isBoolean, key);
        if (selected) {
          filled.push(`${field.label} → ${selected} [combobox]`);
        } else {
          skipped.push(`${field.label} — low_confidence`);
        }
        continue;
      }

      // ── Radio group (fieldset or role="radiogroup") ───────────────────────
      if (field.widgetType === 'radio_group') {
        const isBoolean = BOOLEAN_KEYS.has(key);
        const desiredText = isBoolean
          ? (profileValue === 'Yes' || profileValue === 'yes' ? 'Yes' : 'No')
          : profileValue;
        const selected = await fillRadioGroup(page, field.selector, desiredText, isBoolean, key);
        if (selected) {
          filled.push(`${field.label} → ${selected} [radio]`);
        } else {
          skipped.push(`${field.label} — low_confidence`);
        }
        continue;
      }

      // ── File upload ───────────────────────────────────────────────────────
      if (field.type === 'file') {
        const fileInput = page.locator(field.selector);
        await fileInput.setInputFiles(profileValue);
        filled.push(`${field.label} (file attached)`);
        continue;
      }

      // ── Bare radio group (radios sharing a name, no formal container) ─────
      if (field.widgetType === 'bare_radio_group') {
        const isBoolean = BOOLEAN_KEYS.has(key);
        const desiredText = isBoolean
          ? (profileValue === 'Yes' || profileValue === 'yes' ? 'Yes' : 'No')
          : profileValue;
        const selected = await fillBareRadioGroup(page, field.selector, desiredText, isBoolean, key);
        if (selected) {
          filled.push(`${field.label} → ${selected} [radio]`);
        } else {
          skipped.push(`${field.label} — low_confidence`);
        }
        continue;
      }

      // ── Native checkbox / radio — skip ────────────────────────────────────
      if (field.type === 'checkbox' || field.type === 'radio') {
        skipped.push(`${field.label} — unsupported_widget`);
        continue;
      }

      // ── Native <select> ───────────────────────────────────────────────────
      if (field.type === 'select') {
        const locator = page.locator(field.selector).first();

        // Boolean yes/no fields — SYNONYM_MAP has entries for all boolean keys
        if (BOOLEAN_KEYS.has(key)) {
          const yesNo = profileValue === 'Yes' || profileValue === 'yes' ? 'Yes' : 'No';
          const selected = await fillSelectYesNo(locator, yesNo, key);
          if (selected) {
            filled.push(`${field.label} → ${selected} [select]`);
          } else {
            skipped.push(`${field.label} — low_confidence`);
          }
          continue;
        }

        // General smart select
        const selected = await fillSelectSmart(locator, profileValue, key);
        if (selected) {
          filled.push(`${field.label} → ${selected} [select]`);
        } else {
          skipped.push(`${field.label} — low_confidence`);
        }
        continue;
      }

      // ── Text / email / tel / url / textarea ───────────────────────────────
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

  return { filled, skipped, draftNeeded, total: fields.length };
}
