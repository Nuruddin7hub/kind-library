import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import SplitText from '../components/SplitText';
import AnimatedContent from '../bits/AnimatedContent';
import SpotlightCard from '../bits/SpotlightCard';
import {
  SUBJECTS,
  subjectOf,
  pageImageUrl,
  sectionLabel,
  matchKindLabel,
  matchKindsOf,
  v2SubjectColor,
} from '../shared';
import type { SearchHit } from '../shared';
import './SearchPage.css';

export type SearchSortMode = 'relevance' | 'recent';

export interface SearchPageProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchHit[];
  searching: boolean;
  totalMatches: number;
  counts: Record<string, number>;
  total: number;
  searchSubject: string;
  onSubjectChange: (s: string) => void;
  typeFilter: string;
  onTypeFilterChange: (s: string) => void;
  resultSections: string[];
  sortMode: SearchSortMode;
  onSortModeChange: (m: SearchSortMode) => void;
  selected: number;
  onSelect: (i: number) => void;
  onOpen: (hit: SearchHit) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  searchError: boolean;
  onRetry: () => void;
}

const RECENT_KEY = 'kl:recentSearches';
const RECENT_MAX = 8;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Best page number for a hit: first text-match passage page, else hit.page. */
function hitPage(hit: SearchHit): number | null {
  const p = hit.passages?.[0]?.page_number ?? hit.page ?? null;
  return typeof p === 'number' && p > 0 ? p : null;
}

/** Wrap case-insensitive occurrences of q in <mark>. Safe for empty/special chars. */
export function highlightQuery(text: string, q: string): ReactNode {
  const query = q.trim();
  if (!query || !text) return text;
  const lower = text.toLowerCase();
  const ql = query.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let k = 0;
  for (;;) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={k++} className="kiA-mark">
        {text.slice(idx, idx + ql.length)}
      </mark>,
    );
    i = idx + ql.length;
  }
  return <>{parts}</>;
}

/** Honest match-type plate class: never a fabricated percentage. */
function matchPlateClass(hit: SearchHit, query: string): string {
  const kinds = matchKindsOf(hit);
  if (kinds.includes('title')) {
    const exact = hit.title.toLowerCase() === query.trim().toLowerCase();
    return exact ? 'kiA-match kiA-match--exact' : 'kiA-match kiA-match--title';
  }
  if (kinds.includes('text')) return 'kiA-match kiA-match--text';
  return 'kiA-match kiA-match--subject';
}

