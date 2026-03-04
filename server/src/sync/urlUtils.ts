// Parameters that are purely for tracking — strip them from stored URLs
const TRACKING_PARAM_PREFIXES = ['utm_', 'mc_', 'yclid', '_hs'];
const TRACKING_PARAMS_EXACT = new Set([
  'ref', 'referral', 'referrer', 'fbclid', 'gclid', 'msclkid',
  'source', '_hsenc', '_hsmi', 'origin',
]);

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());

    // Lowercase hostname
    u.hostname = u.hostname.toLowerCase();

    // Strip tracking query params
    const toDelete: string[] = [];
    for (const key of u.searchParams.keys()) {
      const lower = key.toLowerCase();
      if (
        TRACKING_PARAMS_EXACT.has(lower) ||
        TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))
      ) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) u.searchParams.delete(key);

    // Remove fragment
    u.hash = '';

    // Remove trailing slash from non-root paths
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}
