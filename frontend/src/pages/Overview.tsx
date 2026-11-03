import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import MagicBento from '../bits/MagicBento';
import SplitText from '../bits/SplitText';
import CountUp from '../bits/CountUp';
import TiltedCard from '../bits/TiltedCard';
import Aurora from '../bits/Aurora';
import {
  SUBJECTS,
  getSubjectCounts,
  pageImageUrl,
  posKey,
  readJson,
  relTime,
  v2SubjectColor,
  type LibFile
} from '../shared';
import './Overview.css';

interface OverviewProps {
  files: LibFile[];
  onOpenReader: (key: string, list: string[]) => void;
  onSubmitSearch: (q: string) => void;
  onGoSubject: (subj: string) => void;
}

/* ------------------------------------------------------------------ */
/* Original SVG artwork (designed for this page, not copied).
 * Colors track the v2.0 identity palette.                            */
/* ------------------------------------------------------------------ */

/** Hero knowledge-map: four subject nodes connected by thin lines. */
function KnowledgeMap(): ReactNode {
  const nodes = [
    { id: 'em2', cx: 92, cy: 66, color: '#62A5FF', label: 'EM2' },
    { id: 'signals', cx: 328, cy: 78, color: '#B28AFF', label: 'SIGNALS' },
    { id: 'fis', cx: 104, cy: 208, color: '#E9B36A', label: 'FIS' },
    { id: 'digital', cx: 316, cy: 204, color: '#42D8C6', label: 'DIGITAL' }
  ];
  const links: Array<[number, number]> = [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]
  ];
  return (
    <svg className="kiA-kmap" viewBox="0 0 420 280" role="img" aria-label="Map of the four disciplines">
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          className="kiA-kmap-link"
        />
      ))}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.cx} cy={n.cy} r={9} className="kiA-kmap-ring" style={{ color: n.color }} />
          <circle cx={n.cx} cy={n.cy} r={5.5} fill={n.color} className="kiA-kmap-node" />
          <circle cx={n.cx} cy={n.cy} r={2} fill="#080A0F" />
          <text x={n.cx} y={n.cy + 24} textAnchor="middle" className="kiA-kmap-label">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** EM2 artwork: parabola over a faint coordinate grid. */
function ArtEm2(): ReactNode {
  const grid: ReactNode[] = [];
  for (let i = 1; i < 7; i++) {
    grid.push(<line key={`v${i}`} x1={i * 30} y1={0} x2={i * 30} y2={120} className="kiA-art-faint" />);
    grid.push(<line key={`h${i}`} x1={0} y1={i * 20} x2={210} y2={i * 20} className="kiA-art-faint" />);
  }
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      {grid}
      <path d="M 10 108 Q 70 108 105 40 T 200 20" fill="none" stroke="#62A5FF" strokeWidth="2.5" />
      <path d="M 10 100 Q 80 100 120 60 T 200 44" fill="none" stroke="#62A5FF" strokeWidth="1.5" className="kiA-art-dim" />
      <circle cx={105} cy={40} r={3.5} fill="#62A5FF" />
      <circle cx={120} cy={60} r={2.5} fill="#62A5FF" className="kiA-art-dim" />
    </svg>
  );
}

/** Signals artwork: sine wave over FFT bars. */
function ArtSignals(): ReactNode {
  const bars = [14, 34, 52, 70, 88, 64, 44, 28, 58, 78, 50, 30];
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      {bars.map((h, i) => (
        <rect key={i} x={8 + i * 16.5} y={110 - h} width={10} height={h} rx={2}
          fill="#B28AFF" className="kiA-art-dim" opacity={0.25 + (h / 90) * 0.5} />
      ))}
      <path d="M 8 60 C 40 10, 70 10, 100 60 S 160 110, 202 60" fill="none" stroke="#B28AFF" strokeWidth="2.5" />
    </svg>
  );
}

