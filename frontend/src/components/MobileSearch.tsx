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
import './DocCover.css';
import './MobileSearch.css';

export interface MobileSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchHit[];             // already debounced full-text from parent
  searching: boolean;
  totalMatches: number;
  searchSubject: string;            // subject pill filter
  onSubjectChange: (s: string) => void;
  currentSubject: string;           // for scope "Current subject"
  subjectCounts: Record<string, number>;
  recentKeys: string[];             // kl:recent order, for "recent" sort
  bookmarks: string[];
  onToggleBookmark: (key: string) => void;
  onOpenHit: (hit: SearchHit, page?: number) => void;  // parent sets reader start page then opens
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
  query: string;
  bookmarked: boolean;
  onToggleBookmark: (key: string) => void;
  onOpenHit: (hit: SearchHit, page?: number) => void;
}

/** Highlight query words inside a snippet using safe text nodes + <mark>
 *  spans — never raw HTML. */
function highlightText(text: string, query: string): ReactNode[] {
  const words = query.trim().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return [text];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${words.map(esc).join('|')})`, 'gi');
  const out: ReactNode[] = [];
  text.split(re).forEach((part, i) => {
    out.push(i % 2 === 1
      ? <mark key={i} className="ms-hl">{part}</mark>
      : part);
  });
  return out;
}

/** Honest match-kind label — never a fabricated relevance percentage. */
function matchLabel(hit: SearchHit, query: string): string {
  const kinds = matchKindsOf(hit);
  if (kinds.includes('title')) {
    return hit.title.trim().toLowerCase() === query.trim().toLowerCase()
      ? 'Exact phrase'
      : 'Title match';
  }
  if (kinds.includes('text')) return 'Text match';
  return 'Subject match';
}

function SearchCard({ hit, query, bookmarked, onToggleBookmark, onOpenHit }: CardProps) {
  const kinds = matchKindsOf(hit);
  const isText = kinds.includes('text');
  const subj = subjectOf(hit.subj);
  const color = subj ? subj.color : '#9AA7BE';
  const code = subj ? subj.code : hit.subj.toUpperCase();
  const openPage = hitOpenPage(hit);
  const thumb = hit.file ? pageImageUrl(hit.subj, hit.file, openPage, hit.pages) : null;
  const passages = useMemo(() => (hit.passages ?? []).slice(0, 2), [hit.passages]);
  const matchCount = typeof hit.match_count === 'number'
    ? hit.match_count
    : passages.reduce((s, p) => s + (p.match_count || 0), 0);
  const pageCount = Math.max(1, new Set((hit.passages ?? []).map(p => p.page_number)).size);

  // Whole-card clickable divider row (P1-4): no nested <button> inside <button>.
  const open = () => onOpenHit(hit);
  const onCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // let inner buttons handle their own keys
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
      aria-label={`Open ${hit.title}`}
    >
      <DocCover
        src={thumb}
        subj={hit.subj}
        docIndex={openPage}
        docType={sectionLabel(hit.section)}
        className="ms-thumb"
      />

      <div className="ms-card-main">
        <p className="ms-micro" style={{ color }}>{code} · {sectionLabel(hit.section).toUpperCase()}</p>
        <h3 className="ms-title">{hit.title}</h3>
        <p className="ms-kindline" style={{ color }}>{matchLabel(hit, query)}</p>
        {isText ? (
          <>
            <p className="ms-matchline">
              {matchCount} MATCH{matchCount === 1 ? '' : 'ES'} · {pageCount} PAGE{pageCount === 1 ? '' : 'S'}
            </p>
            <div className="ms-excerpts">
              {passages.map((p, i) => (
                <div className="ms-excerpt" key={`${p.page_number}-${i}`}>
                  <p className="ms-excerpt-text">{highlightText(p.snippet, query)}</p>
                  <button
                    type="button"
                    className="ms-page-go"
                    onClick={(e) => { e.stopPropagation(); onOpenHit(hit, p.page_number); }}
                    aria-label={`Open ${hit.title} at page ${p.page_number}`}
                  >
                    PAGE {pad2(p.page_number)} →
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="ms-meta">
            {sectionLabel(hit.section)} · {hit.pages} PAGES · PDF
          </p>
        )}
        {/* span (not a button) so the whole card stays one tab stop */}
        <span className="ms-open-link" aria-hidden="true">OPEN →</span>
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

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function MobileSearch(props: MobileSearchProps) {
  const {
    query, onQueryChange, results, searching, totalMatches,
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
  const matchCount = scope === 'all'
    ? totalMatches
    : filtered.reduce((sum, h) => sum + (h.match_count ?? 1), 0);

  const currentSubj = subjectOf(currentSubject);
  const queryWords = query.trim().split(/\s+/).filter(Boolean);

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
        <div className="ms-results-bar">
          <p className="ms-results-head" aria-live="polite">
            {searching ? 'SEARCHING…' : `${docCount} DOCUMENTS · ${matchCount} MATCHES`}
          </p>
          {/* secondary filters live in the bottom sheet (Apply + Reset) */}
          <button
            type="button"
            className={`ms-filters-btn${secondaryActive > 0 ? ' has-badge' : ''}`}
            onClick={openSheet}
            aria-label={`Search filters, ${secondaryActive} active`}
          >
            FILTERS
            {secondaryActive > 0 && <span className="ms-badge">{secondaryActive}</span>}
          </button>
        </div>

        {query.trim() === '' && !searching ? (
          <div className="ms-empty">
            <p className="ms-empty-hint">Try ‘laplace’, ‘epistemology’, ‘boolean’…</p>
          </div>
        ) : !searching && filtered.length === 0 ? (
          <div className="ms-empty">
            <p className="ms-empty-title">No matches for “{query.trim()}”.</p>
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
              {searchSubject !== 'all' && (
                <button
                  type="button"
                  className="ms-chip"
                  onClick={() => onSubjectChange('all')}
                  aria-label={`Clear ${subjectOf(searchSubject)?.name ?? searchSubject} subject filter`}
                >
                  {subjectOf(searchSubject)?.code ?? searchSubject} ×
                </button>
              )}
            </div>
            <button type="button" className="ms-clear-btn" onClick={onClearAll}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="ms-results-list">
            {sorted.map(hit => (
              <SearchCard
                key={hit.key}
                hit={hit}
                query={query}
                bookmarked={bookmarks.includes(hit.key)}
                onToggleBookmark={onToggleBookmark}
                onOpenHit={onOpenHit}
              />
            ))}
          </div>
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
            <button type="button" className="ms-btn-primary" onClick={applySheet}>
              Apply
            </button>
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
