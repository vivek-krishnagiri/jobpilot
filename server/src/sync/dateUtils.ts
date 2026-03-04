const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a "Month Day" date string (e.g. "Mar 03", "Feb 28") into an ISO timestamp.
 * Uses the current year; if the result would be more than 1 day in the future,
 * uses the previous year (handles December→January year-rollover).
 */
export function parseDatePosted(raw: string): string | null {
  const clean = raw.trim();
  const match = clean.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!match) return null;

  const month = MONTH_MAP[match[1].toLowerCase()];
  if (month === undefined) return null;

  const day = parseInt(match[2], 10);
  const now = new Date();
  let year = now.getFullYear();

  let d = new Date(Date.UTC(year, month, day));
  // If the computed date is more than 1 day in the future, it must be last year
  if (d.getTime() > now.getTime() + 86_400_000) {
    year -= 1;
    d = new Date(Date.UTC(year, month, day));
  }

  return d.toISOString();
}

/**
 * Parse SimplifyJobs "Age" field: "0d", "3d", "15d" → ISO timestamp.
 * Returns (now - N days) as an ISO string.
 */
export function parseAgeField(raw: string): string | null {
  const match = raw.trim().toLowerCase().match(/^(\d+)d$/);
  if (!match) return null;

  const days = parseInt(match[1], 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Returns true if the given ISO date is within the last N days.
 */
export function isWithinDays(isoDate: string | null, days: number): boolean {
  if (!isoDate) return false;
  try {
    const d = new Date(isoDate);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return d.getTime() >= cutoff.getTime();
  } catch {
    return false;
  }
}
