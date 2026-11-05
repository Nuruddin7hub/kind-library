// K/IND mobile search (ChatGPT Round B, 2026-11-03; P0 rework 2026-11-03;
// P1 rework 2026-11-03: compact divider result rows).
// Sticky search bar (NEVER auto-focused), two-level filters — primary
// subject chips always visible; secondary (scope + sort) in a bottom sheet
// with Apply + Reset — and compact divider result rows (13px padding,
// 46px 3:4 covers via DocCover, whole-row opens the doc, honest match-kind
// labels, NO fabricated relevance percentages), and scope/sort persistence
// (kl:msearch:* — query persists in the parent).
// Desktop untouched. All classes ms- prefixed.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { SearchHit } from '../shared';
import { SUBJECTS, sectionLabel, subjectOf, matchKindsOf, matchScore, hitOpenPage, pageImageUrl } from '../shared';
import DocCover from './DocCover';
import BottomSheet from './BottomSheet';
import SpecularButton from '../bits/SpecularButton';
import GlareHover from '../bits/GlareHover';
import AnimatedContent from '../bits/AnimatedContent';
import './DocCover.css';
import './MobileSearch.css';

export interface RecentDoc {
  key: string;
  title: string;
  subj: string;
}

export interface MobileSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchHit[];             // already debounced full-text from parent
  searching: boolean;
  searchError?: boolean;            // /api/search failed — show retry state
  onRetry?: () => void;             // re-run the search, preserving query+filters
  totalMatches: number;
  searchSubject: string;            // subject pill filter
  onSubjectChange: (s: string) => void;
  currentSubject: string;           // for scope "Current subject"
  subjectCounts: Record<string, number>;
  recentKeys: string[];             // kl:recent order, for "recent" sort
  recentDocs?: RecentDoc[];         // recently opened docs (empty-query state)
  bookmarks: string[];
  onToggleBookmark: (key: string) => void;
  onOpenHit: (hit: SearchHit, page?: number) => void;  // parent sets reader start page then opens
  onOpenRecent?: (key: string) => void; // open a recently-opened doc from the empty state
  onBack: () => void;
  onClearAll: () => void;
}

type Scope = 'all' | 'subject' | 'titles' | 'text';

const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: 'all', label: 'All documents' },
  { id: 'subject', label: 'Current subject' },
  { id: 'titles', label: 'Titles only' },
  { id: 'text', label: 'Full text' },
];

type SortId = 'relevance' | 'title' | 'recent';

const SORTS: Array<{ id: SortId; label: string }> = [
  { id: 'relevance', label: 'RELEVANCE' },
  { id: 'title', label: 'TITLE' },
  { id: 'recent', label: 'RECENT' },
];

const SCOPE_KEY = 'kl:msearch:scope';
const SORT_KEY = 'kl:msearch:sort';

function readStored<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return valid.includes(v as T) ? (v as T) : fallback;
  } catch { return fallback; }
}

interface CardProps {
  hit: SearchHit;
  index: number;                  // position in the results — cover number
  query: string;
  bookmarked: boolean;
  onToggleBookmark: (key: string) => void;
  onOpenHit: (hit: SearchHit, page?: number) => void;
}

/** Highlight query words inside a snippet using safe text nodes + <mark>
 *  spans — never raw HTML. */
