// K/IND mobile library — "all documents" view (ChatGPT Round B, 2026-11-03).
// Header ("The archive."), filter field, subject rail with edge fade, tools row
// with filter/sort bottom sheets, removable active-filter chips, and a
// MobileDocRow list. Also exports MobileSaved ("Saved." view).
// Desktop untouched. Hard constraints honored: no auto-focus anywhere,
// 44px minimum tap targets, safe-area respected, prefers-reduced-motion
// honored (no entrance stagger animations, no shimmer when reduced).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LibFile } from '../shared';
import { SUBJECTS, SECTION_LABELS, sectionLabel, subjectOf, relTime } from '../shared';
import MobileDocRow from './MobileDocRow';
import RowStagger from './RowStagger';
import BottomSheet from './BottomSheet';
import Dither from '../bits/Dither';
import SpecularButton from '../bits/SpecularButton';
import './MobileLibrary.css';

type SortId = 'recent' | 'title' | 'pages';

export interface MobileLibraryProps {
  files: LibFile[];                 // all docs (for counts/sections)
  indexFiles: LibFile[];            // filtered+sorted by parent (subject/section/text/sort/bookmarks)
  subjectCounts: Record<string, number>;
  indexSubject: string;             // 'all' here; pills call onSubjectChange
  onSubjectChange: (s: string) => void;
  filter: string;
  onFilterChange: (q: string) => void;
  section: string;
  onSectionChange: (s: string) => void;
  sort: SortId;
  onSortChange: (s: SortId) => void;
  bookmarksOnly: boolean;
  onBookmarksOnlyChange: (b: boolean) => void;
  recentKeys: string[];
  bookmarks: string[];
  onToggleBookmark: (key: string) => void;
  onOpenReader: (key: string, list: string[]) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  reducedMotion: boolean;
}

const SORT_OPTIONS: Array<{ id: SortId; label: string; hint: string }> = [
  { id: 'recent', label: 'Recent', hint: 'Newest first' },
  { id: 'title', label: 'Title A–Z', hint: 'Alphabetical' },
  { id: 'pages', label: 'Most pages', hint: 'Longest documents first' },
];

function subjMeta(subj: string): { code: string; color: string } {
  const s = subjectOf(subj);
  return {
    code: s ? s.code : subj.toUpperCase(),
    color: s ? s.color : '#9AA7BE',
  };
}

function docRow(
  f: LibFile,
  i: number,
  bookmarks: string[],
  onToggleBookmark: (key: string) => void,
  onOpen: (key: string) => void,
  studyState?: string | null,
  showSubject = true,
) {
  const { code, color } = subjMeta(f.subj);
  return (
    <MobileDocRow
      key={f.key}
      f={f}
      index={i}
      accent={color}
      subjectCode={code}
      sectionLabel={sectionLabel(f.section)}
      bookmarked={bookmarks.includes(f.key)}
      studyState={studyState ?? null}
      showSubject={showSubject}
      onOpen={() => onOpen(f.key)}
      onToggleBookmark={() => onToggleBookmark(f.key)}
    />
  );
}

/** Rich study metadata from real stored state: continue position (kl:pos)
 *  wins, else last-opened time (kl:recentTs). Never invented. */
function studyStateFor(f: LibFile, recentKeys: string[]): string | null {
  let pos = 0;
  try { pos = parseInt(localStorage.getItem(`kl:pos:${f.key}`) || '0', 10) || 0; } catch { /* ignore */ }
  if (pos > 1) return `CONTINUE P.${Math.min(pos, Math.max(1, f.pages))}`;
  let ts: number | null = null;
  try { ts = JSON.parse(localStorage.getItem('kl:recentTs') || '{}')[f.key] ?? null; } catch { /* ignore */ }
  if (ts || recentKeys.includes(f.key)) return `OPENED ${relTime(ts)}`.toUpperCase();
  return null;
}

