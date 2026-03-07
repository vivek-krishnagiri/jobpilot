export type WorkModel = 'Remote' | 'Hybrid' | 'On-site';
export type JobSource = 'GitHub' | 'ATS' | 'Manual' | 'Greenhouse' | 'Lever';
export type SortBy = 'newest_posted' | 'newest_discovered' | 'company_az';
export type PostedAge = '1d' | '3d' | '1w' | '1m';

export interface JobPosting {
  id: number;
  source: string;
  url: string;
  company: string;
  title: string;
  location: string;
  work_model: WorkModel;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  active_flag: boolean;
  applied_flag: boolean;
  applied_at: string | null;
  notes: string | null;
}

export interface FilterState {
  search: string;
  postedAge: PostedAge | '';
  workModel: WorkModel | '';
  location: string;
  company: string;
  source: JobSource | '';
  activeOnly: boolean;
  sortBy: SortBy;
}

// ─── Applicant Profile ────────────────────────────────────────────────────────

export interface ApplicantProfile {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  country: string;
  linkedin_url: string;
  website_url: string;
  resume_file_path: string | null;
  resume_text: string | null;
  education_json: string;
  experience_json: string;
  preferred_browser: string;
  updated_at: string;
  // Phase 3.7 — address
  address_line1: string;
  address_line2: string;
  city: string;
  state_region: string;
  postal_code: string;
  phone_type: string;
  phone_secondary: string;
  email_secondary: string;
  // Work authorization
  legally_authorized: string;
  requires_sponsorship: string;
  work_authorization_country: string;
  willing_to_relocate: string;
  available_start_date: string;
  // Referral / history
  referred_by_employee: string;
  referrer_name: string;
  worked_in_edtech: string;
  edtech_employer: string;
  previously_worked_renaissance: string;
  // EEO (opt-in)
  allow_eeo_autofill: string;
  eeo_gender: string;
  eeo_race_ethnicity: string;
  eeo_sexual_orientation: string;
  eeo_transgender: string;
  eeo_disability: string;
  eeo_veteran: string;
  // Documents
  cover_letter_file_path: string | null;
}

// ─── Apply Session ────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'created'
  | 'opening'
  | 'open'
  | 'form_detected'
  | 'filling'
  | 'filled'
  | 'error'
  | 'closed';

export interface ApplySession {
  id: number;
  job_id: number;
  job_url: string;
  status: SessionStatus;
  detected_fields_json: string | null;
  fill_result_json: string | null;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

export interface FillResult {
  filled: string[];
  skipped: string[];
  draftNeeded: string[];
  total: number;
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  postedAge: '',
  workModel: '',
  location: '',
  company: '',
  source: '',
  activeOnly: true,
  sortBy: 'newest_posted',
};
