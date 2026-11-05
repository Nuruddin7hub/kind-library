/** K/IND — shared types, subject data, and helpers (ChatGPT Round A, 2026-11-03).
 *  Subjects are the SINGLE SOURCE OF TRUTH for counts: every sidebar count,
 *  chip count, subject card count and library header count must be computed
 *  via getSubjectCounts(files) — never hardcoded separately.
 */

export interface LibFile {
  key: string;
  subj: string;
  title: string;
  section: string;
  file: string;
  pages: number;
}

/** Full-text search hit (matches backend /api/search shape). */
export interface SearchHit {
  key: string;
  subj: string;
  title: string;
  section: string;
  file?: string;
  pages: number;
  kind?: 'title' | 'text';
  page?: number;
  excerpt?: string;
  match_count?: number;
  match_kinds?: Array<'title' | 'text' | 'subject'>;
  passages?: Array<{ page_number: number; snippet: string; match_count: number }>;
}

/** Match types for a search hit — backend match_kinds, falling back to kind. */
export function matchKindsOf(f: SearchHit): Array<'title' | 'text' | 'subject'> {
  if (f.match_kinds && f.match_kinds.length) return f.match_kinds;
  return [f.kind === 'text' ? 'text' : 'title'];
}

/** Honest match score for the % badge: exact title = 98, title contains = 90,
 *  full-text scales with match count (70–88), subject-only = 72. */
export function matchScore(f: SearchHit, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  const kinds = matchKindsOf(f);
  if (kinds.includes('title')) {
    return f.title.toLowerCase() === q ? 98 : 90;
  }
  if (kinds.includes('text')) {
    const n = typeof f.match_count === 'number' ? f.match_count : 1;
    return Math.min(88, 70 + Math.min(n, 18));
  }
  return 72;
}

/** Honest match-type label for a search hit (2026-11-05 honesty fix).
 *  The backend does NOT compute similarity scores, so the UI must never
 *  show fabricated "96%" style percentages. These labels describe the
 *  real match type the backend reported. */
export function matchKindLabel(f: SearchHit, rawQuery: string): string {
  const q = rawQuery.trim().toLowerCase();
  const kinds = matchKindsOf(f);
  if (kinds.includes('title')) {
    return f.title.toLowerCase() === q ? 'EXACT TITLE MATCH' : 'TITLE MATCH';
  }
  if (kinds.includes('text')) {
    const n = typeof f.match_count === 'number' ? f.match_count : 1;
    return `TEXT MATCH · ${n} HIT${n === 1 ? '' : 'S'}`;
  }
  return 'SUBJECT MATCH';
}

/** Human-readable match reason for a hit. */
export function matchReason(f: SearchHit, rawQuery: string): string {
  const q = rawQuery.trim().toLowerCase();
  const kinds = matchKindsOf(f);
  if (kinds.includes('title')) {
    return f.title.toLowerCase() === q ? 'Exact title match' : 'Title match';
  }
  if (kinds.includes('text')) {
    const n = typeof f.match_count === 'number' ? f.match_count : 1;
    return `Full-text match · ${n} hit${n === 1 ? '' : 's'}`;
  }
  return 'Subject match';
}

/** Page the reader should open at for a hit: best text-match page, else 1. */
export function hitOpenPage(f: SearchHit): number {
  return f.passages?.[0]?.page_number || f.page || 1;
}

export interface Subject {
  id: string;
  num: string;      // "01"–"04"
  code: string;     // EM2 / SIGNALS / FIS / DIGITAL
  name: string;     // Engineering Mathematics II …
  short: string;    // Mathematics / Signal Analysis / Foundations of Ideas / Logic & Circuits
  tagline: string;
  color: string;
}

/** The four disciplines. Subject identity tokens — ChatGPT Round A 2026-11-03:
 *  subject colors are the primary visual differentiation (NOT blue-everywhere). */
export const SUBJECTS: Subject[] = [
  { id: 'em2',     num: '01', code: 'EM2',     name: 'Engineering Mathematics II', short: 'Mathematics',           tagline: 'Equations. Transforms. Proofs.', color: '#719AFF' },
  { id: 'signals', num: '02', code: 'SIGNALS', name: 'Signals & Systems',          short: 'Signal Analysis',       tagline: 'Frequency. Time. Response.',     color: '#B38AFF' },
  { id: 'fis',     num: '03', code: 'FIS',     name: 'Philosophy',                 short: 'Foundations of Ideas',  tagline: 'Ideas. Arguments. Meaning.',     color: '#E6B36C' },
  { id: 'digital', num: '04', code: 'DIGITAL', name: 'Digital Electronics',        short: 'Logic & Circuits',      tagline: 'Logic. Circuits. Systems.',      color: '#38D5C1' },
];

export function subjectOf(id: string): Subject | undefined {
  return SUBJECTS.find(s => s.id === id);
}

/** OBSIDIAN ATLAS palette (ChatGPT Round A desktop redesign, 2026-11-05).
 *  DESKTOP ONLY — mobile views keep the legacy SUBJECTS colors above
 *  byte-identical, so desktop components must use v2SubjectColor() while
 *  every mobile component keeps reading SUBJECTS[].color.
 *  Spec tokens: EM2 #59E4D2 · Signals #80A8FF · FIS #E6AD65 · Digital #69D7A8. */
export const V2_SUBJECT_COLORS: Record<string, string> = {
  em2: '#59E4D2',
  signals: '#80A8FF',
  fis: '#E6AD65',
  digital: '#69D7A8',
};

/** Desktop (v2.0) subject color — the exact spec identity tokens. */
export function v2SubjectColor(id: string): string {
  return V2_SUBJECT_COLORS[id] ?? subjectOf(id)?.color ?? '#929DAE';
}

/** Single source of truth for counts. Expected: EM2 21, Signals 47, FIS 4, Digital 28. */
export function getSubjectCounts(files: LibFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of SUBJECTS) counts[s.id] = 0;
  for (const f of files) {
    if (f.subj in counts) counts[f.subj] += 1;
  }
  return counts;
}

export const SECTION_LABELS: Record<string, string> = {
  'lectures': 'Lecture Notes',
  'tutorials': 'Tutorials',
  'labs': 'Labs',
  'exams': 'Past Exams',
  'tests': 'Past Tests',
  'assignments': 'Assignments',
  'info': 'Course Info',
  'links': 'Videos & Links',
  'lecture-notes': 'Lecture Notes',
  'past-exams': 'Past Exams',
  'past-tests': 'Past Tests',
  'course-info': 'Course Info',
  'videos-links': 'Videos & Links',
};

export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] || section;
}

export function fileKey(f: { subj: string; section: string; file: string }): string {
  return `${f.subj}::${f.section}::${f.file}`;
}

/** Page preview image — REAL server-rendered PDF page image (never generic artwork).
 *  Mirrors PdfReader's pageImageUrl. */
export function pageImageUrl(subj: string, file: string, page: number, totalPages: number): string {
  const stem = file.replace(/\.pdf$/i, '');
  const digits = String(totalPages).length;
  const nn = String(page).padStart(digits, '0');
  return `/assets/pages/${subj}/${stem}/p-${nn}.jpg`;
}

/** Relative "opened 2h ago" for kl:recentTs timestamps. */
export function relTime(ts: number | null): string {
  if (!ts) return 'earlier';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Saved reading position key (matches PdfReader: kl:pos:<fileKey>). */
export function posKey(key: string): string {
  return `kl:pos:${key}`;
}

/** localStorage read helpers (defensive). */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
