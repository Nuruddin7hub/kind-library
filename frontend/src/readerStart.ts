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