/** FIS artwork: serif philosophical typography. */
function ArtFis(): ReactNode {
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      <text x={16} y={96} className="kiA-art-serif" fill="#E9B36A" fontSize={92}>?</text>
      <text x={86} y={44} className="kiA-art-serif" fill="#E9B36A" fontSize={26} opacity={0.9}>λόγος</text>
      <line x1={88} y1={60} x2={196} y2={60} stroke="#E9B36A" strokeWidth={1} className="kiA-art-dim" />
      <text x={88} y={86} className="kiA-art-serif" fill="#E9B36A" fontSize={17} opacity={0.55}>cogito</text>
      <text x={88} y={106} className="kiA-art-serif" fill="#E9B36A" fontSize={17} opacity={0.35}>ergo sum</text>
    </svg>
  );
}

/** Digital artwork: circuit traces with nodes. */
function ArtDigital(): ReactNode {
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      <path d="M 14 100 L 60 100 L 78 82 L 130 82 L 148 64 L 196 64" fill="none" stroke="#42D8C6" strokeWidth={2} />
      <path d="M 14 34 L 46 34 L 64 52 L 120 52" fill="none" stroke="#42D8C6" strokeWidth={1.5} className="kiA-art-dim" />
      <path d="M 150 104 L 150 84 L 178 84" fill="none" stroke="#42D8C6" strokeWidth={1.5} className="kiA-art-dim" />
      {[
        [14, 100], [78, 82], [130, 82], [196, 64],
        [14, 34], [64, 52], [120, 52], [150, 104], [178, 84]
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={5} fill="none" stroke="#42D8C6" strokeWidth={2} />
          <circle cx={x} cy={y} r={1.8} fill="#42D8C6" />
        </g>
      ))}
    </svg>
  );
}

const ART: Record<string, () => ReactNode> = {
  em2: ArtEm2,
  signals: ArtSignals,
  fis: ArtFis,
  digital: ArtDigital
};

/* ------------------------------------------------------------------ */
/* Overview page — Obsidian Archive v2.0 (ChatGPT Round A, 2026-11-03)  */
/* ------------------------------------------------------------------ */

/** Archive stat — CountUp from real data; "—" while the library loads. */
function Stat({ value, label, loaded }: { value: number; label: string; loaded: boolean }) {
  return (
    <div className="kiA-stat">
      <span className="kiA-stat-num">
        {loaded
          ? <CountUp to={value} duration={1.4} trigger="view" separator="," className="kiA-stat-count" />
          : '—'}
      </span>
      <span className="kiA-stat-label">{label}</span>
    </div>
  );
}

