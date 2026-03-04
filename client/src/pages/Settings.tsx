import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { ApplicantProfile } from '../types';
import { fetchProfile, saveProfile, uploadResume, uploadCoverLetter } from '../api/profile';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpItem {
  company: string;
  title: string;
  start_month: string;
  start_year: string;
  end_month: string;
  end_year: string;
  current: boolean;
}

interface EduItem {
  school: string;
  degree: string;
  field_of_study: string;
  start_year: string;
  end_year: string;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';
interface Toast { kind: ToastKind; message: string }

function ToastBanner({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles: Record<ToastKind, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    error:   'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={clsx('flex items-center justify-between px-4 py-2.5 border-b text-sm font-medium', styles[toast.kind])}>
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-4 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

// ─── AccordionSection ─────────────────────────────────────────────────────────

function AccordionSection({
  title, children, defaultOpen = false, borderColor = 'border-gray-200',
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; borderColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={clsx('border rounded-xl overflow-hidden', borderColor)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/60 hover:bg-gray-100/60 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <svg
          className={clsx('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Field components ─────────────────────────────────────────────────────────

function Field({
  label, type = 'text', value, onChange, placeholder,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, children,
}: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
      >
        {children}
      </select>
    </div>
  );
}

// ─── Upload row ───────────────────────────────────────────────────────────────

function UploadRow({
  label, filename, onUpload, uploading, accept,
}: {
  label: string; filename: string | null; onUpload: (f: File) => void;
  uploading: boolean; accept: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 flex-1 min-w-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {filename ? `Uploaded: ${filename.split('/').pop()}` : `No ${label.toLowerCase()} uploaded`}
        </p>
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); if (ref.current) ref.current.value = ''; } }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors shrink-0',
          uploading
            ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-white'
            : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50 bg-white',
        )}
      >
        {uploading ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Uploading…
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
            </svg>
            Upload
          </>
        )}
      </button>
    </div>
  );
}

// ─── Experience list editor ───────────────────────────────────────────────────

function ExpEditor({ items, onChange }: { items: ExpItem[]; onChange: (items: ExpItem[]) => void }) {
  const empty = (): ExpItem => ({ company: '', title: '', start_month: '', start_year: '', end_month: '', end_year: '', current: false });
  const update = (i: number, patch: Partial<ExpItem>) =>
    onChange(items.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 relative">
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-sm leading-none"
            title="Remove"
          >×</button>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Company" value={item.company} onChange={(v) => update(i, { company: v })} placeholder="Acme Corp" />
            <Field label="Job Title" value={item.title} onChange={(v) => update(i, { title: v })} placeholder="Software Engineer" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Start MM" value={item.start_month} onChange={(v) => update(i, { start_month: v })} placeholder="01" />
            <Field label="Start YYYY" value={item.start_year} onChange={(v) => update(i, { start_year: v })} placeholder="2022" />
            <Field label="End MM" value={item.end_month} onChange={(v) => update(i, { end_month: v })} placeholder="06" />
            <Field label="End YYYY" value={item.end_year} onChange={(v) => update(i, { end_year: v })} placeholder="2024" />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={item.current}
              onChange={(e) => update(i, { current: e.target.checked })}
              className="rounded"
            />
            Currently in this role
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, empty()])}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Add position
      </button>
    </div>
  );
}

// ─── Education list editor ────────────────────────────────────────────────────

function EduEditor({ items, onChange }: { items: EduItem[]; onChange: (items: EduItem[]) => void }) {
  const empty = (): EduItem => ({ school: '', degree: '', field_of_study: '', start_year: '', end_year: '' });
  const update = (i: number, patch: Partial<EduItem>) =>
    onChange(items.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 relative">
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-sm leading-none"
            title="Remove"
          >×</button>
          <Field label="School / University" value={item.school} onChange={(v) => update(i, { school: v })} placeholder="MIT" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Degree" value={item.degree} onChange={(v) => update(i, { degree: v })} placeholder="Bachelor of Science" />
            <Field label="Field of Study" value={item.field_of_study} onChange={(v) => update(i, { field_of_study: v })} placeholder="Computer Science" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Year" value={item.start_year} onChange={(v) => update(i, { start_year: v })} placeholder="2020" />
            <Field label="End Year" value={item.end_year} onChange={(v) => update(i, { end_year: v })} placeholder="2024" />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, empty()])}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Add education
      </button>
    </div>
  );
}

