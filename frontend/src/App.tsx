import { useEffect, useMemo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import PdfReader from './components/PdfReader';
import MobileReader from './components/MobileReader';
import Carousel from './bits/Carousel';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, LibraryIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { DocCover, SubjectMotif } from './components/SubjectArtwork';
import SplitText from './components/SplitText';
import FilterPills from './components/FilterPills';
// KIN/D v2.0 — React Bits (ChatGPT critique 2026-11-01 afternoon)
import Aurora from './bits/Aurora';
import SpotlightCard from './bits/SpotlightCard';
import AnimatedList from './bits/AnimatedList';
// ChatGPT round B afternoon (2026-11-02, kindworksmy): K/IND mobile engine
import BlurText from './bits/BlurText';
import MobileDocRow from './components/MobileDocRow';
import MobileSubjectIndex from './components/MobileSubjectIndex';
// ChatGPT round A (2026-11-02): Tilted Card, Border Glow, Noise
import TiltedCard from './bits/TiltedCard';
import BorderGlow from './bits/BorderGlow';
import Noise from './bits/Noise';
// ChatGPT round A afternoon loop 2026-11-02: Magnet Lines, Scrambled Text
import MagnetLines from './bits/MagnetLines';
import ScrambledText from './bits/ScrambledText';
import { setReaderStartPage } from './readerStart';
import './index.css';

interface LibFile {
  key: string;
  subj: string;
  title: string;
  section: string;
  file: string;
  pages: number;
}

// Full-text search hit (ChatGPT round C, 2026-11-01): title vs text match,
// best page, excerpt for text matches.
interface SearchHit {
  key: string;
  subj: string;
  title: string;
  section: string;
  file?: string;
  pages: number;
  kind?: 'title' | 'text';
  page?: number;
  excerpt?: string;
  // evidence-card fields (ChatGPT round C P0, 2026-11-02): match types,
  // total match count, and up to 2 matched passages from /api/search.
  match_count?: number;
  match_kinds?: Array<'title' | 'text' | 'subject'>;
  passages?: Array<{ page_number: number; snippet: string; match_count: number }>;
}

/** Match types for a search hit — backend match_kinds, falling back to kind. */
function matchKindsOf(f: SearchHit): Array<'title' | 'text' | 'subject'> {
  if (f.match_kinds && f.match_kinds.length) return f.match_kinds;
  return [(f.kind === 'text' ? 'text' : 'title')];
}

/** Honest match score for the % badge: exact title = 98, title contains = 90,
 *  full-text scales with match count (70–88), subject-only = 72. */
function matchScore(f: SearchHit, rawQuery: string): number {
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

/** Human-readable match reason for a hit. */
function matchReason(f: SearchHit, rawQuery: string): string {
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
function hitOpenPage(f: SearchHit): number {
  return f.passages?.[0]?.page_number || f.page || 1;
}

const SECTION_LABELS: Record<string, string> = {
  'lectures': 'Lecture Notes',
  'tutorials': 'Tutorials',
  'labs': 'Labs',
  'exams': 'Past Exams',
  'tests': 'Past Tests',
  'assignments': 'Assignments',
  'info': 'Course Info',
  'links': 'Videos & Links',
  // legacy ids
  'lecture-notes': 'Lecture Notes',
  'past-exams': 'Past Exams',
  'past-tests': 'Past Tests',
  'course-info': 'Course Info',
  'videos-links': 'Videos & Links',
};

// Subject identity — exact ChatGPT Round A afternoon tokens, 2026-11-02
// (hue = subject only — consistent across sidebar, filters, results, covers, reader).
const SUBJECT_COLORS: Record<string, string> = {
  'em2': '#568BFF',      // Mathematics — electric blue
  'signals': '#B18AFF',  // Signals & Systems — violet
  'fis': '#F0B86B',      // Philosophy — amber
  'digital': '#36D8C1',  // Digital Electronics — signal teal
};
const SUBJECT_LABELS: Record<string, string> = {
  'em2': 'EM2 · Mathematics',
  'signals': 'Signals & Systems',
  'fis': 'FIS · Philosophy',
  'digital': 'Digital Electronics',
};
const SUBJECT_DESCRIPTIONS: Record<string, string> = {
  'em2': 'Equations. Transforms. Proofs.',
  'signals': 'Frequency. Time. Response.',
  'fis': 'Ideas. Arguments. Meaning.',
  'digital': 'Logic. Circuits. Systems.',
};
// ATLAS POCKET bento: short codes + display names (SUBJECT_LABELS lacks '·' for signals).
const SUBJECT_CODES: Record<string, string> = {
  'em2': 'EM2',
  'signals': 'SIGNALS',
  'fis': 'FIS',
  'digital': 'DIGITAL',
};
const SUBJECT_NAMES: Record<string, string> = {
  'em2': 'Mathematics',
  'signals': 'Signals & Systems',
  'fis': 'Philosophy',
  'digital': 'Digital Electronics',
};
function fileKey(f: { subj: string; section: string; file: string }) {
  return `${f.subj}::${f.section}::${f.file}`;
}

/** Page preview image — mirrors PdfReader's pageImageUrl. */
function pageImageUrl(subj: string, file: string, page: number, totalPages: number): string {
  const stem = file.replace(/\.pdf$/i, '');
  const digits = String(totalPages).length;
  const nn = String(page).padStart(digits, '0');
  return `/assets/pages/${subj}/${stem}/p-${nn}.jpg`;
}

/** Wrap query matches in <mark> for excerpt highlights. */
function highlightQuery(text: string, q: string): React.ReactNode {
  const query = q.trim();
  if (!query || !text) return text;
  const low = text.toLowerCase();
  const qlow = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0, n = 0;
  while (true) {
    const idx = low.indexOf(qlow, i);
    if (idx < 0) { parts.push(text.slice(i)); break; }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={n++}>{text.slice(idx, idx + query.length)}</mark>);
    i = idx + query.length;
  }
  return <>{parts}</>;
}

/** Relative "opened 2h ago" for kl:recentTs timestamps. */
function relTime(ts: number | null): string {
  if (!ts) return 'earlier';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function App() {
  const [files, setFiles] = useState<LibFile[]>([]);
  const [query, setQuery] = useState('');
  const [readerKey, setReaderKey] = useState<string | null>(null);
  const [indexFilter, setIndexFilter] = useState('');
  const [indexSection, setIndexSection] = useState<string>('all');
  const [indexSubject, setIndexSubject] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<string>('home');
  // K/IND mobile engine (round B afternoon): hero search panel carries its own
  // draft; submitting launches the real search tab with the query.
  const [heroQuery, setHeroQuery] = useState('');
  const submitHeroSearch = useCallback(() => {
    const q = heroQuery.trim();
    if (q) setQuery(q);
    setMobileTab('search');
    window.scrollTo({ top: 0 });
  }, [heroQuery]);
  // ATLAS desktop views (ChatGPT round C): overview | library | search
  const [view, setView] = useState<'overview' | 'library' | 'search'>('overview');
  const [searchSubject, setSearchSubject] = useState<string>('all');
  // Knowledge Engine (ChatGPT critique 2026-11-01): library view mode/sort,
  // bookmarks + recently opened (localStorage), reader context list.
  // Round C: grid/list preference persists across sessions.
  const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('kl:libmode') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  useEffect(() => {
    try { localStorage.setItem('kl:libmode', libraryViewMode); } catch { /* ignore */ }
  }, [libraryViewMode]);
  const [librarySort, setLibrarySort] = useState<'recent' | 'title' | 'pages'>('recent');
  // ChatGPT round A (2026-11-02): bookmarks-only filter in library.
  const [libraryBookmarksOnly, setLibraryBookmarksOnly] = useState(false);
  // Search preview panel: inline sticky ≥1100px, slide-over below (desktop).
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kl:bookmarks') || '[]'); } catch { return []; }
  });
  const [recentOpened, setRecentOpened] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kl:recent') || '[]'); } catch { return []; }
  });
  const [readerList, setReaderList] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openReader = useCallback((key: string, list: string[]) => {
    setReaderList(list.length ? list : [key]);
    setReaderKey(key);
    setRecentOpened(prev => {
      const next = [key, ...prev.filter(k => k !== key)].slice(0, 12);
      try {
        localStorage.setItem('kl:recent', JSON.stringify(next));
        const ts = JSON.parse(localStorage.getItem('kl:recentTs') || '{}');
        ts[key] = Date.now();
        localStorage.setItem('kl:recentTs', JSON.stringify(ts));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((key: string) => {
    setBookmarks(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      try { localStorage.setItem('kl:bookmarks', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ⌘K / Ctrl+K → search view (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setView('search');
        setTimeout(() => searchInputRef.current?.focus(), 80);
      }
    };
    window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
  }, []);

  // mobile: cheap static background instead of the heavy Galaxy shader.
  // URL-independent — works on the https link, the http IP, or anywhere.
  const [isMobile, setIsMobile] = useState(false);
  // reduced-motion: static fallbacks for ScrambledText / MagnetLines intros.
  const [reducedMotion] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const check = () => {
      const small = window.matchMedia('(max-width: 820px)').matches;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const ua = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
      setIsMobile(small || (coarse && touch) || ua);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // load library data
  useEffect(() => {
    fetch('/api/library')
      .then(r => r.json())
      .then(data => {
        const all: LibFile[] = (data.files || []).map((f: any) => ({
          key: fileKey({ subj: f.subj, section: f.section, file: f.file }),
          subj: f.subj,
          title: f.title,
          section: f.section,
          file: f.file,
          pages: f.pages || 0,
        }));
        if (all.length > 0) setFiles(all);
        else throw new Error('empty');
      })
      .catch(() => {
        // mock data fallback
        const mock: LibFile[] = [];
        const subjects = ['em2', 'signals'];
        const sections = ['lectures', 'tutorials', 'labs', 'exams', 'tests'];
        let i = 0;
        subjects.forEach(subj => {
          sections.forEach(sec => {
            for (let j = 0; j < 7 && i < 68; j++) {
              const file = `mock-${subj}-${sec}-${j}.pdf`;
              mock.push({
                key: fileKey({ subj, section: sec, file }),
                subj,
                title: `${SECTION_LABELS[sec]} ${j + 1}`,
                section: sec,
                file,
                pages: 10 + (i % 20),
              });
              i++;
            }
          });
        });
        setFiles(mock.slice(0, 68));
      });
  }, []);

  // search — debounced full-text via /api/search (ChatGPT round C, 2026-11-01),
  // falling back to title matching when the index is unavailable.
  const queryActive = query.trim().length > 0;
  const matches = useMemo(() => {
    if (!queryActive) return [];
    const q = query.trim().toLowerCase();
    return files
      .filter(f => f.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, queryActive, files]);

  const [apiResults, setApiResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setApiResults([]); setSearching(false); return; }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => { setApiResults(Array.isArray(d.results) ? d.results : []); setSearching(false); })
        .catch(err => {
          if ((err as Error)?.name !== 'AbortError') { setApiResults([]); setSearching(false); }
        });
    }, 280);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const [searchSelected, setSearchSelected] = useState(0);
  useEffect(() => { setSearchSelected(0); setPreviewOpen(false); }, [query, searchSubject]);

  const readerFile = files.find(f => f.key === readerKey) || null;


  // index view: filtered + sorted files (Knowledge Engine: sort = Recent / Title A–Z / Pages)
  const indexFiles = useMemo(() => {
    let list = files;
    if (indexSubject !== 'all') {
      list = list.filter(f => f.subj === indexSubject);
    }
    if (indexSection !== 'all') {
      list = list.filter(f => f.section === indexSection);
    }
    if (indexFilter.trim()) {
      const q = indexFilter.trim().toLowerCase();
      list = list.filter(f => f.title.toLowerCase().includes(q));
    }
    if (libraryBookmarksOnly) {
      list = list.filter(f => bookmarks.includes(f.key));
    }
    const sorted = [...list];
    if (librarySort === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (librarySort === 'pages') {
      sorted.sort((a, b) => b.pages - a.pages);
    }
    return sorted;
  }, [files, indexFilter, indexSection, indexSubject, librarySort, libraryBookmarksOnly, bookmarks]);

  // search results — full-text hits first, title fallback when index missing
  const searchResults: SearchHit[] = useMemo(() => {
    const base: SearchHit[] = apiResults.length
      ? apiResults
      : matches.map(f => ({ ...f, kind: 'title' as const, page: 0, excerpt: '' }));
    if (searchSubject === 'all') return base;
    return base.filter(f => f.subj === searchSubject);
  }, [apiResults, matches, searchSubject]);

  // evidence summary (ChatGPT round C P0): "N documents · M matches"
  const totalMatches = useMemo(() =>
    searchResults.reduce((s, f) => s + (typeof f.match_count === 'number' ? f.match_count : 1), 0),
  [searchResults]);

  // search keyboard: / focuses, arrows move, Enter opens, Escape clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !inInput && !e.metaKey && !e.ctrlKey) {
        if (view === 'search' && !isMobile) { e.preventDefault(); searchInputRef.current?.focus(); }
        return;
      }
      const onSearchView = view === 'search' || (isMobile && mobileTab === 'search');
      if (!onSearchView || !queryActive) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (inInput) e.preventDefault();
        setSearchSelected(s => {
          const n = searchResults.length;
          if (!n) return 0;
          return e.key === 'ArrowDown' ? (s + 1) % n : (s - 1 + n) % n;
        });
      } else if (e.key === 'Enter') {
        // Enter opens the highlighted result — from the input or anywhere
        // on the search view. (A focused result row opens natively via click.)
        const hit = searchResults[searchSelected];
        const active = document.activeElement;
        if (hit && (active === searchInputRef.current || active === document.body)) {
          e.preventDefault();
          openSearchHit(hit);
        }
      } else if (e.key === 'Escape') {
        if (previewOpen) setPreviewOpen(false);
        else if (queryActive) setQuery('');
        else if (inInput) (e.target as HTMLElement).blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, isMobile, mobileTab, queryActive, searchResults, searchSelected, openReader, previewOpen]);

  const indexSections = useMemo(() => {
    const seen = new Map<string, string>();
    files.forEach(f => {
      if (!seen.has(f.section)) seen.set(f.section, SECTION_LABELS[f.section] || f.section);
    });
    return Array.from(seen.entries());
  }, [files]);



  // ---------- ATLAS desktop shell (ChatGPT critique round C) ----------
  const subjectCounts = useMemo(() => {
    const m: Record<string, number> = {};
    files.forEach(f => { m[f.subj] = (m[f.subj] || 0) + 1; });
    return m;
  }, [files]);

  // Continue studying — last opened doc + saved page (kl:pos)
  const recentFiles = useMemo(() => {
    const byKey = new Map(files.map(f => [f.key, f]));
    const rec = recentOpened.map(k => byKey.get(k)).filter(Boolean) as LibFile[];
    const seen = new Set(rec.map(f => f.key));
    for (const f of files) {
      if (rec.length >= 4) break;
      if (!seen.has(f.key)) rec.push(f);
    }
    return rec.slice(0, 4);
  }, [files, recentOpened]);
  // Resume target — only when something was actually opened before
  // (the featured card hides gracefully when the archive is untouched).
  const resumeFile: LibFile | null =
    (recentOpened.length > 0 && files.find(f => f.key === recentOpened[0])) || null;
  const resumePage = (() => {
    if (!resumeFile) return 1;
    try { return Math.max(1, parseInt(localStorage.getItem(`kl:pos:${resumeFile.key}`) || '1', 10) || 1); }
    catch { return 1; }
  })();

  // OBSIDIAN / ATLAS sidebar (ChatGPT round A, 2026-11-02): 248px, WORKSPACE nav,
  // YOUR DISCIPLINES with counts, archive-status footer panel, luminous active indicator.
  const gotoLibrary = (subject: string, bookmarksOnly = false) => {
    setIndexSubject(subject);
    setIndexSection('all');
    setIndexFilter('');
    setLibraryBookmarksOnly(bookmarksOnly);
    setView('library');
    window.scrollTo({ top: 0 });
  };
  const navItems = [
    { id: 'overview', label: 'Overview', icon: '◈', onClick: () => { setView('overview'); window.scrollTo({ top: 0 }); } },
    { id: 'library', label: `All documents · ${files.length}`, icon: '▤', onClick: () => gotoLibrary('all') },
    { id: 'search', label: 'Search', icon: '⌕', onClick: () => { setView('search'); setTimeout(() => searchInputRef.current?.focus(), 80); } },
    { id: 'recent', label: 'Recently opened', icon: '◔', onClick: () => { setView('overview'); setTimeout(() => document.getElementById('pick-up')?.scrollIntoView({ behavior: 'smooth' }), 120); } },
    { id: 'bookmarks', label: `Bookmarks · ${bookmarks.length}`, icon: '★', onClick: () => gotoLibrary('all', true) },
  ];
  const activeNav = view === 'library' && libraryBookmarksOnly ? 'bookmarks' : view;
  const atlasSidebar = (
    <aside className="ke-sidebar hidden md:flex flex-col shrink-0 sticky top-0 h-screen px-5 py-7"
      style={{ width: 'var(--sidebar-width)' }}>
      <button onClick={() => setView('overview')} className="text-left px-2">
        <ScrambledText
          radius={70}
          duration={0.9}
          speed={0.55}
          intro={!reducedMotion}
          fontFamily="'IBM Plex Mono', ui-monospace, monospace"
          className="ke-wordmark-scramble"
          style={{ fontSize: 14, letterSpacing: '0.18em', color: 'var(--ke-text)' }}
        >
          K<span style={{ color: 'var(--em2)' }}>/</span>IND
        </ScrambledText>
        <span className="block font-mono text-[9px] tracking-[0.28em] mt-1.5" style={{ color: 'var(--muted)' }}>
          THE KNOWLEDGE ARCHIVE
        </span>
      </button>
      <div className="eyebrow mt-9 mb-2 px-2">Workspace</div>
      <nav className="flex flex-col gap-1">
        {navItems.map(n => (
          <button
            key={n.id}
            onClick={n.onClick}
            className={`ke-nav-item${activeNav === n.id ? ' ke-nav-active' : ''} flex items-center gap-3 px-3 rounded-[9px] text-[13px] transition-colors min-h-[42px] text-left`}
            style={{ color: activeNav === n.id ? 'var(--ke-text)' : 'var(--muted)' }}
            aria-current={activeNav === n.id ? 'page' : undefined}
          >
            <span className="text-[15px] w-5 text-center">{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
      <div className="eyebrow mt-8 mb-2 px-2">Your disciplines</div>
      <nav className="flex flex-col gap-1">
        {Object.entries(SUBJECT_LABELS).map(([id, label]) => (
          <button
            key={id}
            onClick={() => gotoLibrary(id)}
            className="flex items-center gap-3 px-3 rounded-[9px] text-[13px] transition-all min-h-[42px] text-left hover:text-white"
            style={{ color: 'var(--muted)' }}
          >
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: SUBJECT_COLORS[id], boxShadow: `0 0 10px ${SUBJECT_COLORS[id]}88` }} />
            <span className="truncate">{label}</span>
            <span className="ml-auto font-mono text-[11px] text-white/30">{subjectCounts[id] || 0}</span>
          </button>
        ))}
      </nav>
      <div className="mt-auto px-2">
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em]" style={{ color: 'var(--ke-text)' }}>
            <span className="ke-status-dot" /> ARCHIVE ONLINE
          </div>
          <div className="font-mono text-[11px] tracking-[0.14em] mt-2" style={{ color: 'var(--muted)' }}>
            {files.length} DOCUMENTS INDEXED
          </div>
        </div>
      </div>
    </aside>
  );

  // K/IND Round A afternoon (2026-11-02): hero top line carries the REAL date at runtime.
  const archiveLine = useMemo(() => {
    const d = new Date();
    const wd = d.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const day = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
    return `ARCHIVE ONLINE — ${wd} / ${day} ${mon} ${d.getFullYear()}`;
  }, []);
  // Last-opened timestamps (kl:recentTs) — written by openReader.
  const recentTs: Record<string, number> = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('kl:recentTs') || '{}'); } catch { return {}; }
  }, [recentOpened]);

  const overviewView = (
    <div className="ke-page">
      {/* hero — K/IND Round A afternoon (2026-11-02): editorial headline,
          real-date top line, Magnet Lines + Aurora background, spec CTAs/stats */}
      <div className="ke-hero px-8 lg:px-12 pt-10 pb-10 mb-8">
        <div className="ke-hero-magnet" aria-hidden="true">
          {!reducedMotion && (
            <MagnetLines
              rows={9}
              columns={26}
              lineColor="rgba(86,139,255,0.35)"
              lineWidth={1}
              lineHeight={14}
              baseAngle={0}
              radius={220}
              intro={false}
              idle={false}
            />
          )}
        </div>
        <div className="ke-hero-art" style={{ opacity: 0.5 }} aria-hidden="true">
          <Aurora
            colorStops={['#568BFF', '#B18AFF', '#568BFF']}
            amplitude={0.9}
            blend={0.55}
            speed={0.35}
            mouseInteraction={false}
            opacity={0.45}
          />
        </div>
        <div className="relative z-10 max-w-[820px]">
          <p className="ke-hero-topline"><span className="ke-status-dot" />{archiveLine}</p>
          <h1 className="display-heading mt-6" style={{ fontSize: 'clamp(48px, 5vw, 78px)' }}>
            <SplitText lines={[{ text: "Ideas don't exist in isolation." }, { text: 'Discover the connections.', italic: true }]} wordDelay={70} />
          </h1>
          <p className="mt-4 text-[14px] max-w-[480px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
            {files.length} documents. 4 disciplines. One connected knowledge archive.
          </p>
          <button
            onClick={() => { setView('search'); setTimeout(() => searchInputRef.current?.focus(), 80); }}
            className="ke-searchbar-glow mt-6 w-full max-w-[600px] flex items-center gap-3 px-6 h-16 rounded-2xl text-left text-[15px]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', color: 'var(--muted)' }}
          >
            <span>⌕</span> Search concepts, equations, lectures…
            <kbd className="ml-auto font-mono text-[10px] px-2 py-1 rounded-md" style={{ background: 'var(--panel)' }}>⌘K</kbd>
          </button>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => gotoLibrary('all')} className="ke-cta-primary">Explore archive ↗</button>
            {resumeFile && (
              <button onClick={() => openReader(resumeFile.key, recentFiles.map(r => r.key))} className="ke-cta-ghost">
                Resume reading →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* stat strip — real archive states, rendered immediately (Round C P0):
          never a bare dash for a known value */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="ke-stat">
          <div className="ke-stat-num">{files.length}</div>
          <div className="eyebrow mt-2">Documents</div>
          <div className="ke-stat-sub">Across 4 subjects</div>
        </div>
        <div className="ke-stat">
          <div className="ke-stat-num">04</div>
          <div className="eyebrow mt-2">Disciplines</div>
          <div className="ke-stat-sub">Your study areas</div>
        </div>
        {resumeFile ? (
          <button
            className="ke-stat ke-stat-action"
            onClick={() => openReader(resumeFile.key, recentFiles.map(r => r.key))}
            aria-label={`Continue ${resumeFile.title}`}
          >
            <div className="ke-stat-num">Continue</div>
            <div className="eyebrow mt-2">Recently opened</div>
            <div className="ke-stat-sub">{resumeFile.title}</div>
          </button>
        ) : (
          <div className="ke-stat">
            <div className="ke-stat-num">Start</div>
            <div className="eyebrow mt-2">Recently opened</div>
            <div className="ke-stat-sub">Open a document to begin</div>
          </div>
        )}
        <div className="ke-stat">
          <div className="ke-stat-num">{String(bookmarks.length).padStart(2, '0')}</div>
          <div className="eyebrow mt-2">Bookmarks</div>
          <div className="ke-stat-sub">{bookmarks.length === 0 ? 'No saved documents' : 'Saved for later'}</div>
        </div>
      </div>

      {/* pick up where you left off — featured card with REAL page thumbnail (Round A afternoon) */}
      <h2 className="eyebrow mb-4" id="pick-up" style={{ scrollMarginTop: 24 }}>Pick up where you left off</h2>
      <div className="mb-12">
        {resumeFile ? (() => {
          const color = SUBJECT_COLORS[resumeFile.subj] || '#fff';
          const page = Math.min(resumePage, resumeFile.pages);
          const pct = resumeFile.pages ? Math.round((page / resumeFile.pages) * 100) : 0;
          return (
            <BorderGlow glowColor={color} radius="24px">
              <button
                onClick={() => openReader(resumeFile.key, recentFiles.map(r => r.key))}
                className="ke-featured" style={{ ['--subject-accent' as any]: color }}
                aria-label={`Resume ${resumeFile.title}, page ${page}`}>
                <span className="ke-featured-thumb" aria-hidden="true">
                  <img
                    src={pageImageUrl(resumeFile.subj, resumeFile.file, page, resumeFile.pages)}
                    alt="" loading="lazy" draggable={false} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="ke-doc-subj block" style={{ color }}>
                    {(SUBJECT_LABELS[resumeFile.subj] || resumeFile.subj).toUpperCase()}
                  </span>
                  <span className="ke-featured-title block">{resumeFile.title}</span>
                  <span className="ke-featured-meta block">
                    Last page {page} of {resumeFile.pages} · {pct}% read · Opened {relTime(recentTs[resumeFile.key] || null)}
                  </span>
                  <span className="ke-featured-bar block" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className="ke-resume-cta">RESUME →</span>
              </button>
            </BorderGlow>
          );
        })() : (
          <div className="ke-featured-empty">
            Nothing on your desk yet —{' '}
            <button onClick={() => gotoLibrary('all')} className="underline underline-offset-4" style={{ color: 'var(--em2)' }}>
              open any document
            </button>{' '}
            to begin — your reading position will be saved here.
          </div>
        )}
      </div>
      {/* your disciplines — four LARGE ASYMMETRIC subject cards (Round A afternoon spec) */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="eyebrow">Your disciplines</h2>
        <button onClick={() => gotoLibrary('all')} className="font-mono text-[10px] tracking-[0.12em] transition-colors"
          style={{ color: 'var(--muted)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ke-text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
          ALL DOCUMENTS ↗
        </button>
      </div>
      <div className="ke-disc-grid mb-12">
        {Object.entries(SUBJECT_LABELS).map(([id], i) => {
          const color = SUBJECT_COLORS[id] || '#fff';
          const code = SUBJECT_CODES[id] || id.toUpperCase();
          const name = SUBJECT_NAMES[id] || code;
          const words = (SUBJECT_DESCRIPTIONS[id] || '').replace(/\. /g, ' · ').replace(/\.$/, '');
          const span = ['ke-disc-span-a', 'ke-disc-span-b', 'ke-disc-span-b', 'ke-disc-span-a'][i % 4];
          return (
            <button
              key={id}
              onClick={() => gotoLibrary(id)}
              className={`ke-disc-card ${span}`}
              style={{ ['--subject-accent' as any]: color }}
              aria-label={`Explore ${name}, ${subjectCounts[id] || 0} documents`}
            >
              <span className="ke-disc-motif" aria-hidden="true">
                <SubjectMotif subj={id} />
              </span>
              <div className="relative z-[1]">
                <div className="ke-disc-code">{code}</div>
                <div className="ke-disc-name">{name}</div>
                <div className="ke-disc-words">{words}</div>
                <div className="ke-disc-foot">
                  <span className="ke-disc-count">{subjectCounts[id] || 0} DOCUMENTS</span>
                  <span className="ke-disc-cta">Explore discipline ↗</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>


      {/* recently added to the archive — horizontal strip (Round A afternoon) */}
      <h2 className="eyebrow mb-4">Recently added to the archive</h2>
      <div className="ke-added-strip mb-4">
        {files.slice(-4).map(f => {
          const color = SUBJECT_COLORS[f.subj] || '#fff';
          return (
            <button key={f.key}
              onClick={() => openReader(f.key, files.map(r => r.key))}
              className="ke-added-card" style={{ ['--subject-accent' as any]: color }}
              aria-label={`Open ${f.title}`}>
              <DocCover subj={f.subj} title={f.title} color={color} docKey={f.key} />
              <div className="ke-added-label">
                {(SUBJECT_CODES[f.subj] || f.subj).toUpperCase()} · {(SECTION_LABELS[f.section] || f.section)}
              </div>
              <div className="ke-added-title">{f.title}</div>
            </button>
          );
        })}
      </div>
      <div className="h-10" />
    </div>
  );


  // Desktop library content — FilterPills + SpotlightCard doc cards (KIN/D v2.0),
  // Tilted Card covers + bookmark buttons + skeleton loading (round A, 2026-11-02).
  const activeFilterCount =
    (indexSubject !== 'all' ? 1 : 0) +
    (indexSection !== 'all' ? 1 : 0) +
    (indexFilter.trim() ? 1 : 0) +
    (libraryBookmarksOnly ? 1 : 0);
  const clearLibraryFilters = () => {
    setIndexSubject('all'); setIndexSection('all'); setIndexFilter(''); setLibraryBookmarksOnly(false);
  };
  const desktopLibraryContent = (
    <>
      <div className="flex flex-col gap-4">
        <input
          value={indexFilter}
          onChange={e => setIndexFilter(e.target.value)}
          placeholder={`Search ${indexSubject === 'all' ? 'all documents' : SUBJECT_LABELS[indexSubject]}…`}
          className="w-full h-[52px] rounded-2xl px-6 text-[14px] outline-none"
          style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--ke-text)' }}
        />
        <FilterPills
          idPrefix="lib"
          activeId={indexSubject}
          onSelect={(id) => { setIndexSubject(id); setLibraryBookmarksOnly(false); }}
          items={[
            { id: 'all', label: `All · ${files.length}` },
            ...Object.entries(SUBJECT_LABELS).map(([id, label]) => ({
              id,
              label: `${label.split(' · ')[0]} · ${subjectCounts[id] || 0}`,
              color: SUBJECT_COLORS[id],
            })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={indexSection}
            onChange={e => setIndexSection(e.target.value)}
            className="rounded-full px-4 py-2 text-[12px] outline-none cursor-pointer"
            style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--muted)' }}
            aria-label="Filter by section"
          >
            <option value="all">All sections</option>
            {indexSections.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
          <select
            value={librarySort}
            onChange={e => setLibrarySort(e.target.value as 'recent' | 'title' | 'pages')}
            className="rounded-full px-4 py-2 text-[12px] outline-none cursor-pointer"
            style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--muted)' }}
            aria-label="Sort documents"
          >
            <option value="recent">Sort: Recent</option>
            <option value="title">Sort: Title A–Z</option>
            <option value="pages">Sort: Page count</option>
          </select>
          <button
            onClick={() => setLibraryBookmarksOnly(v => !v)}
            className={`rounded-full px-4 py-2 text-[12px] outline-none transition-colors ${libraryBookmarksOnly ? 'font-semibold' : ''}`}
            style={libraryBookmarksOnly
              ? { background: '#E6B76C', color: '#0A0D14' }
              : { background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--muted)' }}
            aria-pressed={libraryBookmarksOnly}
          >
            ★ Bookmarked{libraryBookmarksOnly ? ' ✓' : ''}
          </button>
          <div className="ke-segmented ke-segmented-sm" role="tablist" aria-label="Library view">
            <button onClick={() => setLibraryViewMode('grid')} className={libraryViewMode === 'grid' ? 'active' : ''}>Grid</button>
            <button onClick={() => setLibraryViewMode('list')} className={libraryViewMode === 'list' ? 'active' : ''}>List</button>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearLibraryFilters}
              className="rounded-full px-4 py-2 text-[12px] font-medium transition-colors"
              style={{ background: 'rgba(107,157,255,0.14)', border: '1px solid rgba(107,157,255,0.4)', color: 'var(--em2)' }}
            >
              {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} · Clear ✕
            </button>
          )}
        </div>
      </div>
      <div className="eyebrow mb-4 mt-6">
        {indexSubject === 'all'
          ? `${indexFiles.length} DOCUMENTS · 4 SUBJECTS`
          : `${(SUBJECT_LABELS[indexSubject] || indexSubject).toUpperCase()} · ${indexFiles.length} DOCUMENT${indexFiles.length === 1 ? '' : 'S'}`}
        {` · SORTED BY ${librarySort === 'recent' ? 'RECENT' : librarySort === 'title' ? 'TITLE' : 'PAGES'}`}
      </div>
      {files.length === 0 ? (
        <div className="ke-doc-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="ke-skeleton" />)}
        </div>
      ) : indexFiles.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] p-12 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <p className="text-[15px]" style={{ color: 'var(--ke-text)' }}>No documents match these filters.</p>
          <button
            onClick={clearLibraryFilters}
            className="mt-4 text-sm font-medium underline underline-offset-4"
            style={{ color: 'var(--em2)' }}
          >
            Clear all filters
          </button>
        </div>
      ) : libraryViewMode === 'grid' ? (
        <div className="ke-doc-grid ke-anim-list">
          {indexFiles.map((f) => {
            const color = SUBJECT_COLORS[f.subj] || '#fff';
            const saved = bookmarks.includes(f.key);
            return (
              <SpotlightCard key={f.key} className="kind-doc-card" spotlightColor={color}
                style={{ '--spotlight-card-surface': 'var(--surface)', ['--subject-accent' as any]: color } as any}>
                <div
                  onClick={() => openReader(f.key, indexFiles.map(r => r.key))}
                  className="ke-doc-card w-full text-left relative cursor-pointer"
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') openReader(f.key, indexFiles.map(r => r.key)); }}
                >
                  <TiltedCard tiltMaxAngleX={3} tiltMaxAngleY={3} scaleOnHover={1.04}>
                    <DocCover subj={f.subj} title={f.title} color={color} docKey={f.key} />
                  </TiltedCard>
                  <button
                    className={`ke-card-bm${saved ? ' on' : ''}`}
                    onClick={e => { e.stopPropagation(); toggleBookmark(f.key); }}
                    aria-label={saved ? 'Remove bookmark' : 'Bookmark'}
                    aria-pressed={saved}
                  >★</button>
                  <span className="ke-card-open" aria-hidden="true">↗</span>
                  <div className="ke-doc-card-body">
                    <div className="ke-doc-subj" style={{ color }}>
                      {(SUBJECT_LABELS[f.subj] || f.subj).toUpperCase()} · {(SECTION_LABELS[f.section] || f.section).toUpperCase()}
                    </div>
                    <div className="ke-doc-card-title mt-1.5">{f.title}</div>
                    <div className="ke-doc-meta">{f.pages} PAGES{saved ? ' · ★ SAVED' : ''}</div>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      ) : (
        <div className="ke-anim-list">
          {indexFiles.map((f) => {
            const color = SUBJECT_COLORS[f.subj] || '#fff';
            return (
              <button key={f.key} style={{ ['--subject-accent' as any]: color }}
                onClick={() => openReader(f.key, indexFiles.map(r => r.key))}
                className="ke-result">
                <DocCover subj={f.subj} title={f.title} color={color} docKey={f.key} />
                <div className="min-w-0">
                  <div className="ke-doc-subj" style={{ color }}>
                    {(SUBJECT_LABELS[f.subj] || f.subj).toUpperCase()} · {(SECTION_LABELS[f.section] || f.section).toUpperCase()}
                  </div>
                  <div className="ke-result-title">{f.title}</div>
                  <div className="font-mono text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
                    {f.pages} PAGES{bookmarks.includes(f.key) ? ' · ★' : ''}
                  </div>
                </div>
                <span className="ke-result-open">OPEN →</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  const libraryView = (
    <div className="ke-page">
      <p className="eyebrow">
        {indexSubject === 'all' ? 'Library / All documents' : `Library / ${(SUBJECT_LABELS[indexSubject] || indexSubject)}`}
      </p>
      <h1 className="display-heading mt-3" style={{ fontSize: 'clamp(40px, 4.5vw, 60px)' }}>
        {indexSubject === 'all' ? 'The knowledge archive.' : (SUBJECT_LABELS[indexSubject] || indexSubject) + '.'}
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
        {indexSubject === 'all'
          ? `${files.length} documents, organised across four disciplines.`
          : `${indexFiles.length} document${indexFiles.length === 1 ? '' : 's'} in this subject · ${files.length} in the full archive.`}
      </p>
      <div className="mt-7">{desktopLibraryContent}</div>
      <div className="h-10" />
    </div>
  );

  // OBSIDIAN / ATLAS search — "Find the connection." (ChatGPT round A, 2026-11-02):
  // split view ≥1440px (results 56 / sticky preview 44), slide-over below 1100px,
  // excerpt <mark> highlights, pills with counts, OPEN DOCUMENT at exact page.
  const previewHit = searchResults.length
    ? searchResults[Math.min(searchSelected, searchResults.length - 1)]
    : null;
  const openSearchHit = (hit: SearchHit) => {
    // always open AT the best matching page (round C P0: "Open at page N")
    setReaderStartPage(hit.key, hitOpenPage(hit));
    openReader(hit.key, searchResults.map(r => r.key));
  };
  const handleResultClick = (_hit: SearchHit, i: number) => {
    // Clicking a result updates the sticky preview WITHOUT navigating —
    // the preview's "Open full document" CTA opens it.
    setSearchSelected(i);
    if (window.matchMedia('(max-width: 1099px)').matches) setPreviewOpen(true);
    else {
      const pv = document.querySelector('.ke-preview');
      pv?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  const searchView = (
    <div className="ke-page">
      <p className="eyebrow">Search / Discovery engine</p>
      <h1 className="display-heading mt-3" style={{ fontSize: 'clamp(44px, 5vw, 68px)' }}>
        Explore the archive.
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
        Search concepts, equations, lectures — across every page of every document.
      </p>
      <div className="relative mt-7">
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: 'var(--muted)' }}>⌕</span>
        <input
          ref={searchInputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search titles, topics, subjects…"
          className="ke-searchbar-glow w-full h-[66px] rounded-2xl pl-14 pr-14 text-[16px] outline-none"
          style={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--ke-text)' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-xl leading-none transition-colors"
            style={{ color: 'var(--muted)' }}
            aria-label="Clear search"
          >×</button>
        )}
        <kbd className="absolute right-14 top-1/2 -translate-y-1/2 font-mono text-[10px] px-2 py-1 rounded-md hidden sm:block"
          style={{ background: 'var(--panel-hover)', color: 'var(--muted)', display: query ? 'none' : undefined }}>⌘K</kbd>
      </div>
      <div className="mt-4">
        <FilterPills
          idPrefix="search"
          activeId={searchSubject}
          onSelect={setSearchSubject}
          items={[
            { id: 'all', label: `ALL · ${files.length}` },
            { id: 'em2', label: `EM2 · ${subjectCounts['em2'] || 0}`, color: SUBJECT_COLORS['em2'] },
            { id: 'signals', label: `SIGNALS · ${subjectCounts['signals'] || 0}`, color: SUBJECT_COLORS['signals'] },
            { id: 'fis', label: `FIS · ${subjectCounts['fis'] || 0}`, color: SUBJECT_COLORS['fis'] },
            { id: 'digital', label: `DIGITAL · ${subjectCounts['digital'] || 0}`, color: SUBJECT_COLORS['digital'] },
          ]}
        />
      </div>
      <div className="mt-7">
        {!queryActive ? (
          <p className="text-[14px]" style={{ color: 'var(--muted)' }}>
            Type to search across {files.length} documents. Try “laplace”, “epistemology”, “boolean”…
          </p>
        ) : searchResults.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] p-12 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <p className="text-[15px]" style={{ color: 'var(--ke-text)' }}>No matches for “{query}”.</p>
            <button onClick={() => { setQuery(''); setSearchSubject('all'); }}
              className="mt-4 text-sm font-medium underline underline-offset-4" style={{ color: 'var(--em2)' }}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="ke-anim-list">
            <div className="eyebrow mb-4 flex items-center justify-between">
              <span>{searchResults.length} MATCH{searchResults.length === 1 ? '' : 'ES'}</span>
              <span>SORT: RELEVANCE</span>
            </div>
            <div className="ke-search-split">
              <AnimatedList
                items={searchResults.map(f => ({ id: f.key, title: f.title }))}
                onItemSelect={(_, i) => {
                  const f = searchResults[i];
                  if (f) openSearchHit(f);
                }}
                renderItem={(_, i) => {
                  const f = searchResults[i];
                  if (!f) return null;
                  const color = SUBJECT_COLORS[f.subj] || '#fff';
                  const selected = searchSelected === i;
                  const score = matchScore(f, query);
                  const excerpt = f.excerpt || f.passages?.[0]?.snippet;
                  return (
                    <button
                      onClick={() => handleResultClick(f, i)}
                      onMouseEnter={() => setSearchSelected(i)}
                      className={`ke-result${selected ? ' ke-result-selected' : ''}`}
                      aria-selected={selected}
                      style={{ ['--subject-accent' as any]: color }}>
                      <DocCover subj={f.subj} title={f.title} color={color} docKey={f.key} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="ke-doc-subj" style={{ color }}>
                            {(SUBJECT_LABELS[f.subj] || f.subj).toUpperCase()} · {(SECTION_LABELS[f.section] || f.section).toUpperCase()}
                          </div>
                          <span className="ke-match-badge">{score}% MATCH</span>
                        </div>
                        <div className="ke-result-title">{highlightQuery(f.title, query)}</div>
                        {excerpt && (
                          <div className="ke-result-excerpt">{highlightQuery(excerpt, query)}</div>
                        )}
                        <div className="ke-result-reason">
                          {matchReason(f, query)} · {f.pages} PAGES{f.page ? ` · P. ${f.page}` : ''}
                        </div>
                      </div>
                      <span className="ke-result-open">OPEN →</span>
                    </button>
                  );
                }}
                enableArrowNavigation
                initialSelectedIndex={0}
                animation="slide"
                stagger={45}
              />
              {previewHit && (() => {
                const color = SUBJECT_COLORS[previewHit.subj] || '#fff';
                const f = files.find(x => x.key === previewHit.key);
                const page = hitOpenPage(previewHit);
                const totalPages = f?.pages || previewHit.pages || 1;
                const stem = f?.file;
                const passages = (previewHit.passages || []).slice(0, 2);
                return (
                  <BorderGlow glowColor={color} radius="22px"
                    className={`ke-preview ke-preview-slideover${previewOpen ? ' ke-preview-open' : ''}`}>
                    <div style={{ ['--subject-accent' as any]: color }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="ke-doc-subj" style={{ color }}>
                            {(SUBJECT_LABELS[previewHit.subj] || previewHit.subj).toUpperCase()}
                          </div>
                          <span className="ke-match-badge">{matchScore(previewHit, query)}% MATCH</span>
                        </div>
                        <button
                          onClick={() => setPreviewOpen(false)}
                          className="ke-reader-btn ke-preview-close"
                          aria-label="Close preview"
                        >×</button>
                      </div>
                      <h3 className="display-heading mt-2" style={{ fontSize: 30 }}>{highlightQuery(previewHit.title, query)}</h3>
                      <div className="ke-result-reason mt-2">
                        {matchReason(previewHit, query)} · {(SECTION_LABELS[previewHit.section] || previewHit.section).toUpperCase()} · PAGE {Math.min(page, totalPages)} OF {totalPages}
                      </div>
                      {stem && (
                        <div className="ke-preview-page mt-5">
                          <img
                            src={pageImageUrl(previewHit.subj, stem, Math.min(page, totalPages), totalPages)}
                            alt={`Page ${page} preview of ${previewHit.title}`}
                            loading="lazy"
                          />
                        </div>
                      )}
                      {passages.map(p => (
                        <div key={p.page_number} className="ke-preview-excerpt mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                          <span className="font-mono text-[10px] tracking-[0.1em] block mb-1" style={{ color }}>
                            P. {p.page_number} · {p.match_count} MATCH{p.match_count === 1 ? '' : 'ES'}
                          </span>
                          {highlightQuery(p.snippet, query)}
                        </div>
                      ))}
                      {passages.length === 0 && previewHit.excerpt && (
                        <div className="ke-preview-excerpt mt-5 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                          {highlightQuery(previewHit.excerpt, query)}
                        </div>
                      )}
                      <button
                        onClick={() => openSearchHit(previewHit)}
                        className="ke-cta-primary mt-6 w-full justify-center"
                      >
                        Open full document →
                      </button>
                    </div>
                  </BorderGlow>
                );
              })()}
            </div>
          </div>
        )}
      </div>
      <div className="h-10" />
    </div>
  );

  // ============ ATLAS POCKET mobile architecture (ChatGPT round B, 2026-11-02) ============
  // Purpose-built premium study app: Home = cinematic/personal, Library = dense,
  // Search = intelligent, Reader = immersive (MobileReader). isMobile ≤820px.
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isMobile && mobileTab === 'search') {
      const t = setTimeout(() => mobileSearchInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isMobile, mobileTab]);

  // mobile reader context: same-subject sections → docs (Contents sheet),
  // bookmarked docs (Bookmarks sheet)
  const readerContents = useMemo(() => {
    if (!readerFile) return [];
    const bySection = new Map<string, LibFile[]>();
    files.filter(f => f.subj === readerFile.subj).forEach(f => {
      if (!bySection.has(f.section)) bySection.set(f.section, []);
      bySection.get(f.section)!.push(f);
    });
    return [...bySection.entries()].map(([id, docs]) => ({
      id, label: SECTION_LABELS[id] || id, docs,
    }));
  }, [files, readerFile]);
  const readerBookmarked = useMemo(() => {
    const byKey = new Map(files.map(f => [f.key, f]));
    return bookmarks.map(k => byKey.get(k)).filter((f): f is LibFile => !!f);
  }, [bookmarks, files]);

  // --- mobile row: 108-116px, 54×76 thumb, press scale 0.985, 40px bookmark target
  const apDocRow = (f: LibFile | SearchHit, i: number, list: (LibFile | SearchHit)[]) => {
    const color = SUBJECT_COLORS[f.subj] || '#fff';
    const saved = bookmarks.includes(f.key);
    return (
      <div key={f.key} className="ap-row ap-stagger" style={{ ['--subject-accent' as any]: color, animationDelay: `${Math.min(i, 14) * 35}ms` }}>
        <button
          onClick={() => openReader(f.key, list.map(r => r.key))}
          className="ap-row-main"
          aria-label={`Open ${f.title}`}
        >
          <span className="ap-cover-sm" aria-hidden="true">
            <DocCover subj={f.subj} title={f.title} color={color} docKey={f.key} />
          </span>
          <span className="ap-row-body">
            <span className="ap-row-subj" style={{ color }}>
              {(SUBJECT_LABELS[f.subj] || f.subj).split(' · ')[0].toUpperCase()}
            </span>
            <span className="ap-row-title">{f.title}</span>
            <span className="ap-row-meta">
              {(SECTION_LABELS[f.section] || f.section).toUpperCase()} · {f.pages} PAGES
            </span>
          </span>
        </button>
        <button
          onClick={() => toggleBookmark(f.key)}
          className={`ap-row-bm${saved ? ' on' : ''}`}
          aria-label={saved ? 'Remove bookmark' : 'Bookmark'}
          aria-pressed={saved}
        >
          {saved ? '★' : '☆'}
        </button>
      </div>
    );
  };

  // --- filter rail: 36px pills with counts, selected scrolls into view
  const ApPill = ({ id, label, count, active, onPick }: {
    id: string; label: string; count: number; active: boolean; onPick: (id: string) => void;
  }) => {
    const ref = useRef<HTMLButtonElement>(null);
    useEffect(() => {
      if (active) ref.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, [active]);
    return (
      <button
        ref={ref}
        onClick={() => onPick(id)}
        className={`ap-pill${active ? ' active' : ''}`}
        role="tab" aria-selected={active}
        style={active && SUBJECT_COLORS[id]
          ? { borderColor: `${SUBJECT_COLORS[id]}88`, color: SUBJECT_COLORS[id] }
          : undefined}
      >
        {label} · {count}
      </button>
    );
  };
  const apPills = (value: string, onPick: (id: string) => void) => (
    <div className="ap-rail" role="tablist" aria-label="Subject filter">
      <ApPill id="all" label="ALL" count={files.length} active={value === 'all'} onPick={onPick} />
      <ApPill id="em2" label="EM2" count={subjectCounts['em2'] || 0} active={value === 'em2'} onPick={onPick} />
      <ApPill id="signals" label="SIGNALS" count={subjectCounts['signals'] || 0} active={value === 'signals'} onPick={onPick} />
      <ApPill id="fis" label="FIS" count={subjectCounts['fis'] || 0} active={value === 'fis'} onPick={onPick} />
      <ApPill id="digital" label="DIGITAL" count={subjectCounts['digital'] || 0} active={value === 'digital'} onPick={onPick} />
    </div>
  );

  // --- FILTERS bottom sheet (mobile library): subject / section / sort / clear / apply
  const [mFilterOpen, setMFilterOpen] = useState(false);
  const [mTmpSubject, setMTmpSubject] = useState('all');
  const [mTmpSection, setMTmpSection] = useState('all');
  const [mTmpSort, setMTmpSort] = useState<'recent' | 'title' | 'pages'>('recent');
  const openMFilter = () => {
    setMTmpSubject(indexSubject); setMTmpSection(indexSection); setMTmpSort(librarySort);
    setMFilterOpen(true);
  };
  const mobileFilterSheet = mFilterOpen && (
    <div className="ap-sheet-backdrop" onClick={() => setMFilterOpen(false)}>
      <div className="ap-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filters">
        <div className="ap-sheet-head">
          <div className="ap-sheet-grip" />
          <div className="ap-sheet-title-row">
            <span className="ap-sheet-title">Filters</span>
            <button className="ap-icon-btn" onClick={() => setMFilterOpen(false)} aria-label="Close filters">✕</button>
          </div>
        </div>
        <div className="ap-filter-sec">
          <div className="ap-eyebrow">SUBJECT</div>
          <div className="ap-rail">
            {[{ id: 'all', label: 'All' }, ...Object.entries(SUBJECT_LABELS).map(([id, label]) => ({ id, label: label.split(' · ')[0] }))].map(s => (
              <button key={s.id} onClick={() => setMTmpSubject(s.id)}
                className={`ap-pill${mTmpSubject === s.id ? ' active' : ''}`} aria-pressed={mTmpSubject === s.id}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ap-filter-sec">
          <div className="ap-eyebrow">SECTION</div>
          <div className="ap-chipwrap">
            {[{ id: 'all', label: 'All sections' }, ...indexSections.map(([id, label]) => ({ id, label }))].map(s => (
              <button key={s.id} onClick={() => setMTmpSection(s.id)}
                className={`ap-chipbtn${mTmpSection === s.id ? ' active' : ''}`} aria-pressed={mTmpSection === s.id}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ap-filter-sec">
          <div className="ap-eyebrow">SORT</div>
          <div className="ap-chipwrap">
            {([['recent', 'Recent'], ['title', 'Title A–Z'], ['pages', 'Most pages']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMTmpSort(id)}
                className={`ap-chipbtn${mTmpSort === id ? ' active' : ''}`} aria-pressed={mTmpSort === id}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="ap-filter-actions">
          <button
            className="ap-chip-btn"
            onClick={() => { setMTmpSubject('all'); setMTmpSection('all'); setMTmpSort('recent'); setLibraryBookmarksOnly(false); }}
          >
            Clear
          </button>
          <button
            className="ap-apply-btn"
            onClick={() => { setIndexSubject(mTmpSubject); setIndexSection(mTmpSection); setLibrarySort(mTmpSort); setMFilterOpen(false); }}
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );

  // --- mobile search: tap-to-expand inline preview
  const [searchExpanded, setSearchExpanded] = useState<string | null>(null);
  useEffect(() => { setSearchExpanded(null); }, [query, searchSubject]);

  // ---------- K/IND mobile engine: THE KNOWLEDGE PORTAL home ----------
  // ChatGPT Round B afternoon (2026-11-02, kindworksmy): eyebrow, controlled
  // 2-line serif headline, real interactive search panel, archive status,
  // numbered 2×2 discipline collection, Aurora behind the first ~280px.
  const mobileHome = (
    <div className="ap-content">
      <div className="ki-hero">
        <div className="ki-hero-aurora" aria-hidden="true">
          {!reducedMotion && (
            <Aurora
              colorStops={['#568BFF', '#B18AFF', '#45D9C2']}
              amplitude={1.1}
              blend={0.5}
              speed={0.25}
              mouseInteraction={false}
              opacity={0.4}
            />
          )}
        </div>
        <p className="ap-eyebrow ki-hero-eyebrow">
          <span className="ke-status-dot" /> K/IND · ARCHIVE ONLINE
        </p>
        <h1 className="ki-hero-title">
          {reducedMotion ? (
            <>Think deeper.<br />Connect everything.</>
          ) : (
            <>
              <BlurText text="Think deeper." trigger="load" animateBy="words" delay={60} className="ki-blurline" />
              <BlurText text="Connect everything." trigger="load" animateBy="words" delay={240} className="ki-blurline" />
            </>
          )}
        </h1>
        <p className="ki-hero-sub">
          {files.length} documents. 4 disciplines. Your entire study world.
        </p>
        <form
          className="ki-search-panel"
          onSubmit={(e) => { e.preventDefault(); submitHeroSearch(); }}
          role="search"
        >
          <input
            value={heroQuery}
            onChange={e => setHeroQuery(e.target.value)}
            placeholder="Find an idea, equation, lecture…"
            aria-label="Search the archive"
            enterKeyHint="search"
          />
          <button type="submit" className="ki-search-cta">SEARCH →</button>
        </form>

      </div>

      {/* disciplines — numbered 2×2 collection */}
      <section className="ap-section" style={{ paddingTop: 26 }}>
        <div className="ap-section-head">
          <span>EXPLORE YOUR DISCIPLINES</span>
          <button className="ap-link" onClick={() => { setMobileTab('library'); window.scrollTo({ top: 0 }); }}>
            VIEW ALL ↗
          </button>
        </div>
        <div className="ki-disc-grid">
          {['em2', 'signals', 'fis', 'digital'].map((id, i) => {
            const color = SUBJECT_COLORS[id] || '#fff';
            const code = SUBJECT_CODES[id] || id.toUpperCase();
            const name = SUBJECT_NAMES[id] || code;
            return (
              <button
                key={id}
                onClick={() => { setIndexSubject(id); setLibraryBookmarksOnly(false); setMobileTab('library'); window.scrollTo({ top: 0 }); }}
                className="ki-disc"
                style={{ ['--subject-accent' as any]: color }}
                aria-label={`Open ${name}, ${subjectCounts[id] || 0} documents`}
              >
                <span className="ki-disc-glow" aria-hidden="true" />
                <span className="ki-disc-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="ki-disc-code" style={{ color }}>{code}</span>
                <span className="ki-disc-name">{name}</span>
                <span className="ki-disc-count">{subjectCounts[id] || 0} DOCUMENTS</span>
              </button>
            );
          })}
        </div>
      </section>


      {/* archive status — below the disciplines (Round C P1b): the first
          screen is brand + headline + description + search + subject grid */}
      <section className="ap-section" style={{ paddingTop: 22 }}>
        <div className="ki-status">
          <div className="ki-status-top">
            <p className="ap-eyebrow">YOUR ARCHIVE</p>
            <p className="ki-status-right">INDEXED</p>
          </div>
          <p className="ki-status-num">
            {files.length}
            <span className="ki-status-den"> / {files.length}</span>
          </p>
          <span className="ki-status-bar" aria-hidden="true">
            <span style={{ width: files.length ? '100%' : '0%' }} />
          </span>
        </div>
      </section>
      {/* continue studying — featured card, whole card tappable */}
      {resumeFile && (() => {
        const color = SUBJECT_COLORS[resumeFile.subj] || '#fff';
        const page = Math.min(resumePage, resumeFile.pages);
        const pct = resumeFile.pages ? Math.round((page / resumeFile.pages) * 100) : 0;
        return (
          <section className="ap-section">
            <div className="ap-section-head"><span>CONTINUE STUDYING</span></div>
            <button
              onClick={() => openReader(resumeFile.key, recentFiles.map(r => r.key))}
              className="ap-continue"
              style={{ ['--subject-accent' as any]: color }}
              aria-label={`Resume ${resumeFile.title}, page ${page}`}
            >
              <span className="ap-cover-md" aria-hidden="true">
                <DocCover subj={resumeFile.subj} title={resumeFile.title} color={color} docKey={resumeFile.key} />
              </span>
              <span className="ap-continue-body">
                <span className="ap-row-subj" style={{ color }}>RESUME READING</span>
                <span className="ap-continue-title">{resumeFile.title}</span>
                <span className="ap-row-meta">PAGE {page} OF {resumeFile.pages} · {pct}%</span>
                <span className="ap-progress-track"><span style={{ width: `${pct}%`, background: color }} /></span>
              </span>
              <span className="ap-continue-cta" aria-hidden="true">→</span>
            </button>
          </section>
        );
      })()}

      {/* recently explored — swipe carousel */}
      {recentFiles.length > 0 && (
        <section className="ap-section">
          <div className="ap-section-head"><span>RECENTLY EXPLORED</span></div>
          <div className="ap-carousel-bleed">
            <Carousel cardWidth={232} gap={12} ariaLabel="Recently explored documents">
              {recentFiles.slice(0, 5).map(f => {
                const color = SUBJECT_COLORS[f.subj] || '#fff';
                return (
                  <button
                    key={f.key}
                    onClick={() => openReader(f.key, recentFiles.map(r => r.key))}
                    className="ap-recent-card"
                    style={{ ['--subject-accent' as any]: color }}
                    aria-label={`Open ${f.title}`}
                  >
                    <span className="ap-cover-md" aria-hidden="true">
                      <DocCover subj={f.subj} title={f.title} color={color} docKey={f.key} />
                    </span>
                    <span className="ap-recent-title">{f.title}</span>
                    <span className="ap-row-meta">
                      {(SUBJECT_LABELS[f.subj] || f.subj).split(' · ')[0].toUpperCase()} · {relTime(recentTs[f.key] || null).toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </Carousel>
          </div>
        </section>
      )}
    </div>
  );

  // ---------- K/IND mobile engine: EDITORIAL DOCUMENT INDEX ----------
  // Compact numbered rows (76–88px) in a react-bits AnimatedList (gentle
  // stagger on first appearance). Filter chips horizontal-scroll, no wrap.
  // Filter/sort via the existing bottom-sheet pattern. Subject themes come
  // from the shared MobileSubjectIndex — never duplicated pages.
  const kiDocRow = (f: LibFile, i: number, list: LibFile[]) => {
    const color = SUBJECT_COLORS[f.subj] || '#fff';
    return (
      <MobileDocRow
        f={f}
        index={i}
        accent={color}
        subjectCode={SUBJECT_CODES[f.subj] || f.subj.toUpperCase()}
        sectionLabel={SECTION_LABELS[f.section] || f.section}
        bookmarked={bookmarks.includes(f.key)}
        onOpen={() => openReader(f.key, list.map(r => r.key))}
        onToggleBookmark={() => toggleBookmark(f.key)}
      />
    );
  };
  const mobileLibrary = (
    <div className="ap-content">
      <header className="ki-lib-head">
        <p className="ap-eyebrow">
          K/IND / LIBRARY / {indexSubject === 'all' ? 'ALL DOCUMENTS' : (SUBJECT_CODES[indexSubject] || indexSubject.toUpperCase())}
        </p>
        <h1 className="ap-lib-title">The archive.</h1>
      </header>
      <div className="ap-lib-tools">
        <input
          value={indexFilter}
          onChange={e => setIndexFilter(e.target.value)}
          placeholder={`Search ${indexSubject === 'all' ? 'all documents' : SUBJECT_LABELS[indexSubject]}…`}
          className="ap-input"
          aria-label="Filter documents"
        />
        {apPills(indexSubject, (id) => { setIndexSubject(id); setLibraryBookmarksOnly(false); })}
        <div className="ap-lib-controls">
          <span className="ap-eyebrow">
            {indexFiles.length} DOCUMENT{indexFiles.length === 1 ? '' : 'S'}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} FILTER${activeFilterCount === 1 ? '' : 'S'}` : ''}
          </span>
          <span className="flex-1" />
          <button onClick={openMFilter} className="ap-mini-btn">FILTERS</button>
          <button onClick={openMFilter} className="ap-mini-btn">
            SORT · {librarySort === 'recent' ? 'RECENT' : librarySort === 'title' ? 'A–Z' : 'PAGES'}
          </button>
        </div>
      </div>
      {files.length === 0 ? (
        <div className="ap-lib-list" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="ap-row ap-skeleton" />)}
        </div>
      ) : indexFiles.length === 0 ? (
        <div className="ap-empty-card">
          <p>No documents match these filters.</p>
          <button onClick={clearLibraryFilters} className="ap-link">Clear all filters</button>
        </div>
      ) : indexSubject !== 'all' ? (
        <MobileSubjectIndex
          subject={indexSubject}
          subjectCode={SUBJECT_CODES[indexSubject] || indexSubject.toUpperCase()}
          accent={SUBJECT_COLORS[indexSubject] || '#fff'}
          files={indexFiles}
          sectionLabelOf={(s) => SECTION_LABELS[s] || s}
          bookmarks={bookmarks}
          toggleBookmark={toggleBookmark}
          openReader={openReader}
          recentKeys={recentOpened}
          reducedMotion={reducedMotion}
        />
      ) : (
        <div className="ki-list">
          <AnimatedList
            items={indexFiles.map(f => ({ id: f.key, title: f.title }))}
            renderItem={(_, i) => {
              const f = indexFiles[i];
              return f ? kiDocRow(f, i, indexFiles) : null;
            }}
            onItemSelect={(_, i) => {
              const f = indexFiles[i];
              if (f) openReader(f.key, indexFiles.map(r => r.key));
            }}
            enableArrowNavigation={false}
            selectOnHover={false}
            initialSelectedIndex={-1}
            animation="fade"
            animateOnce
            stagger={0.035}
            showGradients={false}
            frame={false}
            displayScrollbar={false}
            width="100%"
            maxHeight="none"
            gap={0}
            className="ki-anim"
            itemClassName="ki-anim-item"
          />
          <p className="ki-row-hint">SWIPE A ROW LEFT TO BOOKMARK</p>
        </div>
      )}
      {mobileFilterSheet}
    </div>
  );

  // ---------- ATLAS POCKET search ----------
  const mobileSearch = (
    <div className="ap-content">
      <div className="ap-search-head">
        <button onClick={() => setMobileTab('home')} className="ap-icon-btn" aria-label="Back to home">‹</button>
        <span className="ap-eyebrow">SEARCH</span>
        <span className="w-[44px]" />
      </div>
      <h1 className="ap-lib-title px-5">Find the connection.</h1>
      <div className="ap-search-sticky">
        <div className="ap-search-field">
          <span className="ap-search-icon" aria-hidden="true">⌕</span>
          <input
            ref={mobileSearchInputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search titles, topics, subjects…"
            className="ap-search-input"
            aria-label="Search the archive"
            enterKeyHint="search"
          />
          {searching ? (
            <span className="ap-spinner" aria-label="Searching" />
          ) : query ? (
            <button onClick={() => setQuery('')} className="ap-clear" aria-label="Clear search">×</button>
          ) : null}
        </div>
        {apPills(searchSubject, setSearchSubject)}
      </div>
      <div className="ap-search-results">
        {!queryActive ? (
          <>
            <p className="ap-hint">
              {recentFiles.length ? 'Recently opened' : 'Try “laplace”, “epistemology”, “boolean”…'}
            </p>
            <div className="flex flex-col gap-2.5">
              {recentFiles.slice(0, 3).map((f, i) => apDocRow(f, i, recentFiles))}
            </div>
          </>
        ) : searchResults.length === 0 && !searching ? (
          <div className="ap-empty-card">
            <p>No matches for “{query}”.</p>
            <button onClick={() => { setQuery(''); setSearchSubject('all'); }} className="ap-link">
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="ap-eyebrow mb-3">
              {searching ? 'SEARCHING…' : `${searchResults.length} DOCUMENTS · ${totalMatches} MATCHES`}
            </div>
            {/* round C P0: no list animation while reading — rows render static,
                the expanded evidence card reveals once, subtly. */}
            <div className="flex flex-col gap-2.5">
              {searchResults.map((f) => {
                const color = SUBJECT_COLORS[f.subj] || '#fff';
                const expanded = searchExpanded === f.key;
                const saved = bookmarks.includes(f.key);
                const kinds = matchKindsOf(f);
                const page = hitOpenPage(f);
                const rowMeta = kinds.includes('text')
                  ? `P. ${page} · ${(f.match_count ?? 1)} MATCH${(f.match_count ?? 1) === 1 ? '' : 'ES'}`
                  : kinds.includes('title')
                    ? `TITLE MATCH · ${f.pages} PAGES`
                    : `SUBJECT MATCH · ${f.pages} PAGES`;
                return (
                  <div key={f.key} className="ap-srow"
                    style={{ ['--subject-accent' as any]: color }}>
                    <button
                      className="ap-srow-main"
                      onClick={() => setSearchExpanded(expanded ? null : f.key)}
                      aria-expanded={expanded}
                      aria-label={`${f.title} — ${expanded ? 'collapse' : 'expand'} match details`}
                    >
                      <span className="ap-cover-sm" aria-hidden="true">
                        <DocCover subj={f.subj} title={f.title} color={color} docKey={f.key} />
                      </span>
                      <span className="ap-row-body">
                        <span className="ap-row-subj" style={{ color }}>
                          {(SUBJECT_LABELS[f.subj] || f.subj).split(' · ')[0].toUpperCase()}
                        </span>
                        <span className="ap-row-title">{f.title}</span>
                        <span className="ap-row-meta">{rowMeta}</span>
                      </span>
                      <span className={`ap-srow-chev${expanded ? ' open' : ''}`} aria-hidden="true">▸</span>
                    </button>
                    <div className="ap-srow-side">
                      <button
                        onClick={() => toggleBookmark(f.key)}
                        className={`ap-row-bm${saved ? ' on' : ''}`}
                        aria-label={saved ? 'Remove bookmark' : 'Bookmark'}
                        aria-pressed={saved}
                      >
                        {saved ? '★' : '☆'}
                      </button>
                    </div>
                    {expanded && (
                      <div className="ap-evidence">
                        <div className="ap-evidence-kinds">
                          {kinds.includes('title') && <span className="ap-evidence-kind">TITLE MATCH</span>}
                          {kinds.includes('text') && <span className="ap-evidence-kind">FULL-TEXT MATCH</span>}
                          {kinds.includes('subject') && <span className="ap-evidence-kind">SUBJECT MATCH</span>}
                        </div>
                        {(f.passages || []).slice(0, 2).map(p => (
                          <div className="ap-evidence-passage" key={p.page_number}>
                            <div className="ap-evidence-page">
                              P. {p.page_number} · {p.match_count} MATCH{p.match_count === 1 ? '' : 'ES'}
                            </div>
                            <p className="ap-evidence-snippet">{highlightQuery(p.snippet, query)}</p>
                          </div>
                        ))}
                        <button onClick={() => openSearchHit(f)} className="ap-evidence-cta">
                          Open at page {page} →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ---------- ATLAS POCKET floating dock ----------
  const dockTabs = [
    { id: 'home', label: 'HOME', icon: Home01Icon },
    { id: 'library', label: 'LIBRARY', icon: LibraryIcon },
    { id: 'search', label: 'SEARCH', icon: Search01Icon },
  ];
  const dockTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dockIndicatorRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const move = () => {
      const i = dockTabs.findIndex(t => t.id === mobileTab);
      const btn = dockTabRefs.current[i];
      const ind = dockIndicatorRef.current;
      if (btn && ind) {
        const x = btn.offsetLeft + btn.offsetWidth / 2 - 12;
        ind.style.transform = `translateX(${x}px)`;
      }
    };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileTab]);
  const mobileNav = (
    <nav className="ap-dock" aria-label="Primary">
      <div className="ap-dock-indicator" ref={dockIndicatorRef} aria-hidden="true" />
      {dockTabs.map((t, i) => {
        const active = mobileTab === t.id;
        return (
          <button
            key={t.id}
            ref={el => { dockTabRefs.current[i] = el; }}
            onClick={() => { setMobileTab(t.id); window.scrollTo({ top: 0 }); }}
            className={`ap-dock-tab${active ? ' active' : ''}`}
            aria-label={t.label}
            aria-current={active ? 'page' : undefined}
          >
            <HugeiconsIcon icon={t.icon} size={20} strokeWidth={1.8} />
            <span className="ap-dock-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );


  return (
    <div
      className={isMobile ? "relative w-full bg-[#030406] overflow-y-auto ap-root" : "relative w-full min-h-screen overflow-y-auto"}
      style={isMobile ? { minHeight: '100dvh' } : undefined}
    >
      {/* film grain over the void — desktop only (round A) */}
      {!isMobile && <Noise opacity={0.05} />}
      {isMobile ? (
        readerFile ? (
          <MobileReader
            file={readerFile}
            subjectLabel={SUBJECT_LABELS[readerFile.subj] || readerFile.subj}
            sectionLabel={SECTION_LABELS[readerFile.section] || readerFile.section}
            onClose={() => setReaderKey(null)}
            bookmarked={bookmarks.includes(readerFile.key)}
            onToggleBookmark={() => toggleBookmark(readerFile.key)}
            docIndex={Math.max(0, readerList.indexOf(readerFile.key))}
            docTotal={readerList.length}
            onPrev={(() => {
              const i = readerList.indexOf(readerFile.key);
              const prev = i > 0 ? readerList[i - 1] : null;
              return prev ? () => openReader(prev, readerList) : null;
            })()}
            onNext={(() => {
              const i = readerList.indexOf(readerFile.key);
              const next = i >= 0 && i < readerList.length - 1 ? readerList[i + 1] : null;
              return next ? () => openReader(next, readerList) : null;
            })()}
            contents={readerContents}
            bookmarkedDocs={readerBookmarked}
            onOpenDoc={(key) => openReader(key, readerList)}
          />
        ) : (
          <>
            {mobileTab === 'home' && mobileHome}
            {mobileTab === 'library' && mobileLibrary}
            {mobileTab === 'search' && mobileSearch}
            <div className="ki-dock-fade" aria-hidden="true" />
            {mobileNav}
          </>
        )
      ) : (
        <div className="ke-shell">
          <div className="flex items-start">
            {atlasSidebar}
            <main className="flex-1 min-w-0">
              {view === 'overview' && overviewView}
              {view === 'library' && libraryView}
              {view === 'search' && searchView}
            </main>
          </div>
        </div>
      )}
      {/* reader — desktop only; mobile uses the immersive MobileReader above */}
      {readerFile && !isMobile && (
        <PdfReader
          file={readerFile}
          sectionLabel={SECTION_LABELS[readerFile.section] || readerFile.section}
          onClose={() => setReaderKey(null)}
          bookmarked={bookmarks.includes(readerFile.key)}
          onToggleBookmark={() => toggleBookmark(readerFile.key)}
          docIndex={Math.max(0, readerList.indexOf(readerFile.key))}
          docTotal={readerList.length}
          onPrev={(() => {
            const i = readerList.indexOf(readerFile.key);
            const prev = i > 0 ? readerList[i - 1] : null;
            return prev ? () => openReader(prev, readerList) : null;
          })()}
          onNext={(() => {
            const i = readerList.indexOf(readerFile.key);
            const next = i >= 0 && i < readerList.length - 1 ? readerList[i + 1] : null;
            return next ? () => openReader(next, readerList) : null;
          })()}
          contents={readerContents}
          bookmarkedDocs={readerBookmarked}
          onOpenDoc={(key) => openReader(key, readerList)}
        />
      )}
    </div>
  );
}
