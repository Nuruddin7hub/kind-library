import { useMemo, useState } from 'react';
import SpotlightCard from '../bits/SpotlightCard';
import GlareHover from '../bits/GlareHover';
import Aurora from '../bits/Aurora';
import AnimatedContent from '../bits/AnimatedContent';
import DocCoverCard from '../components/DocCoverCard';
import type { LibFile } from '../shared';
import {
  SUBJECTS,
  subjectOf,
  sectionLabel,
  pageImageUrl,
  posKey,
  readJson,
  relTime,
  v2SubjectColor,
} from '../shared';
import './LibraryPage.css';

export interface LibraryPageProps {
  files: LibFile[];                       // ALL files; filtering/sorting done here
  subject: string;
  onSubjectChange: (s: string) => void;   // 'all' | 'em2' | 'signals' | 'fis' | 'digital'
  filter: string;
  onFilterChange: (q: string) => void;    // title search within subject
  section: string;
  onSectionChange: (s: string) => void;   // 'all' | section id (type filter)
  sort: 'recent' | 'title' | 'pages';
  onSortChange: (s: 'recent' | 'title' | 'pages') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (m: 'grid' | 'list') => void;
  bookmarksOnly: boolean;
  onBookmarksOnlyChange: (b: boolean) => void;
  bookmarks: string[];
  onToggleBookmark: (key: string) => void;
  onOpenReader: (key: string, list: string[]) => void;
  counts: Record<string, number>;
  total: number;
}

const SORT_OPTIONS: Array<{ id: 'recent' | 'title' | 'pages'; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'pages', label: 'Pages' },
];