export default function MobileLibrary(props: MobileLibraryProps) {
  const {
    files, indexFiles, subjectCounts, indexSubject, onSubjectChange,
    filter, onFilterChange, section, onSectionChange,
    sort, onSortChange, bookmarksOnly, onBookmarksOnlyChange,
    recentKeys, bookmarks, onToggleBookmark, onOpenReader,
    onClearFilters, reducedMotion,
  } = props;

  const [filterOpen, setFilterOpen] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  // collapsed subject groups (Round B 2026-11-04: optional collapse)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const railRef = useRef<HTMLDivElement>(null);

  // selected chip stays visible: center it in the rail on subject change
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector('.ml-pill.active') as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [indexSubject]);

  // Temp filter-sheet state — committed to parent setters on Apply.
  // (Round B 2026-11-04, 1420 loop: Subject / Type / Saved only / Sort /
  // Clear / Apply — ONE sheet, no separate sort control.)
  // Round B 2026-11-06 (deferred 2026-11-05 P1): the sheet is the ADVANCED
  // filter drawer — Document type, Show only, Sort. Subject lives ONLY on
  // the pills; the sheet no longer duplicates it (no tempSubject).
  const [tempSection, setTempSection] = useState('all');
  const [tempBookmarked, setTempBookmarked] = useState(false);
  const [tempRecent, setTempRecent] = useState(false);
  const [tempSort, setTempSort] = useState<SortId>('recent');

  // Doc-type chips derived from files (label + count via SECTION_LABELS).
  const sectionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) counts.set(f.section, (counts.get(f.section) ?? 0) + 1);
    return [...counts.entries()]
      .map(([sec, count]) => ({ section: sec, count, label: SECTION_LABELS[sec] ?? sec }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [files]);

  // Client-side "recently opened" filter on top of the parent's indexFiles
  // (parent's bookmarksOnly is already applied — never double-apply it here).
  const effectiveFiles = useMemo(() => {
    if (!recentOnly) return indexFiles;
    const set = new Set(recentKeys);
    return indexFiles.filter(f => set.has(f.key));
  }, [indexFiles, recentOnly, recentKeys]);

  const effectiveList = useMemo(() => effectiveFiles.map(f => f.key), [effectiveFiles]);
  const globalIndex = useMemo(
    () => new Map(effectiveFiles.map((f, i) => [f.key, i])),
    [effectiveFiles],
  );

  const openFilterSheet = () => {
    setTempSection(section);
    setTempBookmarked(bookmarksOnly);
    setTempRecent(recentOnly);
    setTempSort(sort);
    setFilterOpen(true);
  };

  const resetTemp = () => {
    setTempSection('all');
    setTempBookmarked(false);
    setTempRecent(false);
    setTempSort('recent');
  };

  const applyFilters = () => {
    onSectionChange(tempSection);
    onBookmarksOnlyChange(tempBookmarked);
    setRecentOnly(tempRecent);
    onSortChange(tempSort);
    setFilterOpen(false);
  };

  const clearAll = () => {
    setRecentOnly(false);
    onClearFilters();
  };

  const hasActiveChips = filter !== '' || section !== 'all' || bookmarksOnly || recentOnly;
  const totalCount = files.length;
  // Round B 2026-11-06: the FILTERS badge counts ADVANCED filters only
  // (doc type, saved-only, recently-opened, non-default sort) — subject
  // pills and the text field are separate mechanisms and don't count.
  const advancedFilterCount =
    (section !== 'all' ? 1 : 0) +
    (bookmarksOnly ? 1 : 0) +
    (recentOnly ? 1 : 0) +
    (sort !== 'recent' ? 1 : 0);

  const filterFooter = (
    <div className="ml-sheet-footer">
      <button type="button" className="ml-btn-ghost" onClick={resetTemp}>
        Clear
      </button>
      {reducedMotion ? (
        <button type="button" className="ml-btn-primary" onClick={applyFilters}>
          Apply
        </button>
      ) : (
        <SpecularButton
          type="button"
          size="sm"
          className="ml-btn-primary"
          onClick={applyFilters}
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
  );

  // In the grouped "all" view the subject is carried by the group header —
  // rows never repeat the subject name (Round B 2026-11-04).
  const grouped = indexSubject === 'all';

  return (
    <div className={`ml-root mobile-page${reducedMotion ? ' ml-reduced' : ''}`}
      data-subject={indexSubject !== 'all' ? indexSubject : undefined}>
      <header className="ml-header">
        {!reducedMotion && (
          <div className="ml-dither" aria-hidden="true">
            <Dither
              waveColor={[0.05, 0.22, 0.3]}
              backgroundColor={[0.03, 0.05, 0.09]}
              colorNum={4}
              pixelSize={5}
              contrast={0.25}
              brightness={1.0}
              waveSpeed={0.012}
              waveFrequency={1.8}
              waveAmplitude={0.06}
              enableMouseInteraction={false}
            />
          </div>
        )}
        <p className="ml-eyebrow">K/IND LIBRARY</p>
        <h1 className="ml-title">The archive.</h1>
      </header>

      {files.length === 0 ? (
        // Loading state: shimmering skeleton rows (animation disabled under
        // prefers-reduced-motion or when reducedMotion is set).
        <div className="ml-list" aria-hidden="true">
          {[0, 1, 2, 3, 4].map(i => (
            <div className="ml-skel" key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="ml-filter-wrap">
            <input
              className="ml-filter-input"
              type="search"
              value={filter}
              onChange={e => onFilterChange(e.target.value)}
              placeholder="Filter documents…"
              aria-label="Filter documents"
              enterKeyHint="search"
            />
          </div>

          <div className="ml-rail" ref={railRef} role="tablist" aria-label="Filter by subject">
            <button
              key="all"
              type="button"
              role="tab"
              aria-selected={indexSubject === 'all'}
              className={`ml-pill${indexSubject === 'all' ? ' active' : ''}`}
              onClick={() => onSubjectChange('all')}
            >
              ALL · {totalCount}
            </button>
            {SUBJECTS.map(s => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={indexSubject === s.id}
                className={`ml-pill${indexSubject === s.id ? ' active' : ''}`}
                style={indexSubject === s.id ? { borderColor: s.color, color: s.color } : undefined}
                onClick={() => onSubjectChange(s.id)}
              >
                {s.code} · {subjectCounts[s.id] ?? 0}
              </button>
            ))}
          </div>

          {/* spec hierarchy (1420 loop): "N DOCUMENTS" + Filters button —
              sort lives INSIDE the filter sheet, no separate sort control */}
          <div className="ml-tools">
            <span className="ml-count" aria-live="polite">
              {effectiveFiles.length} DOCUMENTS
            </span>
            <button
              type="button"
              className={`ml-tools-btn${advancedFilterCount > 0 ? ' has-badge' : ''}`}
              onClick={openFilterSheet}
            >
              FILTERS
              {advancedFilterCount > 0 && <span className="ml-badge">{advancedFilterCount}</span>}
            </button>
          </div>

          {hasActiveChips && (
            <div className="ml-chips" aria-label="Active filters">
              {filter !== '' && (
                <button type="button" className="ml-chip" onClick={() => onFilterChange('')}
                  aria-label={`Remove text filter “${filter}”`}>
                  <span className="ml-chip-text">“{filter}”</span>
                  <span className="ml-chip-x" aria-hidden="true">×</span>
                </button>
              )}
              {section !== 'all' && (
                <button type="button" className="ml-chip" onClick={() => onSectionChange('all')}
                  aria-label={`Remove section filter ${SECTION_LABELS[section] ?? section}`}>
                  <span className="ml-chip-text">{SECTION_LABELS[section] ?? section}</span>
                  <span className="ml-chip-x" aria-hidden="true">×</span>
                </button>
              )}
              {bookmarksOnly && (
                <button type="button" className="ml-chip" onClick={() => onBookmarksOnlyChange(false)}
                  aria-label="Remove bookmarked-only filter">
                  <span className="ml-chip-text">Bookmarked only</span>
                  <span className="ml-chip-x" aria-hidden="true">×</span>
                </button>
              )}
              {recentOnly && (
                <button type="button" className="ml-chip" onClick={() => setRecentOnly(false)}
                  aria-label="Remove recently-opened filter">
                  <span className="ml-chip-text">Recently opened</span>
                  <span className="ml-chip-x" aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}

          {effectiveFiles.length === 0 ? (
            <div className="ml-empty">
              <p className="ml-empty-text">No documents match these filters.</p>
              <button type="button" className="ml-clear-btn" onClick={clearAll}>
                Clear filters
              </button>
            </div>
          ) : grouped ? (
            /* grouped by subject with collapsible sticky headings */
            <div className="ml-list">
              {SUBJECTS.map(s => {
                const docs = effectiveFiles.filter(f => f.subj === s.id);
                if (!docs.length) return null;
                const isCollapsed = !!collapsed[s.id];
                return (
                  <section className="ml-group" key={s.id} aria-label={s.name}>
                    <button
                      type="button"
                      className="ml-group-head"
                      style={{ ['--group-accent' as any]: s.color }}
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                    >
                      <span className="ml-group-code" style={{ color: s.color }}>{s.code}</span>
                      <span className="ml-group-name">{s.name.toUpperCase()}</span>
                      <span className="ml-group-count">{docs.length}</span>
                      <span className={`ml-group-chev${isCollapsed ? ' closed' : ''}`} aria-hidden="true">▾</span>
                    </button>
                    {!isCollapsed && (
                      <RowStagger>
                        {docs.map(f =>
                          docRow(
                            f, globalIndex.get(f.key) ?? 0, bookmarks, onToggleBookmark,
                            key => onOpenReader(key, effectiveList), studyStateFor(f, recentKeys),
                            false,
                          ),
                        )}
                      </RowStagger>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="ml-list">
              <RowStagger>
                {effectiveFiles.map((f, i) =>
                  docRow(
                    f, i, bookmarks, onToggleBookmark,
                    key => onOpenReader(key, effectiveList), studyStateFor(f, recentKeys),
                  ),
                )}
              </RowStagger>
            </div>
          )}
        </>
      )}

      {/* ---------- filter sheet ---------- */}
      <BottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filters"
        height="70vh"
        footer={filterFooter}
      >
        {/* Advanced filters only — subject lives on the pills above and is
            deliberately NOT duplicated here (Round B 2026-11-06). */}
        <div className="ml-sheet-group">
          <div className="ml-sheet-label">Doc type</div>
          <div className="ml-chip-row">
            <button
              type="button"
              className={`ml-opt${tempSection === 'all' ? ' active' : ''}`}
              aria-pressed={tempSection === 'all'}
              onClick={() => setTempSection('all')}
            >
              All types
            </button>
            {sectionOptions.map(o => (
              <button
                key={o.section}
                type="button"
                className={`ml-opt${tempSection === o.section ? ' active' : ''}`}
                aria-pressed={tempSection === o.section}
                onClick={() => setTempSection(o.section)}
              >
                {o.label} · {o.count}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-sheet-group">
          <div className="ml-sheet-label">Show only</div>
          <button
            type="button"
            role="switch"
            aria-checked={tempBookmarked}
            className="ml-toggle"
            onClick={() => setTempBookmarked(v => !v)}
          >
            <span className="ml-toggle-text">Bookmarked only</span>
            <span className={`ml-switch${tempBookmarked ? ' on' : ''}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={tempRecent}
            className="ml-toggle"
            onClick={() => setTempRecent(v => !v)}
          >
            <span className="ml-toggle-text">Recently opened</span>
            <span className={`ml-switch${tempRecent ? ' on' : ''}`} aria-hidden="true" />
          </button>
        </div>
        <div className="ml-sheet-group">
          <div className="ml-sheet-label">Sort by</div>
          <div className="ml-chip-row">
            {SORT_OPTIONS.map(o => (
              <button
                key={o.id}
                type="button"
                className={`ml-opt${tempSort === o.id ? ' active' : ''}`}
                aria-pressed={tempSort === o.id}
                onClick={() => setTempSort(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

/** Saved view: header "Saved." + count, bookmarked docs via MobileDocRow. */
export function MobileSaved({
  files, bookmarks, onToggleBookmark, onOpenReader,
}: {
  files: LibFile[];
  bookmarks: string[];
  onToggleBookmark: (key: string) => void;
  onOpenReader: (key: string, list: string[]) => void;
}) {
  const saved = useMemo(
    () => files.filter(f => bookmarks.includes(f.key)),
    [files, bookmarks],
  );
  const savedList = useMemo(() => saved.map(f => f.key), [saved]);

  return (
    <div className="ml-root mobile-page">
      <header className="ml-header">
        <p className="ml-eyebrow">K/IND / LIBRARY</p>
        <h1 className="ml-title">Saved.</h1>
        <p className="ml-count ml-saved-count">{saved.length} DOCUMENTS</p>
      </header>

      {saved.length === 0 ? (
        <div className="ml-empty">
          <p className="ml-empty-text">Nothing saved yet — tap ☆ on any document to pin it here.</p>
        </div>
      ) : (
        <div className="ml-list">
          <RowStagger>
            {saved.map((f, i) =>
              docRow(f, i, bookmarks, onToggleBookmark, key => onOpenReader(key, savedList)),
            )}
          </RowStagger>
        </div>
      )}
    </div>
  );
}
