import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import PdfReader from './components/PdfReader';
import MobileReader from './components/MobileReader';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, LibraryIcon, Search01Icon, Bookmark01Icon } from '@hugeicons/core-free-icons';
// ChatGPT Round B early loop (2026-11-03): FIELD EDITION mobile rebuild
import MobileHome from './components/MobileHome';
import MobileLibrary, { MobileSaved } from './components/MobileLibrary';
import MobileSearch from './components/MobileSearch';
import MobileDock from './components/MobileDock';
import MobileSubjectIndex from './components/MobileSubjectIndex';
import { setReaderStartPage, setReaderMatch } from './readerStart';
// ChatGPT Round A desktop rebuild (2026-11-03): new navigation shell + pages
import DesktopSidebar, { type SidebarView } from './components/navigation/DesktopSidebar';
import Topbar from './components/navigation/Topbar';
import GlobalBackdrop from './components/GlobalBackdrop';
import Overview from './pages/Overview';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
// Shared types, subject data (single source of truth), and helpers
import {
  SUBJECTS,
  SECTION_LABELS,
  getSubjectCounts,
  fileKey,
  hitOpenPage,
} from './shared';
import type { LibFile, SearchHit } from './shared';
import './index.css';
// OBSIDIAN ATLAS (ChatGPT Round A desktop redesign, 2026-11-05) — LAST
// import so its scoped .kiA-desktop / .reader-shell.kiA-v2 rules win
// over the morning build's page CSS. Desktop-only selectors; mobile
// (.mobile-shell) never matches.
import './styles/obsidian-atlas.css';
// KNOWLEDGE INSTRUMENT (ChatGPT Round A desktop FULL REDESIGN,
// 2026-11-06) — imported after obsidian-atlas.css so its rules win.
// Same desktop-only scope; mobile never matches.
import './styles/knowledge-instrument.css';
// FIELD EDITION (ChatGPT Round A desktop, afternoon loop 2026-11-06,
// critiqueA-1420 spec: P0 foundation + P1 Overview) — imported LAST
// so its rules win. Every rule lives under `.desktop-app`.
import './styles/field-edition.css';
// LIVING ARCHIVE (ChatGPT Round A desktop, 2026-11-09, critiqueA
// spec: G1 foundation + G2 Reader + G3 Search three-zone + G4
// Overview/FIS + G5 React Bits restraint) — imported LAST so its
// rules win. Desktop-only; mobile (.mobile-shell) never matches.
import './styles/living-archive.css';
// ROUND I (ChatGPT Round A desktop, 2026-11-10, critiqueA spec:
// "THE LIVING ARCHIVE — FIELD ATLAS") — imported LAST so its rules
// win. Desktop-only; mobile (.mobile-shell) never matches.
import './styles/roundI.css';
// ROUND I.1 (ChatGPT Round A desktop, 2026-11-10, critiqueA-1420
// §9: precision round — typography hierarchy, reader PDF scale,
// discipline plates, search results, 1366 composition, FIS
// typography) — imported after roundI.css so its rules win.
// Desktop-only; mobile (.mobile-shell) never matches.
import './styles/roundI1.css';
// ROUND I.2 (ChatGPT Round A desktop re-score, 2026-11-11,
// critiqueA-2026-11-11.md: desktop 9.27/10, target 9.60+ —
// precision polish, NOT a redesign: overview >=1501px hero
// +8-12%, search title dominance, quieter reader console,
// full-height reader staging, FIS chapter titles, 1366
// composition) — imported LAST so its rules win. Desktop-only;
// mobile (.mobile-shell) never matches.
import './styles/roundI2.css';
// ROUND I.3 (ChatGPT Round A desktop re-score, 2026-11-11,
// critiqueA-1420-2026-11-11.md: desktop 9.43/10, target 9.60+ —
// SURGICAL finishing pass, 5 items only: discipline-card accent
// identity, search title dominance, quieter reader console,
// full-height reader light well, 1366 composition + FIS delta)
// — imported LAST so its rules win. Desktop-only;
// mobile (.mobile-shell) never matches.
import './styles/roundI3.css';
// ROUND B (ChatGPT Round B mobile re-score, 2026-11-11,
// critiqueB-1420-2026-11-11.md: mobile 9.63 -> 9.65/10, APPROVED —
// LOCK MOBILE. Preservation pass ONLY: 5 micro-fixes + the Reader
// frame refinement) — imported LAST so its rules win. MOBILE ONLY;
// every rule lives under .mobile-shell. Desktop never matches.
import './styles/roundB.css';
// ROUND I.4 (ChatGPT Round A desktop re-score, 2026-11-12,
// critiqueA-2026-11-12.md: desktop 9.43 -> 9.45/10, target 9.60+ —
// precision desktop art-direction pass, 7 items: typography
// hierarchy, 1366 composition, reader console hierarchy, overview
// hero composition, search result dominance, FIS editorial
// statement, React Bits (BlurText/SpotlightCard/GlareHover/
// AnimatedContent/CountUp only). Desktop-only; mobile frozen.
// Imported LAST so its rules win.
import './styles/roundI4.css';
// ROUND B2 (ChatGPT Round B mobile re-score, 2026-11-12,
// critiqueB-2026-11-12.md: mobile 9.65 -> 9.68/10, FINAL APPROVAL —
// LOCK IT. P3 micro-fixes ONLY: hero/archive separation +8px,
// Digital featured title->meta gap +4px; subject-rail edge fade
// SKIPPED — already live, see roundB2.css) — imported LAST so its
// rules win. MOBILE ONLY; every rule lives under .mobile-shell.
// Desktop never matches.
import './styles/roundB2.css';
// ROUND I.5 (ChatGPT Round C desktop re-score, 2026-11-12,
// critiqueC-2026-11-12.md: desktop 9.45 -> 9.58/10, target 9.60+ —
// "Instrument Polish", 6 small items then STOP: reader console as
// one instrument, atmospheric reader stage, search selected-hit
// hierarchy, 1366 composition (measured: no change — spec values
// looser than live I.4), FIS statement transition, low-contrast
// micro-labels. Desktop-only; mobile frozen. Imported LAST so its
// rules win.
import './styles/roundI5.css';
// ROUND I.5.1 (ChatGPT Round A desktop re-score, 2026-11-13,
// critiqueA-2026-11-13.md: desktop 9.58 -> 9.63/10, TARGET 9.6
// PASSED — redesign series OVER: FREEZE, precision cleanup only:
// disciplines separation, search selected-hit authority, reader
// console cohesion (gap 30 -> 18), reader stage min-height +
// padding-top, 1366 compression (min-height 240 -> 220; hero
// padding NOT applied — would push plates below the fold).
// Desktop-only; mobile frozen. Imported LAST so its rules win.
import './styles/roundI51.css';
// React Bits Noise — global film grain, opacity 0.025 (critiqueA
// 2026-11-07 §Global: 4-layer background, mix-blend screen).
// Desktop only; the component is position:fixed + pointer-events:none.
import Noise from './bits/Noise';
// React Bits Aurora — GLOBAL atmosphere layer (critiqueA 2026-11-07:
// Aurora behind the entire main content, very low opacity, spec
// colorStops). Replaces the hero-only Aurora (removed from Overview).
import Aurora from './bits/Aurora';
// House-written contour-field texture (React Bits has no Topography
// component — verified 2026-11-07). Global background layer 2.
import TopographyLayer from './components/TopographyLayer';
// React Bits Web Threads (verified real 2026-11-07:
// reactbits.dev/backgrounds/web-threads, registry WebThreads-TS-TW).
// Search background identity (Round A 2026-11-08 spec §10).
import WebThreads from './bits/WebThreads';
// React Bits Flux Lines (verified real 2026-11-08:
// reactbits.dev/backgrounds/flux-lines, registry FluxLines-TS-CSS,
// vendored verbatim in bits/FluxLines.tsx). Overview background
// identity (Round A 2026-11-08 spec §2/§10) — replaces the Round C
// Web Threads test layer on Overview; Web Threads stays Search-only.
import FluxLines from './bits/FluxLines';