// ─── My Profile section ───────────────────────────────────────────────────────

function ProfileSection() {
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [draft, setDraft]     = useState<Partial<ApplicantProfile>>({});
  const [expItems, setExpItems] = useState<ExpItem[]>([]);
  const [eduItems, setEduItems] = useState<EduItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingCover, setUploadingCover]   = useState(false);
  const [toast, setToast]     = useState<Toast | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setProfile(p);
        setDraft(p);
        try { setExpItems(JSON.parse(p.experience_json ?? '[]') as ExpItem[]); } catch { setExpItems([]); }
        try { setEduItems(JSON.parse(p.education_json ?? '[]') as EduItem[]); } catch { setEduItems([]); }
      })
      .catch(() => setToast({ kind: 'error', message: 'Failed to load profile' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const f = (key: keyof ApplicantProfile) => ({
    value: String(draft[key] ?? ''),
    onChange: (v: string) => setDraft((p) => ({ ...p, [key]: v })),
  });

  const sel = (key: keyof ApplicantProfile) => ({
    value: String(draft[key] ?? ''),
    onChange: (v: string) => setDraft((p) => ({ ...p, [key]: v })),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await saveProfile({
        ...draft,
        experience_json: JSON.stringify(expItems),
        education_json: JSON.stringify(eduItems),
      });
      setProfile(updated);
      setDraft(updated);
      setToast({ kind: 'success', message: 'Profile saved.' });
    } catch (err: unknown) {
      setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    } finally { setSaving(false); }
  };

  const handleResumeUpload = async (file: File) => {
    setUploadingResume(true);
    try {
      const { profile: updated, extracted } = await uploadResume(file);
      setProfile(updated); setDraft(updated);
      try { setExpItems(JSON.parse(updated.experience_json ?? '[]') as ExpItem[]); } catch { /* keep existing */ }
      try { setEduItems(JSON.parse(updated.education_json ?? '[]') as EduItem[]); } catch { /* keep existing */ }
      const n = Object.keys(extracted).length;
      setToast({ kind: 'success', message: `Resume uploaded. ${n} field${n === 1 ? '' : 's'} auto-filled.` });
    } catch (err: unknown) {
      setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
    } finally { setUploadingResume(false); }
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const { profile: updated } = await uploadCoverLetter(file);
      setProfile(updated); setDraft(updated);
      setToast({ kind: 'success', message: 'Cover letter uploaded.' });
    } catch (err: unknown) {
      setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
    } finally { setUploadingCover(false); }
  };

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  const eeoEnabled = String(draft.allow_eeo_autofill ?? '0') === '1';

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {toast && <ToastBanner toast={toast} onDismiss={() => setToast(null)} />}

      <div className="px-6 pt-5 pb-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">My Profile</h2>
        <p className="text-xs text-gray-500 mt-0.5">Used to autofill job application forms.</p>
      </div>

      <div className="px-6 py-5 space-y-4">

        {/* Documents row */}
        <div className="flex gap-3">
          <UploadRow
            label="Resume"
            filename={profile?.resume_file_path ?? null}
            onUpload={handleResumeUpload}
            uploading={uploadingResume}
            accept=".pdf,.doc,.docx"
          />
          <UploadRow
            label="Cover Letter"
            filename={profile?.cover_letter_file_path ?? null}
            onUpload={handleCoverUpload}
            uploading={uploadingCover}
            accept=".pdf,.doc,.docx,.txt"
          />
        </div>

        {/* Basic Info — always visible */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Basic Info</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" placeholder="Jane" {...f('first_name')} />
            <Field label="Last Name"  placeholder="Smith" {...f('last_name')} />
          </div>
          <Field label="Preferred Name (optional)" placeholder="Jay" {...f('preferred_name')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" type="email" placeholder="jane@example.com" {...f('email')} />
            <Field label="Phone" type="tel"   placeholder="+1 555 123 4567"  {...f('phone')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Secondary Email (optional)" type="email" placeholder="jane@alt.com" {...f('email_secondary')} />
            <Field label="Secondary Phone (optional)" type="tel"   placeholder="+1 555 999 0000" {...f('phone_secondary')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country" placeholder="United States" {...f('country')} />
            <SelectField label="Phone Type" {...sel('phone_type')}>
              <option value="mobile">Mobile</option>
              <option value="home">Home</option>
              <option value="work">Work</option>
            </SelectField>
          </div>
          <SelectField label="Preferred Browser" {...sel('preferred_browser')}>
            <option value="chromium">Chromium (default)</option>
            <option value="chrome">Google Chrome</option>
            <option value="msedge">Microsoft Edge</option>
            <option value="webkit">WebKit (Safari-like)</option>
          </SelectField>
          <p className="text-xs text-gray-400 -mt-2">Browser used when opening job application pages.</p>
          <Field label="LinkedIn URL"        placeholder="https://linkedin.com/in/janesmith" {...f('linkedin_url')} />
          <Field label="Website / Portfolio" placeholder="https://janesmith.dev"             {...f('website_url')} />
        </div>

        {/* Address */}
        <AccordionSection title="Address">
          <Field label="Address Line 1" placeholder="123 Main St" {...f('address_line1')} />
          <Field label="Address Line 2 (optional)" placeholder="Apt 4B" {...f('address_line2')} />
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Field label="City" placeholder="San Francisco" {...f('city')} />
            </div>
            <div className="col-span-1">
              <Field label="State / Region" placeholder="CA" {...f('state_region')} />
            </div>
            <div className="col-span-1">
              <Field label="ZIP / Postal Code" placeholder="94102" {...f('postal_code')} />
            </div>
          </div>
        </AccordionSection>

        {/* Work Authorization */}
        <AccordionSection title="Work Authorization">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Legally Authorized to Work in US?" {...sel('legally_authorized')}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </SelectField>
            <SelectField label="Require Sponsorship Now or Future?" {...sel('requires_sponsorship')}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </SelectField>
          </div>
          <Field label="Country of Work Authorization" placeholder="United States" {...f('work_authorization_country')} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Willing to Relocate?" {...sel('willing_to_relocate')}>
              <option value="">— not set —</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </SelectField>
            <Field label="Earliest Start Date (optional)" placeholder="2025-06-01" {...f('available_start_date')} />
          </div>
        </AccordionSection>

        {/* Referral & History */}
        <AccordionSection title="Referral & History">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Referred by Current Employee?" {...sel('referred_by_employee')}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </SelectField>
            <Field label="Referrer Name (if yes)" placeholder="John Doe" {...f('referrer_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Previously Worked in EdTech?" {...sel('worked_in_edtech')}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </SelectField>
            <Field label="EdTech Employer (if yes)" placeholder="Khan Academy" {...f('edtech_employer')} />
          </div>
          <SelectField label="Previously Worked at Renaissance Learning?" {...sel('previously_worked_renaissance')}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </SelectField>
        </AccordionSection>

        {/* Employment History */}
        <AccordionSection title="Employment History">
          <p className="text-xs text-gray-500">The first entry is used to autofill employer/title fields on application forms.</p>
          <ExpEditor items={expItems} onChange={setExpItems} />
        </AccordionSection>

        {/* Education */}
        <AccordionSection title="Education">
          <p className="text-xs text-gray-500">The first entry is used to autofill school/degree/major fields on application forms.</p>
          <EduEditor items={eduItems} onChange={setEduItems} />
        </AccordionSection>

        {/* Voluntary EEO */}
        <AccordionSection title="Voluntary EEO / Self-Identification" borderColor="border-amber-200">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
            These fields are <strong>entirely optional</strong>. Autofill for EEO fields is disabled by default. Enable it below only if you want JobPilot to fill demographic questions automatically. You are always in control.
          </p>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={eeoEnabled}
              onChange={(e) => setDraft((p) => ({ ...p, allow_eeo_autofill: e.target.checked ? '1' : '0' }))}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">Enable EEO autofill</span>
          </label>

          {eeoEnabled && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Gender" {...sel('eeo_gender')}>
                  <option value="">— prefer not to answer —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="I prefer not to say">I prefer not to say</option>
                </SelectField>
                <SelectField label="Race / Ethnicity" {...sel('eeo_race_ethnicity')}>
                  <option value="">— prefer not to answer —</option>
                  <option value="Asian">Asian</option>
                  <option value="Black or African American">Black or African American</option>
                  <option value="Hispanic or Latino">Hispanic or Latino</option>
                  <option value="White">White</option>
                  <option value="Two or More Races">Two or More Races</option>
                  <option value="Native Hawaiian or Pacific Islander">Native Hawaiian or Pacific Islander</option>
                  <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                  <option value="I prefer not to say">I prefer not to say</option>
                </SelectField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Veteran Status" {...sel('eeo_veteran')}>
                  <option value="">— prefer not to answer —</option>
                  <option value="I am not a veteran">I am not a veteran</option>
                  <option value="I am a veteran">I am a veteran</option>
                  <option value="I prefer not to say">I prefer not to say</option>
                </SelectField>
                <SelectField label="Disability Status" {...sel('eeo_disability')}>
                  <option value="">— prefer not to answer —</option>
                  <option value="No, I don't have a disability">No, I don't have a disability</option>
                  <option value="Yes, I have a disability">Yes, I have a disability</option>
                  <option value="I prefer not to say">I prefer not to say</option>
                </SelectField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Sexual Orientation" {...sel('eeo_sexual_orientation')}>
                  <option value="">— prefer not to answer —</option>
                  <option value="Heterosexual / Straight">Heterosexual / Straight</option>
                  <option value="Gay or Lesbian">Gay or Lesbian</option>
                  <option value="Bisexual">Bisexual</option>
                  <option value="I prefer not to say">I prefer not to say</option>
                </SelectField>
                <SelectField label="Transgender" {...sel('eeo_transgender')}>
                  <option value="">— prefer not to answer —</option>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                  <option value="I prefer not to say">I prefer not to say</option>
                </SelectField>
              </div>
            </div>
          )}
        </AccordionSection>

      </div>

      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
        {profile?.updated_at && (
          <span className="text-xs text-gray-400">Last saved {new Date(profile.updated_at).toLocaleString()}</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ml-auto',
            saving ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700',
          )}
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-xl space-y-6">

          <ProfileSection />

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Job Sources</h2>
            <p className="text-xs text-gray-500 mb-4">Configure where JobPilot discovers new job postings.</p>
            <div className="space-y-2">
              {[
                { label: 'SimplifyJobs New Grad Positions', active: true },
                { label: 'Jobright 2026 SWE New Grad',     active: true },
                { label: 'Greenhouse ATS',                  active: false },
                { label: 'Lever ATS',                       active: false },
                { label: 'Manual link import',              active: false },
              ].map((src) => (
                <div key={src.label} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <span className="text-sm text-gray-700">{src.label}</span>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full border',
                    src.active
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-gray-400 bg-white border-gray-200',
                  )}>
                    {src.active ? 'Active' : 'Coming soon'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Apply Assist</h2>
            <p className="text-xs text-gray-500 mb-2">
              Human-in-the-loop autofill. Fills what it can, pauses for manual input on
              company-specific questions. Forms are <strong>never</strong> submitted automatically.
            </p>
            <p className="text-xs text-indigo-600 font-medium">Active · Phase 3.7</p>
          </section>

        </div>
      </div>
    </div>
  );
}