export default function SearchPage(props: SearchPageProps) {
  const {
    query, onQueryChange, results, searching, totalMatches,
    counts, total, searchSubject, onSubjectChange,
    typeFilter, onTypeFilterChange, resultSections,
    sortMode, onSortModeChange,
    selected, onSelect, onOpen, inputRef,
    searchError, onRetry,
  } = props;

  const [recent, setRecent] = useState<string[]>(readRecent);
  // One-shot scan line: increments (debounced) each time the query
  // settles — the line element re-mounts on the new key and sweeps
  // once across the input. Never continuous.
  const [scanTick, setScanTick] = useState(0);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(() => setScanTick(n => n + 1), 350);
    return () => clearTimeout(t);
  }, [query]);
  // Keyboard-focus only: the selected-row outline appears ONLY after the
  // user actually navigates with the arrow keys — never a permanent outline
  // on the first result. Mouse hover clears it.
  const [kbdSel, setKbdSel] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setKbdSel(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (query === '' && !searching) setRecent(readRecent());
  }, [query, searching]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const term = e.currentTarget.value.trim();
    if (!term) return;
    setRecent(prev => {
      const next = [term, ...prev.filter(t => t.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — chips just won't persist */
      }
      return next;
    });
  };

  const qEmpty = query.trim() === '';
  const showTypeFilter = resultSections.length > 1;
  // Suggested terms — verified live against /api/search (each returns
  // real results): Laplace 3, Fourier 1, Metaphysics 2, Logic 15.
  const SUGGESTED_TERMS = ['Laplace', 'Fourier', 'Metaphysics', 'Logic'];

  /** One full-width result row (P4 spec): 76px thumbnail |
   *  title + meta + real excerpt | right-aligned action. Wrapped in
   *  a restrained SpotlightCard (critiqueA 2026-11-07 P1: spotlight
   *  rgba(78,242,232,0.07), no tilt, NOT Magic Bento) — the card
   *  carries the frame, the row keeps the border + geometry. */
  const renderHit = (hit: SearchHit, i: number) => {
    const subj = subjectOf(hit.subj);
    const color = v2SubjectColor(hit.subj);
    const file = hit.file || hit.key.split('::')[2] || '';
    const thumb = pageImageUrl(hit.subj, file, 1, hit.pages);
    const isSel = i === selected && kbdSel;
    // REAL matching info only: the backend returns excerpt/passages
    // (real PDF-text snippets with page numbers) for full-text matches.
    // Title-only matches return excerpt '' / passages [] — show no
    // snippet rather than fabricating one.
    const preview = hit.excerpt || hit.passages?.[0]?.snippet || '';
    const pg = hitPage(hit);
    const matchCount = typeof hit.match_count === 'number' ? hit.match_count : null;
    // P4 result row: thumbnail | subject/result + match type, title,
    // subject name · type · pages · match page, real excerpt |
    // right-aligned number + OPEN DOCUMENT + match count.
    return (
      <SpotlightCard
        key={hit.key}
        className="kiA-hit-spot"
        spotlightColor="rgba(78,242,232,0.07)"
        intensity={0.12}
        spotlightSize={260}
        softness={0.8}
        borderGlow={0}
        proximity={120}
        flare={false}
        grain={0}
        theme="dark"
      >
      <div
        className={'kiA-hit' + (isSel ? ' kiA-hit--selected' : '')}
        style={{ '--hit-subject': color } as CSSProperties}
        role="button"
        tabIndex={0}
        onClick={() => { onSelect(i); onOpen(hit); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); onOpen(hit); } }}
        onMouseEnter={() => { setKbdSel(false); if (i !== selected) onSelect(i); }}
        aria-label={`${hit.title} — ${matchKindLabel(hit, query)}`}
      >
        <span className="kiA-hit-thumb" aria-hidden="true">
          {thumb && file ? (
            <img
              src={thumb}
              alt=""
              loading="lazy"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
        </span>
        <span className="kiA-hit-main">
          <span className="kiA-hit-top">
            <span className="kiA-hit-plate">{subj?.code ?? hit.subj.toUpperCase()} / RESULT {String(i + 1).padStart(3, '0')}</span>
            <span className={matchPlateClass(hit, query)}>
              {matchKindLabel(hit, query)}
            </span>
          </span>
          {/* Round C P0: structure is metadata / title / excerpt /
              footer — the meta line moves above the title so the
              result reads as search evidence, not a title card. */}
          <span className="kiA-hit-meta">
            <span className="kiA-dot" style={{ backgroundColor: color }} aria-hidden="true" />
            {subj?.name ?? hit.subj}
            {' · '}
            {sectionLabel(hit.section)}
            {' · '}
            {hit.pages} page{hit.pages === 1 ? '' : 's'}
            {pg !== null && (
              <span className="kiA-hit-page"> · match on p. {pg}</span>
            )}
          </span>
          <span className="kiA-hit-title">{highlightQuery(hit.title, query)}</span>
          {preview && (
            <span className="kiA-hit-preview">{highlightQuery(preview, query)}</span>
          )}
        </span>
        <span className="kiA-hit-side">
          <span className="kiA-hit-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          <span className="kiA-hit-open">OPEN DOCUMENT →</span>
          {matchCount !== null && (
            <span className="kiA-hit-matches">
              {matchCount} match{matchCount === 1 ? '' : 'es'}
            </span>
          )}
        </span>
      </div>
      </SpotlightCard>
    );
  };

  return (
    <div className="kiA-page kiA-page--search">
      <header className="kiA-head">
        <p className="kiA-eyebrow">DISCOVERY / INDEX 001</p>
        <h1 className="kiA-display kiA-engine-title">
          <SplitText
            lines={[
              { text: 'Find the' },
              { text: 'connection.', italic: true },
            ]}
          />
        </h1>
        <p className="kiA-search-sub">Search across {total} documents, 4 disciplines.</p>
      </header>

      <div className="kiA-searchwrap">
        {/* One-shot scan line (critiqueA 2026-11-07 P1): re-mounts on
            each settled query change and sweeps once. */}
        {scanTick > 0 && !qEmpty && (
          <span key={scanTick} className="kiA-scanline" aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          className="kiA-input"
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Search ${total} documents — titles, text, equations…`}
          spellCheck={false}
          autoComplete="off"
          aria-label="Search the archive"
        />
        {!qEmpty && (
          <button
            type="button"
            className="kiA-clear"
            onClick={() => { onQueryChange(''); inputRef.current?.focus(); }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
        <button
          type="button"
          className="kiA-cmdk-hint"
          onClick={() => inputRef.current?.focus()}
          aria-label="Focus search (Command K)"
        >
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div className="kiA-filterbar" role="toolbar" aria-label="Search filters">
        <div className="kiA-chips" role="tablist" aria-label="Filter by subject">
          <button
            type="button"
            role="tab"
            aria-selected={searchSubject === 'all'}
            className={'kiA-chip' + (searchSubject === 'all' ? ' kiA-chip--active' : '')}
            onClick={() => onSubjectChange('all')}
          >
            All
            <span className="kiA-chip-count">{total}</span>
          </button>
          {SUBJECTS.map(s => {
            const active = searchSubject === s.id;
            const color = v2SubjectColor(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={'kiA-chip' + (active ? ' kiA-chip--active' : '')}
                style={active ? { ['--chip-subj' as string]: color } as CSSProperties : undefined}
                onClick={() => onSubjectChange(s.id)}
              >
                <span className="kiA-chip-dot" style={{ backgroundColor: color }} />
                {s.code}
                <span className="kiA-chip-count">{counts[s.id] ?? 0}</span>
              </button>
            );
          })}
          {searchSubject !== 'all' && (
            <button
              type="button"
              className="kiA-chip kiA-chip--clear"
              onClick={() => onSubjectChange('all')}
              aria-label="Clear subject filter"
            >
              Clear ✕
            </button>
          )}
        </div>

        <div className="kiA-filterbar-row">
          {showTypeFilter && (
            <div className="kiA-type-chips" aria-label="Filter by document type">
              <button
                type="button"
                className={'kiA-chip kiA-chip--sm' + (typeFilter === 'all' ? ' kiA-chip--active' : '')}
                onClick={() => onTypeFilterChange('all')}
              >
                All types
              </button>
              {resultSections.map(sec => (
                <button
                  key={sec}
                  type="button"
                  className={'kiA-chip kiA-chip--sm' + (typeFilter === sec ? ' kiA-chip--active' : '')}
                  onClick={() => onTypeFilterChange(sec)}
                >
                  {sectionLabel(sec)}
                </button>
              ))}
            </div>
          )}
          <label className="kiA-sort">
            <span className="kiA-sort-label">Sort</span>
            <select
              value={sortMode}
              onChange={e => onSortModeChange(e.target.value as SearchSortMode)}
              aria-label="Sort search results"
            >
              <option value="relevance">Relevance</option>
              <option value="recent">Recently opened</option>
            </select>
          </label>
        </div>
      </div>

      <p className="kiA-evidence" aria-live="polite">
        {searchError
          ? 'Search unavailable — your query and filters are kept'
          : searching
            ? 'Searching…'
            : !qEmpty
              ? `${results.length} document${results.length === 1 ? '' : 's'} found · ${totalMatches} match${totalMatches === 1 ? '' : 'es'}${searchSubject !== 'all' ? ` · ${subjectOf(searchSubject)?.code ?? searchSubject}` : ''}${typeFilter !== 'all' ? ` · ${sectionLabel(typeFilter)}` : ''}`
              : `${total} documents · 4 disciplines`}
      </p>

      {searching && (
        <div className="kiA-list" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="kiA-skel">
              <div className="kiA-skel-thumb" />
              <div className="kiA-skel-body">
                <div className="kiA-skel-line kiA-skel-line-a" />
                <div className="kiA-skel-line kiA-skel-line-b" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && searchError && !qEmpty && (
        <div className="kiA-empty kiA-error" role="alert">
          <p className="kiA-empty-title">Search didn't respond</p>
          <p className="kiA-empty-tip">The archive index is unreachable right now. Your query &ldquo;{query.trim()}&rdquo; and filters are kept.</p>
          <button type="button" className="de-btn-secondary kiA-retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {!searching && !searchError && !qEmpty && results.length === 0 && (
        <div className="kiA-empty">
          <p className="kiA-empty-title">No matches for &ldquo;{query.trim()}&rdquo;</p>
          <p className="kiA-empty-tip">Try fewer words, or check the spelling.</p>
          <p className="kiA-empty-suggest-label">Try a subject instead — your query stays:</p>
          <div className="kiA-empty-suggest">
            {SUBJECTS.map(s => (
              <button
                key={s.id}
                type="button"
                className="kiA-recent-chip"
                onClick={() => onSubjectChange(s.id)}
              >
                {s.code} · {counts[s.id] ?? 0}
              </button>
            ))}
          </div>
          <p className="kiA-empty-suggest-label">Or try:</p>
          <div className="kiA-empty-suggest">
            {SUGGESTED_TERMS.filter(t => t.toLowerCase() !== query.trim().toLowerCase()).map(term => (
              <button
                key={term}
                type="button"
                className="kiA-recent-chip"
                onClick={() => onQueryChange(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {!searching && !searchError && !qEmpty && results.length > 0 && (
        // Round C P1: search-result entrances on the spec motion
        // language (distance 18, duration 0.48, threshold 0.12,
        // stagger 0.045, once) — Round A 2026-11-07 sets the spec's
        // 35-50ms stagger (was 0.06). AnimatedList is NOT used: its
        // vendored 620ms spring violates the 160-220ms/no-spring
        // rules; AnimatedContent is the compliant equivalent.
        <AnimatedContent
          key={query + searchSubject + typeFilter + sortMode}
          className="kiA-hits"
          trigger="mount"
          distance={18}
          duration={0.48}
          ease="power3.out"
          initialOpacity={0}
          blur={0}
          threshold={0.12}
          stagger={0.045}
          once
        >
          {results.map((hit, i) => renderHit(hit, i))}
        </AnimatedContent>
      )}

      {!searching && qEmpty && (
        <div className="kiA-idle">
          <p className="kiA-recent-label">Suggested searches</p>
          <div className="kiA-recent">
            {SUGGESTED_TERMS.map(term => (
              <button
                key={term}
                type="button"
                className="kiA-recent-chip"
                onClick={() => onQueryChange(term)}
              >
                {term}
              </button>
            ))}
          </div>
          {recent.length > 0 && (
            <>
              <p className="kiA-recent-label">Recent searches</p>
              <div className="kiA-recent">
                {recent.map(term => (
                  <button
                    key={term}
                    type="button"
                    className="kiA-recent-chip"
                    onClick={() => onQueryChange(term)}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="kiA-hint">
            Type to search every PDF in the archive — titles, full text, even equations.
          </p>
        </div>
      )}
    </div>
  );
}
