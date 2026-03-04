import type { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import db from '../db/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileRow {
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

interface ProfileBody {
  first_name?: string;
  last_name?: string;
  preferred_name?: string;
  email?: string;
  phone?: string;
  country?: string;
  linkedin_url?: string;
  website_url?: string;
  education_json?: string;
  experience_json?: string;
  preferred_browser?: string;
  // Phase 3.7 — address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_region?: string;
  postal_code?: string;
  phone_type?: string;
  phone_secondary?: string;
  email_secondary?: string;
  // Work authorization
  legally_authorized?: string;
  requires_sponsorship?: string;
  work_authorization_country?: string;
  willing_to_relocate?: string;
  available_start_date?: string;
  // Referral / history
  referred_by_employee?: string;
  referrer_name?: string;
  worked_in_edtech?: string;
  edtech_employer?: string;
  previously_worked_renaissance?: string;
  // EEO (opt-in)
  allow_eeo_autofill?: string;
  eeo_gender?: string;
  eeo_race_ethnicity?: string;
  eeo_sexual_orientation?: string;
  eeo_transgender?: string;
  eeo_disability?: string;
  eeo_veteran?: string;
}

// ─── Resume directory ─────────────────────────────────────────────────────────

const RESUME_DIR = path.resolve(process.cwd(), 'data', 'resumes');
if (!fs.existsSync(RESUME_DIR)) fs.mkdirSync(RESUME_DIR, { recursive: true });

// ─── Resume text extraction ───────────────────────────────────────────────────

async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.pdf') {
    // pdf-parse is CommonJS; dynamic require avoids ESM interop issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (ext === '.docx' || ext === '.doc') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return '';
}

// ─── Heuristic field extraction from resume text ──────────────────────────────

interface ExtractedFields {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  website_url?: string;
}

function extractFieldsFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // Email
  const emailMatch = text.match(/[\w.+\-]+@[\w\-]+\.[a-z]{2,}/i);
  if (emailMatch) fields.email = emailMatch[0];

  // Phone — US/international formats
  const phoneMatch = text.match(/(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
  if (phoneMatch) fields.phone = phoneMatch[0].trim();

  // LinkedIn URL
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w\-]+/i);
  if (linkedinMatch) fields.linkedin_url = `https://www.${linkedinMatch[0]}`;

  // Website (non-LinkedIn)
  const websiteMatch = text.match(/https?:\/\/(?!(?:www\.)?linkedin\.com)[\w.\-]+\.[a-z]{2,}[^\s]*/i);
  if (websiteMatch) fields.website_url = websiteMatch[0];

  // Name — heuristic: look in first 8 lines for "FirstName LastName"
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    const nameMatch = line.match(/^([A-Z][a-zA-Z\-]{1,20})\s+([A-Z][a-zA-Z\-]{1,30})(?:\s+[A-Z][a-zA-Z\-]{1,30})?$/);
    if (nameMatch && !emailMatch?.[0].includes(nameMatch[1].toLowerCase())) {
      fields.first_name = nameMatch[1];
      fields.last_name = nameMatch[2];
      break;
    }
  }

  return fields;
}

// ─── Ensure singleton profile row exists ──────────────────────────────────────