export default function Overview({ files, onOpenReader, onSubmitSearch, onGoSubject }: OverviewProps) {
  const [query, setQuery] = useState('');
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const counts = useMemo(() => getSubjectCounts(files), [files]);
  const totalDocs = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const totalPages = useMemo(() => files.reduce((s, f) => s + (f.pages || 0), 0), [files]);
  const loaded = files.length > 0;

  const filesByKey = useMemo(() => {
    const m = new Map<string, LibFile>();
    for (const f of files) m.set(f.key, f);
    return m;
  }, [files]);

  // Real localStorage state: recent list (most-recent first), open timestamps, saved positions.
  const recentKeys = useMemo(() => readJson<string[]>('kl:recent', []), []);
  const recentTs = useMemo(() => readJson<Record<string, number>>('kl:recentTs', {}), []);
  const bookmarkCount = useMemo(() => readJson<string[]>('kl:bookmarks', []).length, []);

  const continueFile = useMemo(() => {
    const key = recentKeys[0];
    if (!key) return null;
    const f = filesByKey.get(key);
    return f ? { file: f, key } : null;
  }, [recentKeys, filesByKey]);

  const continuePos = useMemo(() => {
    if (!continueFile) return 1;
    const saved = readJson<number>(posKey(continueFile.key), 1);
    return Math.min(Math.max(1, Math.floor(saved) || 1), continueFile.file.pages);
  }, [continueFile]);

  const recentEntries = useMemo(() => {
    const out: Array<{ file: LibFile; key: string }> = [];
    for (const key of recentKeys.slice(0, 8)) {
      const f = filesByKey.get(key);
      if (f) out.push({ file: f, key });
    }
    return out;
  }, [recentKeys, filesByKey]);

  const bentoItems = useMemo(
    () =>
      SUBJECTS.map(s => {
        const Art = ART[s.id] ?? ArtEm2;
        const color = v2SubjectColor(s.id);
        return {
          id: s.id,
          onClick: () => onGoSubject(s.id),
          content: (
            <div className="kiA-subj-card" style={{ '--subj': color } as CSSProperties}>
              <div className="kiA-subj-top">
                <span className="kiA-subj-num">{s.num}</span>
                <span className="kiA-subj-count">
                  {loaded ? <CountUp to={counts[s.id] ?? 0} duration={1.2} trigger="view" /> : '—'}
                  <span className="kiA-subj-count-suffix"> docs</span>
                </span>
              </div>
              <div className="kiA-subj-art"><Art /></div>
              <p className="kiA-subj-code">{s.code}</p>
              <h3 className="kiA-subj-title">{s.name}</h3>
              <p className="kiA-subj-desc">{s.tagline}</p>
            </div>
          )
        };
      }),
    [counts, loaded, onGoSubject]
  );

  const submitSearch = () => {
    const q = query.trim();
    if (q) onSubmitSearch(q);
  };

  return (
    <div className="kiA">
      {/* 1 — Editorial hero: 76px SplitText headline, CountUp archive stats */}
      <header className="kiA-hero">
        {!reduceMotion && (
          <div className="kiA-hero-aurora" aria-hidden="true">
            <Aurora
              colorStops={['#1b2a4a', '#2a1f4d', '#0e1424']}
              amplitude={1.0}
              blend={0.6}
              speed={0.25}
              opacity={0.35}
              layers={2}
              mouseInteraction={false}
              intro={true}
              paused={reduceMotion}
            />
          </div>
        )}
        <div className="kiA-hero-inner">
          <div className="kiA-hero-copy">
            <p className="kiA-eyebrow">K/IND LIBRARY</p>
            <SplitText
              text="Your knowledge, in one place."
              tag="h1"
              splitType="words"
              trigger="load"
              delay={70}
              duration={0.9}
              textAlign="left"
              className="kiA-headline"
            />
            <p className="kiA-hero-sub">Four disciplines. One connected archive.</p>
            <div className="kiA-stats" role="list" aria-label="Archive statistics">
              <div role="listitem"><Stat value={totalDocs} label="DOCUMENTS" loaded={loaded} /></div>
              <div role="listitem"><Stat value={totalPages} label="PAGES" loaded={loaded} /></div>
              <div role="listitem"><Stat value={SUBJECTS.length} label="DISCIPLINES" loaded={loaded} /></div>
              <div role="listitem"><Stat value={bookmarkCount} label="SAVED" loaded={loaded} /></div>
            </div>
            <form
              className="kiA-search"
              onSubmit={e => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <input
                className="kiA-search-input"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={loaded ? `Search ${totalDocs} documents…` : 'Search the archive…'}
                aria-label="Search the library"
              />
              <button type="submit" className="kiA-search-btn">
                Search
              </button>
            </form>
          </div>
          <div className="kiA-hero-art" aria-hidden="true">
            <KnowledgeMap />
          </div>
        </div>
      </header>

      {/* 2 — Continue studying: horizontal featured band, real doc + real progress */}
      <section className="kiA-section">
        <p className="kiA-eyebrow">CONTINUE STUDYING</p>
        <h2 className="kiA-section-title">Pick up where you left off</h2>
        {continueFile ? (
          <ContinueBand
            file={continueFile.file}
            page={continuePos}
            openedLabel={relTime(recentTs[continueFile.key] ?? null)}
            onOpen={() => onOpenReader(continueFile.key, [continueFile.key])}
          />
        ) : (
          <p className="kiA-empty">Nothing in progress yet — open any document and it will wait for you here.</p>
        )}
      </section>

      {/* 3 — Four disciplines: MagicBento 2×2 editorial cards */}
      <section className="kiA-section">
        <p className="kiA-eyebrow">YOUR FOUR DISCIPLINES</p>
        <h2 className="kiA-section-title">Browse the collection</h2>
        <MagicBento
          items={bentoItems}
          columns={2}
          rowHeight={300}
          gap={16}
          enableBorderGlow={true}
          enableSpotlight={true}
          enableStars={false}
          enableTilt={false}
          enableMagnetism={false}
          intro={false}
          className="kiA-bento"
        />
      </section>

      {/* 4 — Recently added: horizontal strip */}
      <section className="kiA-section">
        <p className="kiA-eyebrow">RECENTLY ADDED</p>
        <h2 className="kiA-section-title">Your recent shelf</h2>
        {recentEntries.length > 0 ? (
          <div className="kiA-strip" role="list">
            {recentEntries.map(({ file, key }) => (
              <RecentCard
                key={key}
                file={file}
                openedLabel={relTime(recentTs[key] ?? null)}
                onOpen={() => onOpenReader(key, [key])}
              />
            ))}
          </div>
        ) : (
          <p className="kiA-empty">Your recently opened documents will appear here.</p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ContinueBand({
  file,
  page,
  openedLabel,
  onOpen
}: {
  file: LibFile;
  page: number;
  openedLabel: string;
  onOpen: () => void;
}) {
  const pct = file.pages > 0 ? Math.round((page / file.pages) * 100) : 0;
  const subjColor = v2SubjectColor(file.subj);
  const subj = SUBJECTS.find(s => s.id === file.subj);
  return (
    <div className="kiA-feat" style={{ '--subj': subjColor } as CSSProperties}>
      <TiltedCard className="kiA-feat-tilt" tiltMaxAngleX={7} tiltMaxAngleY={7} scaleOnHover={1.03}>
        <img
          className="kiA-feat-cover"
          src={pageImageUrl(file.subj, file.file, 1, file.pages)}
          alt={`First page of ${file.title}`}
          loading="lazy"
        />
      </TiltedCard>
      <div className="kiA-feat-body">
        <p className="kiA-feat-kicker">
          <span className="kiA-dot" style={{ background: subjColor }} />
          {subj?.code ?? file.subj.toUpperCase()} · FEATURED
        </p>
        <h3 className="kiA-feat-title">{file.title}</h3>
        <p className="kiA-feat-meta">
          Page {page} of {file.pages} · {pct}% read · opened {openedLabel}
        </p>
        <div className="kiA-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="kiA-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <button type="button" className="kiA-feat-btn" onClick={onOpen}>
          Continue reading →
        </button>
      </div>
    </div>
  );
}

function RecentCard({
  file,
  openedLabel,
  onOpen
}: {
  file: LibFile;
  openedLabel: string;
  onOpen: () => void;
}) {
  const subjColor = v2SubjectColor(file.subj);
  return (
    <div role="listitem" className="kiA-strip-card">
      <button type="button" className="kiA-strip-btn" onClick={onOpen} aria-label={`Open ${file.title}`}>
        <span className="kiA-strip-cover">
          <img
            src={pageImageUrl(file.subj, file.file, 1, file.pages)}
            alt=""
            loading="lazy"
          />
          <span className="kiA-strip-accent" style={{ background: subjColor }} aria-hidden="true" />
        </span>
        <span className="kiA-strip-text">
          <span className="kiA-strip-title">{file.title}</span>
          <span className="kiA-strip-meta">
            <span className="kiA-dot" style={{ background: subjColor }} />
            opened {openedLabel}
          </span>
        </span>
      </button>
    </div>
  );
}
