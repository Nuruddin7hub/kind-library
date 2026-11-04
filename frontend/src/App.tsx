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
import { setReaderStartPage } from './readerStart';
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isMobile) return;
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
  }, [view, isMobile, mobileTab, queryActive, searchResults, searchSelected, openReader]);

  // Subject counts — single source of truth via shared.getSubjectCounts.
  const subjectCounts = useMemo(() => getSubjectCounts(files), [files]);

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
    setReaderStartPage(hit.key, page ?? hitOpenPage(hit));
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
              <div className="mobile-page" style={{ paddingLeft: 18, paddingRight: 18 }}>
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
              onSelect={(id) => { setMobileTab(id); window.scrollTo({ top: 0 }); }}
            />
          </>
        )
      ) : (
        <div className="kiA-desktop kiA-v2" style={{ marginLeft: 'var(--sidebar-width, 248px)' }}>
          <GlobalBackdrop />
          <DesktopSidebar
            files={files}
            view={sidebarView}
            onNavigate={handleSidebarNav}
            onGoSubject={gotoLibrarySubject}
            activeSubject={view === 'library' && indexSubject !== 'all' ? indexSubject : null}
          />
          <Topbar onSearch={goSearch} />
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
                inputRef={searchInputRef}
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
        />
      )}
    </div>
  );
}