function highlightText(text: string, query: string, cls = 'ms-hl'): ReactNode[] {
  const words = query.trim().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return [text];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${words.map(esc).join('|')})`, 'gi');
  const out: ReactNode[] = [];
  text.split(re).forEach((part, i) => {
    out.push(i % 2 === 1
      ? <mark key={i} className={cls}>{part}</mark>
      : part);
  });
  return out;
}

/** Query fragment in result titles: muted teal background, original
 *  typography (no font/weight change on the mark itself). */
function highlightTitle(title: string, query: string): ReactNode[] {
  return highlightText(title, query, 'ms-hl-t');
}

/** Honest match-kind label — never a fabricated relevance percentage.
 *  Round C re-score: TITLE MATCH / CONTENT MATCH / SUBJECT MATCH. */
function matchLabel(hit: SearchHit): 'TITLE MATCH' | 'CONTENT MATCH' | 'SUBJECT MATCH' {
  const kinds = matchKindsOf(hit);
  if (kinds.includes('title')) return 'TITLE MATCH';
  if (kinds.includes('text')) return 'CONTENT MATCH';
  return 'SUBJECT MATCH';
}

function SearchCard({ hit, index, query, bookmarked, onToggleBookmark, onOpenHit }: CardProps) {
  const kinds = matchKindsOf(hit);
  const isText = kinds.includes('text');
  const subj = subjectOf(hit.subj);
  const color = subj ? subj.color : '#9AA7BE';
  const code = subj ? subj.code : hit.subj.toUpperCase();
  const openPage = hitOpenPage(hit);
  const thumb = hit.file ? pageImageUrl(hit.subj, hit.file, openPage, hit.pages) : null;
  // REAL excerpt from the PDF text index — first passage snippet, else the
  // backend excerpt. Never invented from the title; empty when the hit is
  // title-only (the line then simply doesn't render).
  const excerpt = (hit.passages?.[0]?.snippet || hit.excerpt || '').trim();
  const matchCount = typeof hit.match_count === 'number' ? hit.match_count : 0;
  // Round B P1: the REAL best-match page from the backend (hit.page is the
  // highest-hit page, 0 when there is no content match — never fabricated).
  // Shown only for content matches; title-only matches show no page.
  const matchPage = isText && typeof hit.page === 'number' && hit.page > 0 ? hit.page : 0;
  const matchInfo = matchPage > 0
    ? `Content match on page ${matchPage}${matchCount > 0 ? `, ${matchCount} match${matchCount === 1 ? '' : 'es'}` : ''}`
    : matchLabel(hit).toLowerCase();

  // Whole-row opens the doc at the best page (P1-4): the card is a div with
  // role=button, so the inner bookmark button stays valid HTML.
  const open = () => onOpenHit(hit);
  const onCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // let the bookmark button handle its own keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      className="ms-card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onCardKeyDown}
      aria-label={`Open ${hit.title} — ${matchInfo}`}
    >
      <GlareHover
        mode="click"
        glareOpacity={0.28}
        glareSize={26}
        transitionDuration={500}
        className="ms-thumb-glare"
        style={{
          ['--gh-width' as any]: '40px',
          ['--gh-height' as any]: '53px',
          ['--gh-br' as any]: '6px',
          flex: '0 0 40px',
          alignSelf: 'center',
        }}
      >
        <DocCover
          src={thumb}
          subj={hit.subj}
          docIndex={index + 1}
          docType={sectionLabel(hit.section)}
          title={hit.title}
          seed={hit.key}
          className="ms-thumb"
        />
      </GlareHover>

      {/* Round C re-score: grid 40px 1fr 40px — cover / title+micro+match+excerpt / bookmark */}
      <div className="ms-card-main">
        {/* query fragment highlighted in the title (muted teal, original type) */}
        <h3 className="ms-title">{highlightTitle(hit.title, query)}</h3>
        {/* consistent metadata order: type · subject · pages */}
        <p className="ms-micro" style={{ color }}>
          {sectionLabel(hit.section).toUpperCase()} · {code} · {hit.pages} PAGES
        </p>
        <p className="ms-kindline">
          <span className="ms-kindtag" style={{ color }}>{matchLabel(hit)}</span>
          {/* Round B P1: real matching page (backend hit.page) for content
              matches — e.g. CONTENT MATCH · PAGE 08. Title-only matches
              show no page. */}
          {matchPage > 0 && (
            <span className="ms-kindline-count"> · PAGE {String(matchPage).padStart(2, '0')}</span>
          )}
          {isText && matchCount > 0 && (
            <span className="ms-kindline-count"> · {matchCount} MATCH{matchCount === 1 ? '' : 'ES'}</span>
          )}
        </p>
        {/* one-line REAL excerpt from the text index (12px, 2-line clamp);
            matched word highlighted; never rendered when there is none.
            The sr-only prefix makes the highlighted match discoverable to
            screen readers (a bare <mark> is not announced as a match). */}
        {excerpt !== '' && (
          <p className="ms-excerpt1">
            <span className="ms-sr-only">Matching excerpt: </span>
            {highlightText(excerpt, query)}
          </p>
        )}
      </div>

      <button
        type="button"
        className={`ms-bookmark${bookmarked ? ' on' : ''}`}
        aria-label={bookmarked ? `Remove bookmark for ${hit.title}` : `Bookmark ${hit.title}`}
        aria-pressed={bookmarked}
        onClick={(e) => { e.stopPropagation(); onToggleBookmark(hit.key); }}
      >
        {bookmarked ? '★' : '☆'}
      </button>
    </div>
  );
}

export default function MobileSearch(props: MobileSearchProps) {
  const {
    query, onQueryChange, results, searching,
    searchSubject, onSubjectChange, currentSubject, subjectCounts,
    recentKeys, bookmarks, onToggleBookmark, onOpenHit, onBack, onClearAll,
  } = props;

  // search state persistence — query persists in the parent (App), so a
  // document open/close never loses it; scope + sort persist here.
  const [scope, setScope] = useState<Scope>(() =>
    readStored(SCOPE_KEY, SCOPES.map(s => s.id), 'all'));
  const [sort, setSort] = useState<SortId>(() =>
    readStored(SORT_KEY, SORTS.map(s => s.id), 'relevance'));
  useEffect(() => { try { localStorage.setItem(SCOPE_KEY, scope); } catch { /* ignore */ } }, [scope]);
  useEffect(() => { try { localStorage.setItem(SORT_KEY, sort); } catch { /* ignore */ } }, [sort]);

  // reduced-motion: static fallbacks for the specular Apply button
  const [reducedMotion] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // query+filters+sort+scroll preserved on return (Round C re-score):
  // query persists in the parent (App), scope/sort in kl:msearch:*; the
  // scroll offset of the shared #kl-mobile-scroll container is saved when
  // a hit is opened and restored when this view mounts again.
  const SCROLL_KEY = 'kl:msearch:scroll';
  const scrollerOf = () =>
    typeof document !== 'undefined' ? document.getElementById('kl-mobile-scroll') : null;
  useEffect(() => {
    const el = scrollerOf();
    if (!el) return;
    try {
      const v = parseInt(sessionStorage.getItem(SCROLL_KEY) || '0', 10);
      if (Number.isFinite(v) && v > 0) el.scrollTop = v;
    } catch { /* ignore */ }
  }, []);
  const openHitAndSave = (hit: SearchHit, page?: number) => {
    const el = scrollerOf();
    if (el) {
      try { sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop)); } catch { /* ignore */ }
    }
    onOpenHit(hit, page);
  };

  // secondary-filter sheet state — committed on Apply
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tempScope, setTempScope] = useState<Scope>('all');
  const [tempSort, setTempSort] = useState<SortId>('relevance');
  const openSheet = () => { setTempScope(scope); setTempSort(sort); setSheetOpen(true); };
  const applySheet = () => { setScope(tempScope); setSort(tempSort); setSheetOpen(false); };
  const resetSheet = () => { setTempScope('all'); setTempSort('relevance'); };
  const secondaryActive = (scope !== 'all' ? 1 : 0) + (sort !== 'relevance' ? 1 : 0);

  // selected subject chip stays visible in the rail
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector('.ms-pill.active') as HTMLElement | null;
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [searchSubject]);

  // Client-side scope filter over the parent-debounced results.
  const filtered = useMemo(() => results.filter(hit => {
    const kinds = matchKindsOf(hit);
    if (scope === 'subject') {
      if (currentSubject !== 'all' && hit.subj !== currentSubject) return false;
    }
    if (scope === 'titles' && !kinds.includes('title')) return false;
    if (scope === 'text' && !kinds.includes('text')) return false;
    return true;
  }), [results, scope, currentSubject]);

  // Sort: relevance (shared matchScore), title A–Z, or kl:recent order.
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === 'title') {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'recent') {
      const order = new Map(recentKeys.map((k, i) => [k, i]));
      arr.sort((a, b) => (order.get(a.key) ?? 1e9) - (order.get(b.key) ?? 1e9));
    } else {
      arr.sort((a, b) => matchScore(b, query) - matchScore(a, query));
    }
    return arr;
  }, [filtered, sort, query, recentKeys]);

  const docCount = useMemo(() => new Set(filtered.map(h => h.key)).size, [filtered]);

  const currentSubj = subjectOf(currentSubject);
  const queryWords = query.trim().split(/\s+/).filter(Boolean);

  const sortLabel =
    sort === 'title' ? 'TITLE'
    : sort === 'recent' ? 'RECENT'
    : 'BEST MATCH';

  // recent searches — real kl:* data only (debounced record of queries the
  // user actually ran; never invented suggestions)
  const SEARCHES_KEY = 'kl:searches';
  const [searches, setSearches] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SEARCHES_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((s: unknown) => typeof s === 'string').slice(0, 8) : [];
    } catch { return []; }
  });
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = window.setTimeout(() => {
      try {
        const raw = JSON.parse(localStorage.getItem(SEARCHES_KEY) || '[]');
        const prev = Array.isArray(raw) ? raw.filter((s: unknown) => typeof s === 'string' && s !== q) : [];
        const next = [q, ...prev].slice(0, 8);
        localStorage.setItem(SEARCHES_KEY, JSON.stringify(next));
        setSearches(next);
      } catch { /* ignore — quota */ }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [query]);

  // popular subjects — real counts, top 2
  const popularSubjects = useMemo(() =>
    SUBJECTS
      .map(s => ({ s, n: subjectCounts[s.id] ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 2),
  [subjectCounts]);

  // empty-query state: real recently-opened docs
  const recentDocs = (props.recentDocs ?? []).slice(0, 4);

  return (
    <div className="ms-root mobile-page">
      {/* sticky search bar — never auto-focused */}
      <div className="ms-searchbar">
        <button type="button" className="ms-back" onClick={onBack} aria-label="Back to library">
          ‹
        </button>
        <div className="ms-search-field">
          <span className="ms-search-icon" aria-hidden="true">⌕</span>
          <input
            className="ms-search-input"
            type="search"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search all 100 documents…"
            aria-label="Search documents"
            enterKeyHint="search"
          />
          {query !== '' && (
            <button
              type="button"
              className="ms-search-clear"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="ms-section">
        {/* primary chips — always visible: All / EM2 / Signals / FIS / Digital.
            Rail has right-edge fade; the selected chip scrolls into view. */}
        <div className="ms-rail" ref={railRef} role="tablist" aria-label="Filter search by subject">
          <button
            key="all"
            type="button"
            role="tab"
            aria-selected={searchSubject === 'all'}
            className={`ms-pill${searchSubject === 'all' ? ' active' : ''}`}
            onClick={() => onSubjectChange('all')}
          >
            All documents
          </button>
          {SUBJECTS.map(s => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={searchSubject === s.id}
              className={`ms-pill${searchSubject === s.id ? ' active' : ''}`}
              style={searchSubject === s.id ? { borderColor: s.color, color: s.color } : undefined}
              onClick={() => onSubjectChange(s.id)}
            >
              {s.code} · {subjectCounts[s.id] ?? 0}
            </button>
          ))}
        </div>
      </div>

      <div className="ms-section">
        {/* count + FILTERS on one compact row — "N RESULTS" + honest sort label */}
        {/* compact result header (1420 loop):
            "03 RESULTS — SORT: BEST MATCH — FILTER" */}
        <div className="ms-results-bar">
          <p className="ms-results-head" aria-live="polite">
            {searching ? 'SEARCHING…' : (
              <>
                {String(docCount).padStart(2, '0')} RESULTS
                <span className="ms-results-sep" aria-hidden="true"> — </span>
                SORT: {sortLabel}
                <span className="ms-results-sep" aria-hidden="true"> — </span>
              </>
            )}
          </p>
          {/* secondary filters live in the bottom sheet (Apply + Reset) */}
          <button
            type="button"
            className={`ms-filters-btn${secondaryActive > 0 ? ' has-badge' : ''}`}
            onClick={openSheet}
            aria-label={`Search filters, ${secondaryActive} active`}
          >
            FILTER
            {secondaryActive > 0 && <span className="ms-badge">{secondaryActive}</span>}
          </button>
        </div>

        {props.searchError && !searching ? (
          <div className="ms-empty">
            <p className="ms-empty-title">Search didn&rsquo;t reach the index.</p>
            <p className="ms-empty-hint">Your query and filters are kept — try again.</p>
            {props.onRetry && (
              <button type="button" className="ms-retry-btn" onClick={props.onRetry}>
                RETRY SEARCH
              </button>
            )}
          </div>
        ) : query.trim() === '' && !searching ? (
          <div className="ms-empty">
            {/* recent-search area (1420 loop): real kl:* data only —
                recent searches / popular subjects / recently opened */}
            {searches.length > 0 && (
              <div className="ms-empty-group">
                <p className="ms-empty-label">RECENT SEARCHES</p>
                <div className="ms-chips">
                  {searches.map(s => (
                    <button
                      type="button"
                      key={s}
                      className="ms-chip"
                      onClick={() => onQueryChange(s)}
                      aria-label={`Search again for ${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ms-empty-group">
              <p className="ms-empty-label">POPULAR SUBJECTS</p>
              <div className="ms-chips">
                {popularSubjects.map(({ s, n }) => (
                  <button
                    type="button"
                    key={s.id}
                    className="ms-chip"
                    onClick={() => onSubjectChange(s.id)}
                    aria-label={`Filter search to ${s.name}`}
                  >
                    {s.code} · {n}
                  </button>
                ))}
              </div>
            </div>
            {recentDocs.length > 0 && (
              <div className="ms-empty-group">
                <p className="ms-empty-label">RECENTLY OPENED</p>
                <div className="ms-recent-list">
                  {recentDocs.map(d => (
                    <button
                      type="button"
                      key={d.key}
                      className="ms-recent-row"
                      onClick={() => props.onOpenRecent?.(d.key)}
                      aria-label={`Open ${d.title}`}
                    >
                      <span className="ms-recent-code" style={{ color: subjectOf(d.subj)?.color }}>
                        {subjectOf(d.subj)?.code ?? d.subj.toUpperCase()}
                      </span>
                      <span className="ms-recent-title">{d.title}</span>
                      <span className="ms-recent-go" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !searching && filtered.length === 0 ? (
          /* rich empty state (Round C re-score): NO MATCHES FOUND +
             all-subjects suggestion + recent searches + popular subjects —
             all from real stored data, never invented */
          <div className="ms-empty">
            <p className="ms-empty-title">NO MATCHES FOUND</p>
            <p className="ms-empty-hint">Nothing in the archive matches “{query.trim()}”.</p>
            <div className="ms-chips">
              {queryWords.length > 1 && (
                <button
                  type="button"
                  className="ms-chip"
                  onClick={() => onQueryChange(queryWords[0])}
                >
                  Try fewer words
                </button>
              )}
              {scope !== 'titles' && (
                <button
                  type="button"
                  className="ms-chip"
                  onClick={() => setScope('titles')}
                >
                  Try titles only
                </button>
              )}
              {searchSubject !== 'all' && (
                <button
                  type="button"
                  className="ms-chip"
                  onClick={() => onSubjectChange('all')}
                  aria-label="Search all subjects instead"
                >
                  Try all subjects
                </button>
              )}
            </div>
            {searches.length > 0 && (
              <div className="ms-empty-group">
                <p className="ms-empty-label">RECENT SEARCHES</p>
                <div className="ms-chips">
                  {searches.map(s => (
                    <button
                      type="button"
                      key={s}
                      className="ms-chip"
                      onClick={() => onQueryChange(s)}
                      aria-label={`Search again for ${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ms-empty-group">
              <p className="ms-empty-label">POPULAR SUBJECTS</p>
              <div className="ms-chips">
                {popularSubjects.map(({ s, n }) => (
                  <button
                    type="button"
                    key={s.id}
                    className="ms-chip"
                    onClick={() => onSubjectChange(s.id)}
                    aria-label={`Filter search to ${s.name}`}
                  >
                    {s.code} · {n}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="ms-clear-btn" onClick={onClearAll}>
              Clear search
            </button>
          </div>
        ) : searching ? (
          <div className="ms-results-list">
            {/* loading state: 3 skeleton rows (animation disabled under
                prefers-reduced-motion via CSS) */}
            {[0, 1, 2].map(i => (
              <div className="ms-skel" key={i} aria-hidden="true" />
            ))}
          </div>
        ) : reducedMotion ? (
          <div className="ms-results-list">
            {sorted.map((hit, i) => (
              <SearchCard
                key={hit.key}
                hit={hit}
                index={i}
                query={query}
                bookmarked={bookmarks.includes(hit.key)}
                onToggleBookmark={onToggleBookmark}
                onOpenHit={openHitAndSave}
              />
            ))}
          </div>
        ) : (
          // short stagger when a new query resolves — keyed by the resolved
          // query so returning from a document (same query) never replays it
          <AnimatedContent
            key={`msq-${query}-${scope}-${sort}-${searchSubject}`}
            trigger="mount"
            distance={12}
            duration={0.3}
            ease="power3.out"
            stagger={0.04}
            once
            className="ms-results-list"
          >
            {sorted.map((hit, i) => (
              <SearchCard
                key={hit.key}
                hit={hit}
                index={i}
                query={query}
                bookmarked={bookmarks.includes(hit.key)}
                onToggleBookmark={onToggleBookmark}
                onOpenHit={openHitAndSave}
              />
            ))}
          </AnimatedContent>
        )}
      </div>

      {/* ---------- secondary filters sheet: scope + sort, Apply + Reset ---------- */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Search filters"
        height="60vh"
        footer={
          <div className="ms-sheet-footer">
            <button type="button" className="ms-btn-ghost" onClick={resetSheet}>
              Reset
            </button>
            {reducedMotion ? (
              <button type="button" className="ms-btn-primary" onClick={applySheet}>
                Apply
              </button>
            ) : (
              <SpecularButton
                type="button"
                size="sm"
                className="ms-btn-primary"
                onClick={applySheet}
                tint="#38D5C1"
                tintOpacity={0.5}
                textColor="#062A26"
                radius={12}
                intensity={0.85}
                idleIntensity={0.3}
                autoAnimate
                followMouse={false}
              >
                Apply
              </SpecularButton>
            )}
          </div>
        }
      >
        <div className="ms-sheet-group">
          <div className="ms-sheet-label">Search scope</div>
          <div className="ms-opt-row">
            {SCOPES.map(s => (
              <button
                key={s.id}
                type="button"
                className={`ms-opt${tempScope === s.id ? ' active' : ''}`}
                aria-pressed={tempScope === s.id}
                onClick={() => setTempScope(s.id)}
              >
                {s.id === 'subject' && currentSubj ? currentSubj.code : s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ms-sheet-group">
          <div className="ms-sheet-label">Sort by</div>
          <div className="ms-opt-row">
            {SORTS.map(s => (
              <button
                key={s.id}
                type="button"
                className={`ms-opt${tempSort === s.id ? ' active' : ''}`}
                aria-pressed={tempSort === s.id}
                onClick={() => setTempSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
