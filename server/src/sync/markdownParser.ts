export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Strip all markdown/HTML formatting and return plain text from a cell.
 * Handles: **bold**, [text](url), [![alt](img)](url), <details>…</details>, HTML tags.
 */
export function cellText(cell: string): string {
  return cell
    .replace(/\[!\[.*?\]\(.*?\)\]\([^)]*\)/g, '')  // image links [![alt](img)](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')         // [text](url) → text
    .replace(/<details>[\s\S]*?<\/details>/gi, '')    // <details> blocks
    .replace(/<[^>]+>/g, ' ')                         // remaining HTML tags
    .replace(/\*\*/g, '')                             // bold **
    .replace(/\*/g, '')                               // italic *
    .replace(/↳/g, '')                               // continuation symbol
    .replace(/[🔥🎓💼🌟⭐🔒🚀]/gu, '')               // decorative emoji
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Extract the first https URL from a table cell.
 * Priority: (1) outer URL of image link [![alt](img)](url)
 *           (2) URL of text link [text](url)
 *           (3) HTML anchor href="..."
 *           (4) bare https://… URL
 */
export function cellUrl(cell: string): string | null {
  // Image link: [![alt](img)](url)
  const imgLink = cell.match(/\[!\[.*?\]\([^)]*\)\]\((https?:\/\/[^)\s]+)\)/);
  if (imgLink) return imgLink[1].trim();

  // Text link: [text](url)
  const textLink = cell.match(/\[.*?\]\((https?:\/\/[^)\s]+)\)/);
  if (textLink) return textLink[1].trim();

  // HTML anchor: <a href="...">
  const hrefLink = cell.match(/<a\s+[^>]*href="(https?:\/\/[^"]+)"/i);
  if (hrefLink) return hrefLink[1].trim();

  // Bare URL (stop at quotes too)
  const bare = cell.match(/https?:\/\/[^\s|>)"]+/);
  if (bare) return bare[0].trim();

  return null;
}

/**
 * Extract location from a cell, unwrapping <details> if present.
 * For multi-location <details> blocks, returns the first 1-2 locations.
 */
export function cellLocation(cell: string): string {
  // <details><summary>N locations</summary>City1<br/>City2<br/>…</details>
  const detailsMatch = cell.match(/<details>[\s\S]*?<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/i);
  if (detailsMatch) {
    const body = detailsMatch[2]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    const locs = body.split('\n').map((s) => s.trim()).filter(Boolean);
    if (locs.length === 0) return detailsMatch[1].trim();
    if (locs.length <= 2) return locs.join(', ');
    return `${locs[0]}, ${locs[1]} +${locs.length - 2}`;
  }
  return cellText(cell);
}

/**
 * Check if a line is a markdown table separator row (| --- | --- |).
 */
function isSeparator(line: string): boolean {
  return /^\|?[\s|:\-]+\|?$/.test(line.trim()) && line.includes('-');
}

/**
 * Split a table row on unescaped pipe characters.
 * Strips leading/trailing pipes, trims each cell.
 */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

/**
 * Parse all markdown tables from a README string.
 * Returns an array of {headers, rows} objects.
 */
export function parseMarkdownTables(content: string): ParsedTable[] {
  const lines = content.split('\n');
  const tables: ParsedTable[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim().startsWith('|')) {
      i++;
      continue;
    }

    // Confirm the next line is a separator
    if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2; // skip header + separator

      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = splitRow(lines[i]);
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
        i++;
      }

      if (headers.length > 1) {
        tables.push({ headers, rows });
      }
    } else {
      i++;
    }
  }

  return tables;
}

/**
 * Find the index of a column by trying several candidate header names.
 * Comparison is case-insensitive and strips markdown formatting.
 */
export function findCol(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map((h) => cellText(h).toLowerCase().trim());
  for (const c of candidates) {
    const idx = normalized.indexOf(c.toLowerCase().trim());
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Infer work model from location text and an optional explicit work-model column value.
 */
export function inferWorkModel(
  explicitValue: string | null,
  locationText: string,
): 'Remote' | 'Hybrid' | 'On-site' {
  const check = (s: string) => s.toLowerCase();

  if (explicitValue) {
    const v = check(explicitValue.trim());
    if (v === 'remote') return 'Remote';
    if (v === 'hybrid') return 'Hybrid';
    if (v === 'on site' || v === 'on-site' || v === 'onsite') return 'On-site';
  }

  const loc = check(locationText);
  if (loc.includes('remote')) return 'Remote';
  if (loc.includes('hybrid')) return 'Hybrid';
  return 'On-site';
}

/**
 * Parse all HTML tables from a README string.
 * Handles <table><thead><th>…</th></thead><tbody><tr><td>…</td></tr></tbody></table>.
 * Returns the same ParsedTable format as parseMarkdownTables().
 */
export function parseHtmlTables(content: string): ParsedTable[] {
  const tables: ParsedTable[] = [];

  // Match each <table>…</table> block (non-greedy, case-insensitive)
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(content)) !== null) {
    const tableHtml = tableMatch[0];

    // Extract header cells from <th> tags (first occurrence of each)
    const headers: string[] = [];
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch: RegExpExecArray | null;
    while ((thMatch = thRegex.exec(tableHtml)) !== null) {
      headers.push(thMatch[1].trim());
    }

    if (headers.length <= 1) continue;

    // Extract data rows — each <tr> that contains <td> tags
    const rows: string[][] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;

    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const rowHtml = trMatch[1];
      if (rowHtml.includes('<th')) continue; // skip header rows

      const cells: string[] = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1].trim());
      }

      if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) {
      tables.push({ headers, rows });
    }
  }

  return tables;
}
