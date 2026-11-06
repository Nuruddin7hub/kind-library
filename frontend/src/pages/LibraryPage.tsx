import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import SpotlightCard from '../bits/SpotlightCard';
import SplitText from '../components/SplitText';
import AnimatedContent from '../bits/AnimatedContent';
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
  disciplineGlyph,
} from '../shared';
import './LibraryPage.css';

/* Real document excerpts (P3 editorial cards): fetched once per key
 * from /api/excerpts (backend text index — real PDF text only).
 * Docs with no indexed text get NO description line, never a
 * fabricated one. Module cache so re-sorts/filters don't refetch. */
const excerptCache = new Map<string, string>();

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
  const filteredKeySet = useMemo(() => [...filteredKeys].sort().join(','), [filteredKeys]);
  const [excerpts, setExcerpts] = useState<Record<string, string>>({});
  useEffect(() => {
    setExcerpts(Object.fromEntries([...excerptCache.entries()]));
    const missing = filteredKeys.filter(k => !excerptCache.has(k));
    if (!missing.length) return;
    let cancelled = false;
    fetch(`/api/excerpts?keys=${encodeURIComponent(missing.join(','))}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const map = (d.excerpts || {}) as Record<string, string>;
        for (const [k, v] of Object.entries(map)) excerptCache.set(k, v);
        setExcerpts(Object.fromEntries([...excerptCache.entries()]));
      })
      .catch(() => { /* excerpts are enhancement-only: cards render without them */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredKeySet]);
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
      {/* ---------- edition header ----------
          P3 subject hero (65/35): left title/desc/metrics, right
          large low-opacity discipline glyph with a subject-colour
          radial glow + fine discipline motif (manuscript lines for
          FIS, waveform for Signals, equation fragments for EM2,
          circuit dots for Digital). Same structural template, the
          artwork changes per discipline. */}
      <header className={`kiA-head${subject !== 'all' ? ' kiA-head--surfaced' : ''}`} style={{ ['--ed-accent' as string]: accent }}>
        <div className="kiA-ed-hero-main">
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
        </div>
        {subject !== 'all' && activeSubject && (
          <div className={`kiA-ed-hero-art kiA-ed-hero-art--${subject}`} aria-hidden="true">
            <span className="kiA-ed-hero-glyph">{disciplineGlyph(subject)}</span>
            {subject === 'fis' && <span className="kiA-ed-hero-motif kiA-ed-hero-motif--fis" />}
            {subject === 'digital' && <span className="kiA-ed-hero-motif kiA-ed-hero-motif--digital" />}
            {subject === 'signals' && (
              <svg className="kiA-ed-hero-motif kiA-ed-hero-motif--signals" viewBox="0 0 300 80" fill="none" preserveAspectRatio="none">
                <path d="M0 40 Q 37 5, 75 40 T 150 40 T 225 40 T 300 40" stroke="currentColor" strokeWidth="1.5" />
                <path d="M0 52 Q 37 25, 75 52 T 150 52 T 225 52 T 300 52" stroke="currentColor" strokeWidth="1" opacity="0.55" />
                <path d="M0 28 Q 37 -5, 75 28 T 150 28 T 225 28 T 300 28" stroke="currentColor" strokeWidth="1" opacity="0.55" />
              </svg>
            )}
            {subject === 'em2' && (
              <>
                <span className="kiA-ed-equation" style={{ top: '8%', right: '12%', fontSize: 56 }}>∫</span>
                <span className="kiA-ed-equation" style={{ top: '58%', right: '4%', fontSize: 40 }}>∂</span>
                <span className="kiA-ed-equation" style={{ bottom: '6%', right: '30%', fontSize: 34 }}>π</span>
              </>
            )}
          </div>
        )}
      </header>

      {/* ---------- controls ---------- */}
      <div className="kiA-controls" role="toolbar" aria-label="Library controls">
        {/* Editorial selectors (§20): DISCIPLINE: / TYPE: text lines with
            a thin cyan indicator under the active option — no chunky pills */}
        <div className="kiA-selectors">
          <div className="kiA-selector" role="tablist" aria-label="Discipline">
            <span className="kiA-selector-label">DISCIPLINE</span>
            <button
              type="button"
              role="tab"
              aria-selected={subject === 'all'}
              className={`kiA-sel-opt${subject === 'all' ? ' kiA-sel-opt--active' : ''}`}
              onClick={() => onSubjectChange('all')}
            >
              All<span className="kiA-sel-count">{total}</span>
            </button>
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={subject === s.id}
                className={`kiA-sel-opt${subject === s.id ? ' kiA-sel-opt--active' : ''}`}
                style={{ ['--sel-accent' as string]: v2SubjectColor(s.id) }}
                onClick={() => onSubjectChange(s.id)}
              >
                {s.code}<span className="kiA-sel-count">{counts[s.id] ?? 0}</span>
              </button>
            ))}
          </div>
          {showSections && (
            <div className="kiA-selector" role="group" aria-label="Document type">
              <span className="kiA-selector-label">TYPE</span>
              <button
                type="button"
                className={`kiA-sel-opt${section === 'all' ? ' kiA-sel-opt--active' : ''}`}
                aria-pressed={section === 'all'}
                onClick={() => onSectionChange('all')}
              >
                All
              </button>
              {availableSections.map((sid) => (
                <button
                  key={sid}
                  type="button"
                  className={`kiA-sel-opt${section === sid ? ' kiA-sel-opt--active' : ''}`}
                  aria-pressed={section === sid}
                  onClick={() => onSectionChange(sid)}
                >
                  {sectionLabel(sid)}
                </button>
              ))}
            </div>
          )}
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
          distance={24}
          duration={0.7}
          ease="power3.out"
          initialOpacity={0}
          threshold={0.1}
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
            const subjCode = subjectOf(f.subj)?.code ?? f.subj.toUpperCase();
            const excerpt = excerpts[f.key] || '';
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
                {/* Editorial document card (P3): plate number, title,
                    classification, page count, large low-opacity
                    discipline watermark behind the content, real
                    document excerpt where the text index has one
                    (no description at all where it doesn't),
                    bookmark action. */}
                <div
                  className="kiA-ed-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openReader(f.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReader(f.key); } }}
                  aria-label={`Open ${f.title}`}
                >
                  <span className="kiA-ed-watermark" aria-hidden="true">{disciplineGlyph(f.subj)}</span>
                  <div className="kiA-ed-card-top">
                    <span className="kiA-ed-plateno">
                      {subjCode}-{String(subjOrder.get(f.key) ?? 1).padStart(2, '0')}
                    </span>
                    {bookmarkBtn(f)}
                  </div>
                  <h3 className="kiA-ed-card-title">{f.title}</h3>
                  <p className="kiA-ed-card-class">
                    {sectionLabel(f.section)} · {f.pages} pages
                  </p>
                  {excerpt && (
                    <p className="kiA-ed-card-desc">{excerpt}</p>
                  )}
                  {progress !== null && (
                    <div className="kiA-card-progress" role="progressbar"
                      aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                      aria-label={`${progress}% read`}>
                      <div className="kiA-card-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <div className="kiA-ed-card-foot">
                    <span className="kiA-ed-card-meta">
                      {opened ? `Opened ${opened}` : 'Not opened yet'}
                      {pos ? ` · p.${pos}` : ''}
                      {saved ? ' · Saved' : ''}
                    </span>
                    <span className="kiA-ed-card-open">Open →</span>
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