// (LibFile / SearchHit live in ./shared — imported above.)

// Mobile-path compatibility aliases, derived from the shared SUBJECTS table
// (single source of truth). The new desktop pages read shared.ts directly.
const SUBJECT_COLORS: Record<string, string> = Object.fromEntries(SUBJECTS.map(s => [s.id, s.color]));
const SUBJECT_LABELS: Record<string, string> = {
  'em2': 'EM2 · Mathematics',
  'signals': 'Signals & Systems',
  'fis': 'FIS · Philosophy',
  'digital': 'Digital Electronics',
};
const SUBJECT_CODES: Record<string, string> = Object.fromEntries(SUBJECTS.map(s => [s.id, s.code]));

export default function App() {
  const [files, setFiles] = useState<LibFile[]>([]);
  const [query, setQuery] = useState('');
  const [readerKey, setReaderKey] = useState<string | null>(null);
  const [indexFilter, setIndexFilter] = useState('');
  const [indexSection, setIndexSection] = useState<string>('all');
  const [indexSubject, setIndexSubject] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<string>('home');
  // ATLAS desktop views (ChatGPT round C): overview | library | search
  const [view, setView] = useState<'overview' | 'library' | 'search'>('overview');
  const [searchSubject, setSearchSubject] = useState<string>('all');
  // v2.0 search filter bar: discipline + type + sort, all working together.
  const [searchType, setSearchType] = useState<string>('all');
  const [searchSort, setSearchSort] = useState<'relevance' | 'recent'>('relevance');
  useEffect(() => { setSearchType('all'); }, [query, searchSubject]);
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
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kl:bookmarks') || '[]'); } catch { return []; }
  });
  const [recentOpened, setRecentOpened] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kl:recent') || '[]'); } catch { return []; }
  });
  const [readerList, setReaderList] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openReader = useCallback((key: string, list: string[]) => {
    // Round B 2026-11-08 P2 (1420 loop): preserve the list scroll position
    // across the reader. Opening the reader UNMOUNTS the tab content, so
    // #root's scrollHeight collapses to the fixed reader and scrollTop
    // clamps to 0 — measured live: library 1214 → 0 on close. Save the
    // offset here (only when NOT already reading — prev/next inside the
    // reader must not overwrite the good value with 0) and restore it in
    // the readerKey effect below when the reader closes. Mobile only
    // (#kl-mobile-scroll exists only on the mobile branch — a live DOM
    // check, so no stale-closure risk in this useCallback): desktop
    // keeps its own reader behaviour untouched.
    if (!document.querySelector('.mr-reader') && document.getElementById('kl-mobile-scroll')) {
      try {
        const el = document.getElementById('root');
        if (el) sessionStorage.setItem('kl:reader-return-scroll', String(el.scrollTop));
      } catch { /* ignore */ }
    }
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

  // Round B 2026-11-08 P2: restore the list scroll position when the
  // reader closes (see openReader above). Runs after the tab content
  // remounts — 60ms lets layout settle. Clears the saved value so a
  // stale offset never re-applies. The first run clears any value left
  // by a reload-while-reading instead of scrolling on load. Search has
  // its own kl:msearch:scroll restore; both write the same value.
  const readerReturnMounted = useRef(false);
  useEffect(() => {
    if (!readerReturnMounted.current) {
      readerReturnMounted.current = true;
      try { sessionStorage.removeItem('kl:reader-return-scroll'); } catch { /* ignore */ }
      return;
    }
    if (readerKey !== null) return;
    // Mobile only — #kl-mobile-scroll exists solely on the mobile branch.
    if (!document.getElementById('kl-mobile-scroll')) return;
    let v = 0;
    try { v = parseInt(sessionStorage.getItem('kl:reader-return-scroll') || '0', 10); } catch { /* ignore */ }
    if (!Number.isFinite(v) || v <= 0) return;
    // Two attempts: the list can still be settling (lazy thumbs/fonts)
    // when the first fires, clamping scrollTop a few px short (measured
    // 588 → 579). The second attempt only ever corrects an upward
    // shortfall — it never pulls the user back down past where they are.
    const attempt = () => {
      const el = document.getElementById('root');
      if (el && el.scrollTop < v - 4) el.scrollTop = v;
    };
    const t1 = window.setTimeout(attempt, 60);
    const t2 = window.setTimeout(() => {
      attempt();
      try { sessionStorage.removeItem('kl:reader-return-scroll'); } catch { /* ignore */ }
    }, 300);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [readerKey]);

  // Round B 2026-11-09 P1: preserve each tab's scroll position across
  // DOCK tab switches (Library <-> Search <-> Home <-> Saved). The
  // reader-return effect above covers Reader -> list; this covers the
  // tab-switch gap the pre-probe measured live (Library 600 -> Search ->
  // Library reset to 0). Only the dock sets the flag — Home tiles and
  // search-submit navigations are FRESH navigations and must land at the
  // top, so when the tab changes without the flag this effect resets
  // #root scrollTop to 0 (the window.scrollTo({top:0}) in those handlers
  // cannot do it: #root is the scroller, window never scrolls — measured
  // live: a tile tap landed at 539 without this reset). The flag is
  // consumed on every mobileTab change, so a same-tab re-tap can never
  // arm a stale restore for a later tile navigation. Mobile only
  // (#kl-mobile-scroll exists solely on the mobile branch); desktop
  // keeps its own nav.
  const tabScrollKey = (tab: string) => `kl:tab-scroll:${tab}`;
  const tabSwitchRef = useRef(false);
  const prevTabRef = useRef(mobileTab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = mobileTab;
    const fromDock = tabSwitchRef.current;
    tabSwitchRef.current = false; // consume exactly once per tab change
    if (readerKey !== null) return;
    if (!document.getElementById('kl-mobile-scroll')) return;
    if (mobileTab === prev) return; // readerKey-only run: never touch scroll
    const el = document.getElementById('root');
    if (!el) return;
    if (!fromDock) {
      // Fresh navigation (tile / search-submit / back): land at the top.
      el.scrollTop = 0;
      return;
    }
    let v = 0;
    try { v = parseInt(sessionStorage.getItem(tabScrollKey(mobileTab)) || '0', 10); } catch { /* ignore */ }
    if (!Number.isFinite(v) || v <= 0) return;
    // Same shape as the reader-return restore, plus a 1200ms attempt:
    // a remounted Search list can still be rendering results at 300ms
    // and clamp the restore short (measured 400 -> 381 without it).
    // Attempts only ever correct an upward shortfall, never pull down.
    const attempt = () => {
      const el2 = document.getElementById('root');
      if (el2 && el2.scrollTop < v - 4) el2.scrollTop = v;
    };
    const t1 = window.setTimeout(attempt, 60);
    const t2 = window.setTimeout(attempt, 300);
    const t3 = window.setTimeout(attempt, 1200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
  }, [mobileTab, readerKey]);

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
  // mobile search error state — retry preserves query + filters (Round C)
  const [searchError, setSearchError] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setApiResults([]); setSearching(false); setSearchError(false); return; }
    setSearching(true);
    setSearchError(false);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => { if (!r.ok) throw new Error(`search ${r.status}`); return r.json(); })
        .then(d => { setApiResults(Array.isArray(d.results) ? d.results : []); setSearching(false); })
        .catch(err => {
          if ((err as Error)?.name !== 'AbortError') { setApiResults([]); setSearching(false); setSearchError(true); }
        });
    }, 240);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, searchRetry]);

  const [searchSelected, setSearchSelected] = useState(0);
  useEffect(() => { setSearchSelected(0); }, [query, searchSubject, searchType, searchSort]);

  // open timestamps — also drives the search "recently opened" sort
  const recentTs: Record<string, number> = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('kl:recentTs') || '{}'); } catch { return {}; }
  }, [recentOpened]);

  const readerFile = files.find(f => f.key === readerKey) || null;
  // Per-subject document number for the reader identity strip (real
  // position of this doc within its subject, in library order).
  const readerDocNumber = useMemo(() => {
    if (!readerFile) return null;
    const inSubject = files.filter(f => f.subj === readerFile.subj);
    const i = inSubject.findIndex(f => f.key === readerFile.key);
    return i >= 0 ? i + 1 : null;
  }, [files, readerFile]);


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

  // search results — full-text hits first, title fallback when index missing.
  // v2.0: discipline (subject) → type (section) → sort (relevance/recent),
  // all working together; the reader's prev/next list follows the same order.
  const searchBase: SearchHit[] = useMemo(() => {
    const base: SearchHit[] = apiResults.length
      ? apiResults
      : matches.map(f => ({ ...f, kind: 'title' as const, page: 0, excerpt: '' }));
    if (searchSubject === 'all') return base;
    return base.filter(f => f.subj === searchSubject);
  }, [apiResults, matches, searchSubject]);

  const searchSections = useMemo(() => {
    const seen = new Set<string>();
    for (const r of searchBase) seen.add(r.section);
    return [...seen];
  }, [searchBase]);

  const searchResults: SearchHit[] = useMemo(() => {
    let out = searchType === 'all' ? searchBase : searchBase.filter(r => r.section === searchType);
    if (searchSort === 'recent') {
      out = [...out].sort((a, b) => (recentTs[b.key] || 0) - (recentTs[a.key] || 0));
    }
    return out;
  }, [searchBase, searchType, searchSort, recentTs]);

  // evidence summary (ChatGPT round C P0): "N documents · M matches"
  const totalMatches = useMemo(() =>
    searchResults.reduce((s, f) => s + (typeof f.match_count === 'number' ? f.match_count : 1), 0),
  [searchResults]);

  // search keyboard (desktop only): / focuses, arrows move, Enter opens, Escape clears
  // Round A fix (2026-11-07): when the reader overlay is open, search-view
  // shortcuts must not fire — Escape belongs to the reader (close), and
  // Enter would otherwise open a search hit behind the reader. Previously
  // the first physical Escape only cleared the query and the reader needed
  // a second press to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isMobile) return;
      if (readerKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !inInput && !e.metaKey && !e.ctrlKey) {
        if (view === 'search') { e.preventDefault(); searchInputRef.current?.focus(); }
        return;
      }
      if (view !== 'search' || !queryActive) return;
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
        if (queryActive) setQuery('');
        else if (inInput) (e.target as HTMLElement).blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, isMobile, mobileTab, queryActive, searchResults, searchSelected, openReader, readerKey]);

  // Subject counts — single source of truth via shared.getSubjectCounts.
  const subjectCounts = useMemo(() => getSubjectCounts(files), [files]);

  // Round C re-score: real per-subject page totals for the hero constellation preview.
  const subjectPages = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of files) m[f.subj] = (m[f.subj] ?? 0) + (f.pages || 0);
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

  // ---------- ChatGPT Round A desktop shell (2026-11-03) ----------
  // gotoLibrary drives subject navigation for the new sidebar + pages.
  const gotoLibrary = (subject: string, bookmarksOnly = false) => {
    setIndexSubject(subject);
    setIndexSection('all');
    setIndexFilter('');
    setLibraryBookmarksOnly(bookmarksOnly);
    setView('library');
    window.scrollTo({ top: 0 });
  };
  const gotoLibrarySubject = (subj: string) => gotoLibrary(subj);
  const goSearch = () => {
    setView('search');
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };
  const submitSearch = (q: string) => {
    setQuery(q);
    setView('search');
  };
  const sidebarView: SidebarView =
    view === 'library' && libraryBookmarksOnly ? 'bookmarks' : view;
  const handleSidebarNav = (v: SidebarView) => {
    if (v === 'overview') setView('overview');
    else if (v === 'search') goSearch();
    else if (v === 'recent') { setLibrarySort('recent'); gotoLibrary('all'); }
    else if (v === 'bookmarks') gotoLibrary('all', true);
    else gotoLibrary('all');
    window.scrollTo({ top: 0 });
  };

  const openSearchHit = (hit: SearchHit, page?: number) => {
    // always open AT the best matching page (round C P0: "Open at page N");
    // MobileSearch may override with a specific passage page.
    const openPage = page ?? hitOpenPage(hit);
    setReaderStartPage(hit.key, openPage);
    // Honest match banner (Round C P1): the REAL backend snippet for the
    // page being opened. No phrase-level highlight exists — pages are
    // server-rendered images with no text layer and the backend returns
    // no coordinates — so the banner shows the snippet, never a fake mark.
    const passage = hit.passages?.find(pg => pg.page_number === openPage)
      ?? hit.passages?.[0];
    if (passage?.snippet) setReaderMatch(hit.key, openPage, passage.snippet);
    openReader(hit.key, searchResults.map(r => r.key));
  };

  // ============ ATLAS POCKET mobile architecture (ChatGPT round B, 2026-11-02) ============
  // Purpose-built premium study app: Home = cinematic/personal, Library = dense,
  // Search = intelligent, Reader = immersive (MobileReader). isMobile ≤820px.
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



  // Mobile page background identity (Round B 2026-11-04, 1420 loop):
  // .mobile-shell + data-subject drive styles/field-atmosphere.css (the
  // exact background spec: --void/--navy/--panel, 32px grid, grain,
  // subject-colored lighting). .ap-root stays for BottomSheet scroll
  // locking. Desktop branch never renders these — desktop is untouched.
  const mobilePageClass = !isMobile ? '' : (() => {
    const parts = ['ap-page-' + mobileTab];
    if (mobileTab === 'library' && indexSubject !== 'all') parts.push('ap-subject-' + indexSubject);
    return parts.join(' ');
  })();
  const mobileSubject = isMobile && mobileTab === 'library' && indexSubject !== 'all'
    ? indexSubject : undefined;

  return (
    <div
      className={isMobile ? `relative w-full bg-[#030406] overflow-y-auto ap-root mobile-shell ${mobilePageClass}` : "relative w-full min-h-screen overflow-y-auto"}
      style={isMobile ? { minHeight: '100dvh' } : undefined}
      {...(isMobile ? { id: 'kl-mobile-scroll' } : {})}
      {...(mobileSubject ? { 'data-subject': mobileSubject } : {})}
    >
      {/* fixed atmosphere layers (field-atmosphere.css): soft card light +
          FIS paper grain — purely decorative, continuous while scrolling */}
      {isMobile && !readerFile && (
        <>
          <div className="mobile-cardlight" aria-hidden="true" />
          <div className="mobile-papergrain" aria-hidden="true" />
        </>
      )}
      {isMobile ? (
        readerFile ? (
          <MobileReader
            file={readerFile}
            subjectLabel={SUBJECT_LABELS[readerFile.subj] || readerFile.subj}
            subjectCode={SUBJECT_CODES[readerFile.subj] || readerFile.subj.toUpperCase()}
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
            reducedMotion={reducedMotion}
          />
        ) : (
          <>
            {mobileTab === 'home' && (
              <MobileHome
                totalDocs={files.length}
                totalPages={files.reduce((s, f) => s + (f.pages || 0), 0)}
                subjectCounts={subjectCounts}
                subjectPages={subjectPages}
                resume={resumeFile ? { file: resumeFile, page: Math.min(resumePage, resumeFile.pages) } : null}
                recent={recentFiles.map(f => ({ file: f, ts: recentTs[f.key] ?? null }))}
                reducedMotion={reducedMotion}
                onOpenSubject={(subj) => { setIndexSubject(subj); setLibraryBookmarksOnly(false); setMobileTab('library'); window.scrollTo({ top: 0 }); }}
                onOpenReader={openReader}
                onSearch={(q) => { setQuery(q); setMobileTab('search'); window.scrollTo({ top: 0 }); }}
              />
            )}
            {mobileTab === 'library' && indexSubject === 'all' && (
              <MobileLibrary
                files={files}
                indexFiles={indexFiles}
                subjectCounts={subjectCounts}
                indexSubject={indexSubject}
                onSubjectChange={(subj) => { setIndexSubject(subj); setLibraryBookmarksOnly(false); }}
                filter={indexFilter}
                onFilterChange={setIndexFilter}
                section={indexSection}
                onSectionChange={setIndexSection}
                sort={librarySort}
                onSortChange={setLibrarySort}
                bookmarksOnly={libraryBookmarksOnly}
                onBookmarksOnlyChange={setLibraryBookmarksOnly}
                recentKeys={recentOpened}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
                onOpenReader={openReader}
                onClearFilters={clearLibraryFilters}
                activeFilterCount={activeFilterCount}
                reducedMotion={reducedMotion}
              />
            )}
            {mobileTab === 'library' && indexSubject !== 'all' && (
              <div className="mobile-page" style={{ paddingLeft: 18, paddingRight: 18,
                /* Round B P0: scrollable bottom padding so the featured
                 * (START HERE) card clears the fixed dock when scrolled to */
                paddingBottom: 'calc(100px + env(safe-area-inset-bottom))' }}
                data-subject={indexSubject}>
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
                  onBack={() => setIndexSubject('all')}
                  onSearchQuery={(q) => { setQuery(q); setMobileTab('search'); window.scrollTo({ top: 0 }); }}
                  onOpenSubject={(subj) => { setIndexSubject(subj); setLibraryBookmarksOnly(false); setMobileTab('library'); window.scrollTo({ top: 0 }); }}
                />
              </div>
            )}
            {mobileTab === 'search' && (
              <MobileSearch
                query={query}
                onQueryChange={setQuery}
                results={searchResults}
                searching={searching}
                searchError={searchError}
                onRetry={() => setSearchRetry(n => n + 1)}
                totalMatches={totalMatches}
                searchSubject={searchSubject}
                onSubjectChange={setSearchSubject}
                currentSubject={indexSubject}
                subjectCounts={subjectCounts}
                recentKeys={recentOpened}
                recentDocs={recentOpened
                  .map(k => files.find(f => f.key === k))
                  .filter((f): f is LibFile => !!f)
                  .slice(0, 4)
                  .map(f => ({ key: f.key, title: f.title, subj: f.subj }))}
                onOpenRecent={(key) => openReader(key, [key])}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
                onOpenHit={openSearchHit}
                onBack={() => setMobileTab('home')}
                onClearAll={() => { setQuery(''); setSearchSubject('all'); }}
              />
            )}
            {mobileTab === 'saved' && (
              <MobileSaved
                files={files}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
                onOpenReader={openReader}
                reducedMotion={reducedMotion}
              />
            )}
            <div className="ki-dock-fade" aria-hidden="true" />
            <MobileDock
              tabs={[
                { id: 'home', label: 'HOME', icon: <HugeiconsIcon icon={Home01Icon} size={20} strokeWidth={1.8} /> },
                { id: 'library', label: 'LIBRARY', icon: <HugeiconsIcon icon={LibraryIcon} size={20} strokeWidth={1.8} /> },
                { id: 'search', label: 'SEARCH', icon: <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} /> },
                { id: 'saved', label: 'SAVED', icon: <HugeiconsIcon icon={Bookmark01Icon} size={20} strokeWidth={1.8} /> },
              ]}
              active={mobileTab}
              onSelect={(id) => {
                // Round B 2026-11-09: save this tab's scroll before
                // switching so the dock-switch restore effect can bring
                // it back. Mobile only; desktop has no #kl-mobile-scroll.
                try {
                  const el = document.getElementById('root');
                  if (el && document.getElementById('kl-mobile-scroll')) {
                    sessionStorage.setItem(tabScrollKey(mobileTab), String(el.scrollTop));
                  }
                } catch { /* ignore */ }
                tabSwitchRef.current = true;
                setMobileTab(id); window.scrollTo({ top: 0 });
              }}
            />
          </>
        )
      ) : (
        <div className="desktop-app kiA-desktop kiA-v2" style={{ marginLeft: 'var(--sidebar-width, 264px)' }}
          data-view={view}
          {...(view === 'library' && indexSubject !== 'all' ? { 'data-subject': indexSubject } : {})}
        >
          <GlobalBackdrop />
          {/* LAYER 1 — React Bits Aurora, OVERVIEW ONLY. Round A
              2026-11-08 spec §2: opacity 0.16 (was 0.22), blur 40px
              via .de-aurora-global CSS — depth, not lines. */}
          {view === 'overview' && (
            <div className="de-aurora-global" aria-hidden="true">
              <Aurora
                colorStops={['#083d4b', '#071724', '#0d2937']}
                amplitude={0.35}
                blend={0.92}
                height={0.34}
                speed={0.16}
                scale={1.7}
                glow={0.22}
                brightness={0.34}
                layers={2}
                direction="top"
                mouseInteraction
                opacity={0.16}
                intro
              />
            </div>
          )}
          {/* LAYER 2 — React Bits Flux Lines, OVERVIEW ONLY (Round A
              2026-11-08 spec §2/§10: Overview identity = Flux Lines;
              color #38d9d0, opacity 0.11, speed 0.12). Replaces the
              Round C Web Threads test layer here — one background
              field per page; Web Threads stays Search-only. */}
          {view === 'overview' && (
            <div className="de-fluxlines" aria-hidden="true">
              <FluxLines
                colors={['#38d9d0', '#1d7f8c', '#54e7df']}
                speed={0.12}
                scale={1.6}
                turbulence={1}
                fluidity={0.1}
                rimWidth={0.2}
                sharpness={2.5}
                shimmer={1.5}
                glow={2}
                lineWidth={1}
                flowDirection="down"
                opacity={0.11}
                mouseInteraction
                mouseStrength={0.6}
                mouseRadius={0.35}
                clickSwirl={false}
                intro
                transparent
              />
            </div>
          )}
          {/* ROUND A 2026-11-08 (spec §2/§10): Web Threads is the
              SEARCH background identity — but much quieter than the
              2026-11-07 build (opacity 0.35 → 0.15, brightness 0.25
              → 0.12, threads 6 → 5). Round A 2026-11-08 (critiqueA
              -1420 §B): opacity 0.15 -> 0.10, inside the spec's
              0.07-0.11 range for background lines. One background
              field per page — INSTEAD OF Topography. */}
          {view === 'search' && (
            <div className="de-webthreads de-webthreads--search" aria-hidden="true">
              <WebThreads
                colors={['#1d7f8c', '#2b6f8f', '#54e7df']}
                coreColor="#bff3ee"
                backgroundColor="transparent"
                threadCount={5}
                speed={0.08}
                frequency={3}
                spread={0.18}
                glow={0.02}
                thickness={0.8}
                brightness={0.12}
                opacity={0.10}
                mouseInteraction
                mouseStrength={0.3}
                pulseOnClick
                intro
              />
            </div>
          )}
          {/* LAYER 2 — house-written Topography contour field (slow
              drift). Opacity prop scales the baked 0.10 stroke alpha:
              0.55 → effective 0.055 (critiqueC P0). Skipped on the
              Overview and Search, where Web Threads is the field.
              ROUND I 2026-11-10 (critiqueA §B): Topography IS the
              Overview texture too now — very subtle (opacity 0.8 →
              0.08 effective, inside the spec's 8–12%), mounted as
              its own fixed layer so it never stacks with the
              library's global one. Search keeps Web Threads only. */}
          {view === 'overview' && (
            <TopographyLayer
              className="de-topo-overview"
              opacity={0.8}
            />
          )}
          {view !== 'overview' && view !== 'search' && (
            <TopographyLayer
              className="de-topo-global"
              opacity={0.55}
            />
          )}
          {/* LAYER 4 — React Bits Noise grain, opacity 0.018
              (critiqueC P0: was 0.025), screen blend. */}
          <div className="de-noise-wrap" aria-hidden="true">
            <Noise opacity={0.018} />
          </div>
          <DesktopSidebar
            files={files}
            view={sidebarView}
            onNavigate={handleSidebarNav}
            onGoSubject={gotoLibrarySubject}
            activeSubject={view === 'library' && indexSubject !== 'all' ? indexSubject : null}
          />
          <Topbar onSearch={goSearch} crumb={view === 'library' ? 'LIBRARY' : view === 'search' ? 'SEARCH' : 'OVERVIEW'} totalDocs={files.length} />
          <main className="kiA-main">
            {view === 'overview' && (
              <Overview
                files={files}
                onOpenReader={openReader}
                onSubmitSearch={submitSearch}
                onGoSubject={gotoLibrarySubject}
                onGoSearch={goSearch}
              />
            )}
            {view === 'library' && (
              <LibraryPage
                files={files}
                subject={indexSubject}
                onSubjectChange={(s) => { setIndexSubject(s); setLibraryBookmarksOnly(false); }}
                filter={indexFilter}
                onFilterChange={setIndexFilter}
                section={indexSection}
                onSectionChange={setIndexSection}
                sort={librarySort}
                onSortChange={setLibrarySort}
                viewMode={libraryViewMode}
                onViewModeChange={setLibraryViewMode}
                bookmarksOnly={libraryBookmarksOnly}
                onBookmarksOnlyChange={setLibraryBookmarksOnly}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
                onOpenReader={openReader}
                counts={subjectCounts}
                total={files.length}
              />
            )}
            {view === 'search' && (
              <SearchPage
                query={query}
                onQueryChange={setQuery}
                results={searchResults}
                searching={searching}
                totalMatches={totalMatches}
                counts={subjectCounts}
                total={files.length}
                searchSubject={searchSubject}
                onSubjectChange={setSearchSubject}
                typeFilter={searchType}
                onTypeFilterChange={setSearchType}
                resultSections={searchSections}
                sortMode={searchSort}
                onSortModeChange={setSearchSort}
                selected={searchSelected}
                onSelect={setSearchSelected}
                onOpen={openSearchHit}
                onOpenStart={(hit) => openSearchHit(hit, 1)}
                inputRef={searchInputRef}
                searchError={searchError}
                onRetry={() => setSearchRetry(n => n + 1)}
              />
            )}
          </main>
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
          docNumber={readerDocNumber ?? undefined}
        />
      )}
    </div>
  );
}