/** Section ids present in a subject subset, in order of first appearance. */
function sectionsIn(files: LibFile[]): string[] {
  const seen = new Set<string>();
  for (const f of files) {
    if (!seen.has(f.section)) seen.add(f.section);
  }
  return [...seen];
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function LibraryPage(props: LibraryPageProps) {
  const {
    files, subject, onSubjectChange,
    filter, onFilterChange,
    section, onSectionChange,
    sort, onSortChange,
    viewMode, onViewModeChange,
    bookmarksOnly, onBookmarksOnlyChange,
    bookmarks, onToggleBookmark,
    onOpenReader, counts, total,
  } = props;

  const activeSubject = subjectOf(subject);
  const isFis = subject === 'fis';
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Stable 1-based doc number within its subject (for the cover identifier).
  const subjOrder = useMemo(() => {
    const perSubj = new Map<string, number>();
    const m = new Map<string, number>();
    for (const f of files) {
      const n = (perSubj.get(f.subj) ?? 0) + 1;
      perSubj.set(f.subj, n);
      m.set(f.key, n);
    }
    return m;
  }, [files]);

  // FIS header stats — real data only.
  const fisPages = useMemo(
    () => files.filter(f => f.subj === 'fis').reduce((s, f) => s + (f.pages || 0), 0),
    [files]
  );
  const fisCollections = useMemo(
    () => new Set(files.filter(f => f.subj === 'fis').map(f => f.section)).size,
    [files]
  );

  // Read-once localStorage: last-opened timestamps + saved reading positions.
  const recentTs = useMemo(
    () => readJson<Record<string, number>>('kl:recentTs', {}),
    []
  );
  const posMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files) {
      try {
        const v = localStorage.getItem(posKey(f.key));
        if (v) m.set(f.key, v);
      } catch { /* storage unavailable */ }
    }
    return m;
  }, [files]);

  const subjectFiles = useMemo(
    () => (subject === 'all' ? files : files.filter(f => f.subj === subject)),
    [files, subject]
  );

  // Filtered by subject + section + bookmarks (BEFORE the title search) —
  // this is the honest count for the header subline.
  const baseFiltered = useMemo(() => {
    let out = subjectFiles;
    if (section !== 'all') out = out.filter(f => f.section === section);
    if (bookmarksOnly) out = out.filter(f => bookmarks.includes(f.key));
    return out;
  }, [subjectFiles, section, bookmarksOnly, bookmarks]);

  // Then the title substring search, then sort.
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let out = q
      ? baseFiltered.filter(f => f.title.toLowerCase().includes(q))
      : baseFiltered;
    out = [...out];
    if (sort === 'recent') {
      out.sort((a, b) => (recentTs[b.key] || 0) - (recentTs[a.key] || 0));
    } else if (sort === 'title') {
      out.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      out.sort((a, b) => b.pages - a.pages);
    }
    return out;
  }, [baseFiltered, filter, sort, recentTs]);

  const filteredKeys = useMemo(() => filtered.map(f => f.key), [filtered]);
  const availableSections = useMemo(() => sectionsIn(subjectFiles), [subjectFiles]);
  const showSections = section !== 'all' || availableSections.length > 1;
  const title = subject === 'all' ? 'Complete Archive' : activeSubject?.name ?? 'Archive';

  const openReader = (key: string) => onOpenReader(key, filteredKeys);

  const coverImg = (f: LibFile) => (
    <img
      className="kiA-cover-img"
      src={pageImageUrl(f.subj, f.file, 1, f.pages)}
      alt=""
      loading="lazy"
      onError={(e) => {
        // No fake artwork: drop the broken image and let the
        // --surface-raised placeholder beneath show through.
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );

  const cardAccent = (f: LibFile) => {
    const color = v2SubjectColor(f.subj);
    return { '--kiA-accent': color } as React.CSSProperties;
  };

  /** Reading progress 0–100 from the saved kl:pos position. */
  const progressOf = (f: LibFile): number | null => {
    const raw = posMap.get(f.key);
    if (!raw || !f.pages) return null;
    const p = Math.max(1, Math.min(f.pages, parseInt(raw, 10) || 1));
    return Math.round((p / f.pages) * 100);
  };

  const bookmarkBtn = (f: LibFile, small?: boolean) => {
    const marked = bookmarks.includes(f.key);
    return (
      <button
        type="button"
        className={`kiA-bookmark${marked ? ' kiA-bookmark--on' : ''}${small ? ' kiA-bookmark--small' : ''}`}
        aria-label={marked ? 'Remove bookmark' : 'Bookmark'}
        aria-pressed={marked}
        onClick={(e) => { e.stopPropagation(); onToggleBookmark(f.key); }}
      >
        <BookmarkIcon filled={marked} />
      </button>
    );
  };

  const emptyMessage =
    bookmarksOnly && filtered.length === 0 && !filter.trim()
      ? 'No bookmarks yet — tap the bookmark icon on any document.'
      : 'No documents match these filters.';

  return (
    <div className={`kiA-page${isFis ? ' kiA-page--fis' : ''}`}>
      {/* ---------- header ---------- */}
      {isFis ? (
        <header className="kiA-head kiA-head--fis">
          {!reduceMotion && (
            <div className="kiA-fis-aurora" aria-hidden="true">
              <Aurora
                colorStops={['#6B4A1E', '#3A2A12', '#14100A']}
                amplitude={0.55}
                blend={0.65}
                speed={0.14}
                opacity={0.42}
                layers={2}
                mouseInteraction={false}
                intro={true}
                paused={reduceMotion}
              />
            </div>
          )}
          <div className="kiA-fis-noise" aria-hidden="true" />
          <div className="kiA-fis-art" aria-hidden="true">
            <svg viewBox="0 0 320 280" preserveAspectRatio="xMidYMid slice">
              <path d="M 40 260 A 120 120 0 0 1 280 260" fill="none" stroke="rgba(229,163,76,0.5)" strokeWidth="1.6" />
              <path d="M 70 260 A 90 90 0 0 1 250 260" fill="none" stroke="rgba(229,163,76,0.28)" strokeWidth="1" />
              {[105, 160, 215].map(x => (
                <g key={x} stroke="rgba(229,163,76,0.42)">
                  <line x1={x - 9} y1={260} x2={x - 9} y2={130} strokeWidth="2.4" />
                  <line x1={x + 9} y1={260} x2={x + 9} y2={130} strokeWidth="2.4" />
                  <line x1={x - 15} y1={130} x2={x + 15} y2={130} strokeWidth="3" />
                  <line x1={x - 15} y1={260} x2={x + 15} y2={260} strokeWidth="3" />
                </g>
              ))}
              <circle cx={160} cy={76} r={30} fill="none" stroke="rgba(229,163,76,0.5)" strokeWidth="1.4" />
              <circle cx={160} cy={76} r={40} fill="none" stroke="rgba(229,163,76,0.22)" strokeWidth="1" strokeDasharray="4 6" />
              <text x={160} y={238} textAnchor="middle" fontSize={52}
                fontFamily="'Instrument Serif', Georgia, serif" fontStyle="italic"
                fill="rgba(229,163,76,0.30)">Φ</text>
            </svg>
          </div>
          <div className="kiA-fis-tint" aria-hidden="true" />
          <div className="kiA-fis-head-inner">
            <p className="kiA-eyebrow kiA-eyebrow--amber">
              Your archive&nbsp;&nbsp;/&nbsp;&nbsp;Discipline {activeSubject?.num ?? '03'}
            </p>
            <h1 className="kiA-title kiA-title--fis">{title}</h1>
            <p className="kiA-editorial">&ldquo;Ideas. Arguments. Meaning.&rdquo;</p>
            <div className="kiA-fis-stats" role="list" aria-label="FIS collection statistics">
              <div role="listitem" className="kiA-fis-stat">
                <span className="kiA-fis-stat-num">{String(counts.fis ?? 0).padStart(2, '0')}</span>
                <span className="kiA-fis-stat-label">Documents</span>
              </div>
              <div role="listitem" className="kiA-fis-stat">
                <span className="kiA-fis-stat-num">{fisPages}</span>
                <span className="kiA-fis-stat-label">Pages</span>
              </div>
              <div role="listitem" className="kiA-fis-stat">
                <span className="kiA-fis-stat-num">{String(fisCollections).padStart(2, '0')}</span>
                <span className="kiA-fis-stat-label">Collection{fisCollections === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header className="kiA-head">
          <p className="kiA-eyebrow">YOUR ARCHIVE</p>
          <h1 className="kiA-title">{title}</h1>
          <p className="kiA-subline">
            {baseFiltered.length} document{baseFiltered.length === 1 ? '' : 's'}
            {' · '}{total} in the complete archive
          </p>
        </header>
      )}

      {/* ---------- controls ---------- */}
      <div className="kiA-controls" role="toolbar" aria-label="Library controls">
        <div className="kiA-tabs" role="tablist" aria-label="Subject">
          <button
            type="button"
            role="tab"
            aria-selected={subject === 'all'}
            className={`kiA-tab${subject === 'all' ? ' kiA-tab--active' : ''}`}
            onClick={() => onSubjectChange('all')}
          >
            <span className="kiA-tab-dot kiA-tab-dot--all" />
            <span className="kiA-tab-code">ALL</span>
            <span className="kiA-tab-count">{total}</span>
          </button>
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={subject === s.id}
              className={`kiA-tab${subject === s.id ? ' kiA-tab--active' : ''}`}
              onClick={() => onSubjectChange(s.id)}
            >
              <span className="kiA-tab-dot" style={{ background: v2SubjectColor(s.id) }} />
              <span className="kiA-tab-code">{s.code}</span>
              <span className="kiA-tab-count">{counts[s.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="kiA-controls-row">
          <input
            className="kiA-search"
            type="search"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search titles…"
            aria-label="Search titles"
          />
          {showSections && (
            <div className="kiA-type-chips" aria-label="Type filter">
              <button
                type="button"
                className={`kiA-chip${section === 'all' ? ' kiA-chip--active' : ''}`}
                onClick={() => onSectionChange('all')}
              >
                All types
              </button>
              {availableSections.map((sid) => (
                <button
                  key={sid}
                  type="button"
                  className={`kiA-chip${section === sid ? ' kiA-chip--active' : ''}`}
                  onClick={() => onSectionChange(sid)}
                >
                  {sectionLabel(sid)}
                </button>
              ))}
            </div>
          )}
          <label className="kiA-sort">
            <span className="kiA-sort-label">Sort</span>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as 'recent' | 'title' | 'pages')}
              aria-label="Sort documents"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`kiA-toggle${bookmarksOnly ? ' kiA-toggle--on' : ''}`}
            aria-pressed={bookmarksOnly}
            onClick={() => onBookmarksOnlyChange(!bookmarksOnly)}
          >
            <BookmarkIcon filled={bookmarksOnly} />
            <span>Saved</span>
          </button>
          <div className="kiA-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'grid' ? 'kiA-toggle kiA-toggle--on' : 'kiA-toggle'}
              aria-pressed={viewMode === 'grid'}
              onClick={() => onViewModeChange('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'kiA-toggle kiA-toggle--on' : 'kiA-toggle'}
              aria-pressed={viewMode === 'list'}
              onClick={() => onViewModeChange('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* ---------- content ---------- */}
      {filtered.length === 0 ? (
        <div className="kiA-empty" role="status">
          <p>{emptyMessage}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <AnimatedContent
          key={`${subject}-${section}-${sort}`}
          className="kiA-grid"
          trigger="mount"
          distance={22}
          duration={0.55}
          stagger={0.022}
          staggerFrom="start"
          once
        >
          {filtered.map((f) => {
            const accentColor = v2SubjectColor(f.subj);
            const pos = posMap.get(f.key);
            const progress = progressOf(f);
            const opened = recentTs[f.key] ? relTime(recentTs[f.key]) : null;
            const subjCode = subjectOf(f.subj)?.code ?? f.subj.toUpperCase();
            return (
              <SpotlightCard
                key={f.key}
                className="kiA-card"
                spotlightColor={accentColor}
                intensity={0.22}
                softness={0.75}
                spotlightSize={220}
                borderGlow={0.5}
                proximity={120}
                flare={false}
                theme="dark"
                style={{ ...cardAccent(f), '--spotlight-card-surface': 'var(--kiA-surface)' } as React.CSSProperties}
              >
                <div
                  className="kiA-card-inner"
                  role="button"
                  tabIndex={0}
                  onClick={() => openReader(f.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReader(f.key); } }}
                  aria-label={`Open ${f.title}`}
                >
                  <div className="kiA-cover">
                    <GlareHover
                      className="kiA-cover-glare"
                      glareColor="#ffffff"
                      glareOpacity={0.18}
                      glareAngle={-32}
                      glareSize={34}
                      variant="sheen"
                      transitionDuration={550}
                    >
                      <DocCoverCard
                        subj={f.subj}
                        title={f.title}
                        section={f.section}
                        pages={f.pages}
                        docNo={subjOrder.get(f.key) ?? 1}
                        seed={f.key}
                      />
                    </GlareHover>
                    {bookmarkBtn(f)}
                  </div>
                  <div className="kiA-card-body">
                    <p className="kiA-card-subj">{subjCode}</p>
                    <h3 className="kiA-card-title">{f.title}</h3>
                    <p className="kiA-card-meta">
                      {sectionLabel(f.section)} · {f.pages} page{f.pages === 1 ? '' : 's'}
                      {pos ? <span className="kiA-lastread"> · p.{pos}</span> : null}
                    </p>
                    {progress !== null && (
                      <div className="kiA-card-progress" role="progressbar"
                        aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                        aria-label={`${progress}% read`}>
                        <div className="kiA-card-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                    <p className="kiA-card-foot">
                      {opened ? `opened ${opened}` : 'not opened yet'}
                      {bookmarks.includes(f.key) ? ' · saved' : ''}
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </AnimatedContent>
      ) : (
        <div className="kiA-list" key={`${subject}-${section}-${sort}`}>
          {filtered.map((f) => {
            const pos = posMap.get(f.key);
            return (
              <div
                key={f.key}
                className="kiA-row"
                role="button"
                tabIndex={0}
                onClick={() => openReader(f.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReader(f.key); } }}
                aria-label={`Open ${f.title}`}
                style={cardAccent(f)}
              >
                <div className="kiA-row-thumb">{coverImg(f)}</div>
                <div className="kiA-row-main">
                  <h3 className="kiA-row-title">{f.title}</h3>
                  <p className="kiA-row-meta">
                    {sectionLabel(f.section)} · {f.pages}p
                    {pos ? <span className="kiA-lastread"> · p.{pos}</span> : null}
                  </p>
                </div>
                {bookmarkBtn(f, true)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
