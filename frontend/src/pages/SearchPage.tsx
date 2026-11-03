import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  SUBJECTS,
  subjectOf,
  pageImageUrl,
  sectionLabel,
  matchScore,
  matchReason,
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
  // v2.0 filter bar: discipline (App) + type + sort, all working together.
  typeFilter: string;
  onTypeFilterChange: (s: string) => void;
  resultSections: string[];
  sortMode: SearchSortMode;
  onSortModeChange: (m: SearchSortMode) => void;
  selected: number;
  onSelect: (i: number) => void;
  onOpen: (hit: SearchHit) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
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

export default function SearchPage(props: SearchPageProps) {
  const {
    query, onQueryChange, results, searching, totalMatches,
    counts, total, searchSubject, onSubjectChange,
    typeFilter, onTypeFilterChange, resultSections,
    sortMode, onSortModeChange,
    selected, onSelect, onOpen, inputRef,
  } = props;

  const [recent, setRecent] = useState<string[]>(readRecent);

  // Refresh the chips whenever the field is cleared back to empty.
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

  return (
    <div className="kiA-page">
      <header className="kiA-head">
        <p className="kiA-eyebrow">Discover</p>
        <h1 className="kiA-title">Search the archive</h1>
      </header>

      <div className="kiA-searchwrap">
        <input
          ref={inputRef}
          className="kiA-input"
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search titles, full text, equations…  ( / )"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* v2.0 filter bar: discipline + type + sort, working together */}
      <div className="kiA-filterbar" role="toolbar" aria-label="Search filters">
        <div className="kiA-chips" role="tablist" aria-label="Filter by subject">
          <button
            type="button"
            role="tab"
            aria-selected={searchSubject === 'all'}
            className={'kiA-chip' + (searchSubject === 'all' ? ' kiA-chip-active' : '')}
            onClick={() => onSubjectChange('all')}
          >
            <span className="kiA-chip-dot kiA-chip-dot-all" />
            All
            <span className="kiA-chip-count">{total}</span>
          </button>
          {SUBJECTS.map(s => {
            const active = searchSubject === s.id;
            const color = v2SubjectColor(s.id);
            const style: CSSProperties = active
              ? {
                  borderColor: color,
                  boxShadow: `0 0 0 1px ${color}, 0 0 16px -6px ${color}`,
                }
              : {};
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={'kiA-chip' + (active ? ' kiA-chip-active' : '')}
                style={style}
                onClick={() => onSubjectChange(s.id)}
              >
                <span className="kiA-chip-dot" style={{ backgroundColor: color }} />
                {s.code}
                <span className="kiA-chip-count">{counts[s.id] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="kiA-filterbar-row">
          {showTypeFilter && (
            <div className="kiA-type-chips" aria-label="Filter by document type">
              <button
                type="button"
                className={'kiA-chip kiA-chip--sm' + (typeFilter === 'all' ? ' kiA-chip-active' : '')}
                onClick={() => onTypeFilterChange('all')}
              >
                All types
              </button>
              {resultSections.map(sec => (
                <button
                  key={sec}
                  type="button"
                  className={'kiA-chip kiA-chip--sm' + (typeFilter === sec ? ' kiA-chip-active' : '')}
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
        {searching
          ? 'Searching…'
          : !qEmpty
            ? `${results.length} document${results.length === 1 ? '' : 's'} · ${totalMatches} match${totalMatches === 1 ? '' : 'es'}`
            : `${total} documents · 4 subjects`}
      </p>

      {searching && (
        <div className="kiA-list" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="kiA-skel">
              <div className="kiA-skel-thumb" />
              <div className="kiA-skel-body">
                <div className="kiA-skel-line kiA-skel-line-a" />
                <div className="kiA-skel-line kiA-skel-line-b" />
                <div className="kiA-skel-line kiA-skel-line-c" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && !qEmpty && results.length === 0 && (
        <div className="kiA-empty">
          <p className="kiA-empty-title">No matches for &ldquo;{query.trim()}&rdquo;</p>
          <p className="kiA-empty-tip">Try fewer words, or check the spelling.</p>
        </div>
      )}

      {!searching && !qEmpty && results.length > 0 && (
        <ul className="kiA-list">
          {results.map((hit, i) => {
            const subj = subjectOf(hit.subj);
            const color = v2SubjectColor(hit.subj);
            const file = hit.file || hit.key.split('::')[2] || '';
            const thumb = pageImageUrl(hit.subj, file, 1, hit.pages);
            const isSel = i === selected;
            const preview = hit.excerpt || hit.passages?.[0]?.snippet || '';
            const pg = hitPage(hit);
            return (
              <li key={hit.key + '::' + i}>
                <button
                  type="button"
                  className={'kiA-card' + (isSel ? ' kiA-card-selected' : '')}
                  style={{ '--kiA-subject': color, animationDelay: `${Math.min(i, 9) * 36}ms` } as CSSProperties}
                  onClick={() => { onSelect(i); onOpen(hit); }}
                  onMouseEnter={() => { if (i !== selected) onSelect(i); }}
                >
                  <span className="kiA-thumb" aria-hidden="true">
                    {thumb && file ? (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : null}
                  </span>
                  <span className="kiA-main">
                    <span className="kiA-card-title">{highlightQuery(hit.title, query)}</span>
                    <span className="kiA-meta">
                      <span className="kiA-meta-dot" style={{ backgroundColor: color }} />
                      {subj?.code ?? hit.subj.toUpperCase()}
                      {' · '}
                      {sectionLabel(hit.section)}
                      {' · '}
                      {hit.pages} page{hit.pages === 1 ? '' : 's'}
                      {pg !== null && (
                        <span className="kiA-meta-page"> · match on p. {pg}</span>
                      )}
                    </span>
                    {preview && (
                      <span className="kiA-preview">{highlightQuery(preview, query)}</span>
                    )}
                  </span>
                  <span className="kiA-badge">
                    <span className="kiA-badge-score">{matchScore(hit, query)}%</span>
                    <span className="kiA-badge-reason">{matchReason(hit, query)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!searching && qEmpty && (
        <div className="kiA-idle">
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