function ensureProfile(): ProfileRow {
  const existing = db
    .prepare('SELECT * FROM applicant_profile WHERE id = 1')
    .get() as unknown as ProfileRow | undefined;

  if (!existing) {
    db.prepare('INSERT INTO applicant_profile (id, updated_at) VALUES (1, ?)').run(new Date().toISOString());
  }

  return db.prepare('SELECT * FROM applicant_profile WHERE id = 1').get() as unknown as ProfileRow;
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function profileRoutes(fastify: FastifyInstance) {

  // GET /api/profile
  fastify.get('/profile', async (_req, reply) => {
    reply.send(ensureProfile());
  });

  // PUT /api/profile
  fastify.put<{ Body: ProfileBody }>('/profile', async (request, reply) => {
    ensureProfile();
    const now = new Date().toISOString();
    const allowed = [
      'first_name', 'last_name', 'preferred_name', 'email', 'phone',
      'country', 'linkedin_url', 'website_url', 'education_json', 'experience_json',
      'preferred_browser',
      // Phase 3.7
      'address_line1', 'address_line2', 'city', 'state_region', 'postal_code',
      'phone_type', 'phone_secondary', 'email_secondary',
      'legally_authorized', 'requires_sponsorship', 'work_authorization_country',
      'willing_to_relocate', 'available_start_date',
      'referred_by_employee', 'referrer_name', 'worked_in_edtech', 'edtech_employer',
      'previously_worked_renaissance',
      'allow_eeo_autofill', 'eeo_gender', 'eeo_race_ethnicity', 'eeo_sexual_orientation',
      'eeo_transgender', 'eeo_disability', 'eeo_veteran',
    ] as const;

    const setClauses: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    for (const key of allowed) {
      if (request.body[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(request.body[key]);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepare(`UPDATE applicant_profile SET ${setClauses.join(', ')} WHERE id = 1`).run(...(params as any[]));

    reply.send(db.prepare('SELECT * FROM applicant_profile WHERE id = 1').get() as unknown as ProfileRow);
  });

  // POST /api/profile/resume  — multipart file upload
  fastify.post('/profile/resume', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded.' });
    }

    const ext = path.extname(data.filename).toLowerCase();
    if (!['.pdf', '.doc', '.docx'].includes(ext)) {
      return reply.status(400).send({ error: 'Only PDF, DOC, and DOCX files are supported.' });
    }

    // Buffer the upload
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    const buffer = Buffer.concat(chunks);

    // Save to disk
    const savedFilename = `resume_${Date.now()}${ext}`;
    const savedPath = path.join(RESUME_DIR, savedFilename);
    fs.writeFileSync(savedPath, buffer);

    // Extract text
    let resumeText = '';
    try {
      resumeText = await extractTextFromBuffer(buffer, data.filename);
    } catch (err) {
      console.warn('[profile/resume] text extraction failed:', err);
    }

    const extracted = resumeText ? extractFieldsFromText(resumeText) : {};

    // Persist
    const profile = ensureProfile();
    const now = new Date().toISOString();
    const setClauses = ['resume_file_path = ?', 'resume_text = ?', 'updated_at = ?'];
    const params: unknown[] = [savedPath, resumeText, now];

    for (const [key, val] of Object.entries(extracted)) {
      const existing = (profile as unknown as Record<string, unknown>)[key];
      if (val && !existing) { setClauses.push(`${key} = ?`); params.push(val); }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepare(`UPDATE applicant_profile SET ${setClauses.join(', ')} WHERE id = 1`).run(...(params as any[]));

    reply.send({
      profile: db.prepare('SELECT * FROM applicant_profile WHERE id = 1').get() as unknown as ProfileRow,
      extracted,
    });
  });

  // POST /api/profile/cover-letter  — multipart file upload
  fastify.post('/profile/cover-letter', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded.' });
    }

    const ext = path.extname(data.filename).toLowerCase();
    if (!['.pdf', '.doc', '.docx', '.txt'].includes(ext)) {
      return reply.status(400).send({ error: 'Only PDF, DOC, DOCX, and TXT files are supported.' });
    }

    // Buffer the upload
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    const buffer = Buffer.concat(chunks);

    // Save to disk
    const savedFilename = `cover_letter_${Date.now()}${ext}`;
    const savedPath = path.join(RESUME_DIR, savedFilename);
    fs.writeFileSync(savedPath, buffer);

    // Persist path only
    ensureProfile();
    const now = new Date().toISOString();
    db.prepare('UPDATE applicant_profile SET cover_letter_file_path = ?, updated_at = ? WHERE id = 1').run(savedPath, now);

    reply.send({
      profile: db.prepare('SELECT * FROM applicant_profile WHERE id = 1').get() as unknown as ProfileRow,
    });
  });
}
