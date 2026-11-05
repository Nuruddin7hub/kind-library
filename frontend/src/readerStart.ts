// Pending exact-page opens for the reader (search → open at match page).
// Set before opening the reader; PdfReader consumes it once on mount.
const pending = new Map<string, number>();

export function setReaderStartPage(key: string, page: number) {
  if (page > 0) pending.set(key, page);
}

export function consumeReaderStartPage(key: string): number | null {
  const p = pending.get(key);
  if (p == null) return null;
  pending.delete(key);
  return p;
}

/** Honest match banner payload (Round C, 2026-11-05): the REAL backend
 *  snippet for the page being opened — plain text only. Pages are
 *  server-rendered images (no text layer), so there is no phrase-level
 *  highlight and none is faked; the banner shows the snippet instead.
 *  In-memory only — no kl:* key, no persistence. */
export interface ReaderMatch { page: number; snippet: string; }
const pendingMatch = new Map<string, ReaderMatch>();

export function setReaderMatch(key: string, page: number, snippet: string) {
  if (page > 0 && snippet) pendingMatch.set(key, { page, snippet });
}

export function consumeReaderMatch(key: string): ReaderMatch | null {
  const m = pendingMatch.get(key);
  if (m == null) return null;
  pendingMatch.delete(key);
  return m;
}
