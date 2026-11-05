import { useMemo, type CSSProperties } from 'react';
import SpotlightCard from '../bits/SpotlightCard';
import SplitText from '../components/SplitText';
import AnimatedContent from '../bits/AnimatedContent';
import AtlasPlate from '../components/AtlasPlate';
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
  files: LibFile[];
  subject: string;
  onSubjectChange: (s: string) => void;
  filter: string;
  onFilterChange: (q: string) => void;
  section: string;
  onSectionChange: (s: string) => void;
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

  const baseFiltered = useMemo(() => {
    let out = subjectFiles;
    if (section !== 'all') out = out.filter(f => f.section === section);
    if (bookmarksOnly) out = out.filter(f => bookmarks.includes(f.key));
    return out;
  }, [subjectFiles, section, bookmarksOnly, bookmarks]);

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

  const subjPages = useMemo(
    () => subjectFiles.reduce((s, f) => s + (f.pages || 0), 0),
    [subjectFiles]
  );
  const subjCollections = useMemo(
    () => new Set(subjectFiles.map(f => f.section)).size,
    [subjectFiles]
  );

  // Subject hero copy (OBSIDIAN ATLAS): each discipline its own
  // collection — code + short phrase, keywords subline, real stats.
  const SUBJECT_HERO: Record<string, { phrase: string; keys: string }> = {
    em2: { phrase: 'The study of change.', keys: 'Equations · Transforms · Proofs' },
    signals: { phrase: 'The study of signals.', keys: 'Frequency · Time · Response' },
    fis: { phrase: 'The study of thought.', keys: 'Philosophy · Arguments · Ideas · Meaning' },
    digital: { phrase: 'The study of logic.', keys: 'Logic · Circuits · Systems' },
  };
  const hero = activeSubject ? SUBJECT_HERO[activeSubject.id] : undefined;
  const title = subject === 'all'
    ? 'The Complete Archive'
    : `${activeSubject?.code ?? ''} — ${hero?.phrase ?? activeSubject?.name ?? 'Archive'}`;
  const eyebrow = subject === 'all'
    ? 'THE COMPLETE ARCHIVE · REGISTRY NO. II'
    : `SUBJECT EDITION · DISCIPLINE ${activeSubject?.num ?? ''}`;
  const accent = activeSubject ? v2SubjectColor(activeSubject.id) : '#59E4D2';

  const openReader = (key: string) => onOpenReader(key, filteredKeys);

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
    <div className="kiA-page">
      {/* ---------- edition header ---------- */}
      <header className="kiA-head" style={{ ['--ed-accent' as string]: accent }}>
        <p className="kiA-eyebrow">{eyebrow}</p>
        <h1 className="kiA-display kiA-ed-title">
          <SplitText
            lines={[{ text: title }]}
          />
        </h1>
        {subject !== 'all' && hero && (
          <p className="kiA-ed-subline">{hero.keys}.</p>
        )}
        <div className="kiA-ed-stats" role="list" aria-label="Collection statistics">
          <span className="kiA-ed-stat" role="listitem">
            <span className="kiA-ed-stat-num">{String(subjectFiles.length).padStart(2, '0')}</span>
            <span className="kiA-ed-stat-label">DOCUMENTS</span>
          </span>
          <span className="kiA-ed-stat" role="listitem">
            <span className="kiA-ed-stat-num">{subjPages.toLocaleString('en-US')}</span>
            <span className="kiA-ed-stat-label">PAGES</span>
          </span>
          <span className="kiA-ed-stat" role="listitem">
            <span className="kiA-ed-stat-num">{String(subjCollections).padStart(2, '0')}</span>
            <span className="kiA-ed-stat-label">COLLECTIONS</span>
          </span>
        </div>
        {subject === 'all' && (
          <p className="kiA-ed-subline">
            {baseFiltered.length} documents · {subjPages.toLocaleString('en-US')} pages · {subjCollections} collections
          </p>
        )}
      </header>

      {/* ---------- controls ---------- */}
      <div className="kiA-controls" role="toolbar" aria-label="Library controls">
        <div className="kiA-tabs" role="tablist" aria-label="Subject edition">
          <button
            type="button"
            role="tab"
            aria-selected={subject === 'all'}
            className={`kiA-tab${subject === 'all' ? ' kiA-tab--active' : ''}`}
            onClick={() => onSubjectChange('all')}
          >
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
              style={{ ['--subj' as string]: v2SubjectColor(s.id) }}
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
          stagger={0.02}
          staggerFrom="start"
          once
        >
          {filtered.map((f) => {
            const color = v2SubjectColor(f.subj);
            const pos = posMap.get(f.key);
            const progress = progressOf(f);
            const opened = recentTs[f.key] ? relTime(recentTs[f.key]) : null;
            const saved = bookmarks.includes(f.key);
            return (
              <SpotlightCard
                key={f.key}
                className="kiA-card"
                spotlightColor={color}
                intensity={0.2}
                softness={0.7}
                spotlightSize={230}
                borderGlow={0.45}
                proximity={130}
                flare={false}
                theme="dark"
                style={{ ['--subj' as string]: color } as CSSProperties}
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
                    <AtlasPlate
                      subj={f.subj}
                      title={f.title}
                      section={f.section}
                      pages={f.pages}
                      docNo={subjOrder.get(f.key) ?? 1}
                    />
                    {bookmarkBtn(f)}
                  </div>
                  <div className="kiA-card-body">
                    {progress !== null && (
                      <div className="kiA-card-progress" role="progressbar"
                        aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                        aria-label={`${progress}% read`}>
                        <div className="kiA-card-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                    <p className="kiA-card-foot">
                      {opened ? `opened ${opened}` : 'not opened yet'}
                      {pos ? ` · p.${pos}` : ''}
                      {saved ? ' · saved' : ''}
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
            const color = v2SubjectColor(f.subj);
            const subjCode = subjectOf(f.subj)?.code ?? f.subj.toUpperCase();
            return (
              <div
                key={f.key}
                className="kiA-row"
                role="button"
                tabIndex={0}
                onClick={() => openReader(f.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReader(f.key); } }}
                aria-label={`Open ${f.title}`}
                style={{ ['--subj' as string]: color } as CSSProperties}
              >
                <span className="kiA-row-plateno">
                  {subjCode}-{String(subjOrder.get(f.key) ?? 1).padStart(2, '0')}
                </span>
                <div className="kiA-row-thumb">
                  <img
                    className="kiA-row-thumb-img"
                    src={pageImageUrl(f.subj, f.file, 1, f.pages)}
                    alt=""
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
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
