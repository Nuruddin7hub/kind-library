import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import MagicBento from '../bits/MagicBento';
import ShinyText from '../bits/ShinyText';
import CountUp from '../bits/CountUp';
import SplitText from '../bits/SplitText';
import AnimatedContent from '../bits/AnimatedContent';
import Particles from '../bits/Particles';
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
  onGoSearch: () => void;
}

/* ------------------------------------------------------------------ */
/* Original SVG artwork (designed for this page, not copied).
 * Colors track the v3.0 identity palette via v2SubjectColor.            */
/* ------------------------------------------------------------------ */

/** Constellation: four haloed subject nodes, connecting lines, and small
 * moving particles travelling along the connections. React Bits Particles
 * sits behind as the atmospheric background; this SVG is the 4-node data
 * overlay. Hover a node → highlight + doc count; click → subject library. */
function KnowledgeMap({
  counts,
  onGoSubject,
  reducedMotion,
}: {
  counts: Record<string, number>;
  onGoSubject: (subj: string) => void;
  reducedMotion: boolean;
}): ReactNode {
  const nodes = SUBJECTS.map((s, i) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    color: v2SubjectColor(s.id),
    count: counts[s.id] ?? 0,
    // 440 x 340 frame
    cx: [110, 330, 120, 320][i],
    cy: [80, 92, 250, 242][i],
  }));
  const links: Array<[number, number]> = [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]
  ];
  return (
    <div className="kiA-constellation">
      {!reducedMotion && (
        <Particles
          className="kiA-constellation-particles"
          particleCount={90}
          particleSpread={9}
          speed={0.06}
          particleColors={[...nodes.map(n => n.color), '#DCE8F4']}
          moveParticlesOnHover={false}
          particleHoverFactor={0}
          particleBaseSize={70}
          sizeRandomness={0.9}
          cameraDistance={22}
          disableRotation={false}
          glow={0.6}
          twinkle={0.45}
          connections={false}
          clickBurst={false}
          intro={false}
          opacity={0.55}
          paused={reducedMotion}
        />
      )}
      <svg className="kiA-kmap" viewBox="0 0 440 340" role="img" aria-label="Map of the four disciplines">
        <defs>
          <pattern id="kiA-cgrid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 H 0 V 22" fill="none" className="kiA-cgrid-line" strokeWidth="1" />
          </pattern>
          {nodes.map(n => (
            <radialGradient key={`halo-${n.id}`} id={`kiA-halo-${n.id}`}>
              <stop offset="0%" stopColor={n.color} stopOpacity="0.55" />
              <stop offset="55%" stopColor={n.color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={n.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        <rect x={8} y={8} width={424} height={324} fill="url(#kiA-cgrid)" />
        {links.map(([a, b], i) => (
          <g key={i}>
            <line
              x1={nodes[a].cx} y1={nodes[a].cy}
              x2={nodes[b].cx} y2={nodes[b].cy}
              className="kiA-kmap-link"
            />
            {!reducedMotion && (
              <circle r={2.4} fill={nodes[a].color} className="kiA-kmap-mote" style={{ color: nodes[a].color }} opacity={0.9}>
                <animateMotion
                  dur={`${3.6 + (i % 3) * 1.4}s`}
                  begin={`${(i * 0.7) % 3}s`}
                  repeatCount="indefinite"
                  path={`M ${nodes[a].cx} ${nodes[a].cy} L ${nodes[b].cx} ${nodes[b].cy}`}
                />
              </circle>
            )}
          </g>
        ))}
        {nodes.map(n => (
          <g
            key={n.id}
            className="kiA-cnode"
            role="button"
            tabIndex={0}
            aria-label={`${n.name} — ${n.count} documents`}
            onClick={() => onGoSubject(n.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoSubject(n.id); } }}
          >
            <circle cx={n.cx} cy={n.cy} r={34} fill={`url(#kiA-halo-${n.id})`} className="kiA-cnode-halo" />
            {!reducedMotion && (
              <circle cx={n.cx} cy={n.cy} r={13} className="kiA-kmap-ring" style={{ color: n.color }} />
            )}
            <circle cx={n.cx} cy={n.cy} r={9} fill={n.color} className="kiA-kmap-node" />
            <circle cx={n.cx} cy={n.cy} r={3.4} fill="#07090E" />
            <text x={n.cx} y={n.cy + 32} textAnchor="middle" className="kiA-kmap-label">
              {n.code}
            </text>
            <g className="kiA-ctip" aria-hidden="true">
              <rect x={n.cx - 72} y={n.cy - 64} width={144} height={40} rx={8} className="kiA-ctip-box" />
              <text x={n.cx} y={n.cy - 47} textAnchor="middle" className="kiA-ctip-title">{n.name}</text>
              <text x={n.cx} y={n.cy - 32} textAnchor="middle" className="kiA-ctip-count" style={{ fill: n.color }}>
                {n.count} DOCUMENTS
              </text>
            </g>
          </g>
        ))}
        <text x={16} y={330} className="kiA-kmap-caption">04 DISCIPLINES</text>
        <text x={424} y={330} textAnchor="end" className="kiA-kmap-caption">
          {nodes.reduce((a, n) => a + n.count, 0)} DOCUMENTS
        </text>
      </svg>
    </div>
  );
}

/** EM2 artwork: parabola over a faint coordinate grid. */
function ArtEm2({ color }: { color: string }): ReactNode {
  const grid: ReactNode[] = [];
  for (let i = 1; i < 7; i++) {
    grid.push(<line key={`v${i}`} x1={i * 30} y1={0} x2={i * 30} y2={120} className="kiA-art-faint" />);
    grid.push(<line key={`h${i}`} x1={0} y1={i * 20} x2={210} y2={i * 20} className="kiA-art-faint" />);
  }
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      {grid}
      <path d="M 10 108 Q 70 108 105 40 T 200 20" fill="none" stroke={color} strokeWidth="2.5" />
      <path d="M 10 100 Q 80 100 120 60 T 200 44" fill="none" stroke={color} strokeWidth="1.5" className="kiA-art-dim" />
      <circle cx={105} cy={40} r={3.5} fill={color} />
      <circle cx={120} cy={60} r={2.5} fill={color} className="kiA-art-dim" />
    </svg>
  );
}

/** Signals artwork: sine wave over FFT bars. */
function ArtSignals({ color }: { color: string }): ReactNode {
  const bars = [14, 34, 52, 70, 88, 64, 44, 28, 58, 78, 50, 30];
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      {bars.map((h, i) => (
        <rect key={i} x={8 + i * 16.5} y={110 - h} width={10} height={h} rx={2}
          fill={color} className="kiA-art-dim" opacity={0.25 + (h / 90) * 0.5} />
      ))}
      <path d="M 8 60 C 40 10, 70 10, 100 60 S 160 110, 202 60" fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

/** FIS artwork: serif philosophical typography. */
function ArtFis({ color }: { color: string }): ReactNode {
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      <text x={16} y={96} className="kiA-art-serif" fill={color} fontSize={92}>?</text>
      <text x={86} y={44} className="kiA-art-serif" fill={color} fontSize={26} opacity={0.9}>λόγος</text>
      <line x1={88} y1={60} x2={196} y2={60} stroke={color} strokeWidth={1} className="kiA-art-dim" />
      <text x={88} y={86} className="kiA-art-serif" fill={color} fontSize={17} opacity={0.55}>cogito</text>
      <text x={88} y={106} className="kiA-art-serif" fill={color} fontSize={17} opacity={0.35}>ergo sum</text>
    </svg>
  );
}

/** Digital artwork: circuit traces with nodes. */
function ArtDigital({ color }: { color: string }): ReactNode {
  return (
    <svg viewBox="0 0 210 120" className="kiA-art" aria-hidden="true">
      <path d="M 14 100 L 60 100 L 78 82 L 130 82 L 148 64 L 196 64" fill="none" stroke={color} strokeWidth={2} />
      <path d="M 14 34 L 46 34 L 64 52 L 120 52" fill="none" stroke={color} strokeWidth={1.5} className="kiA-art-dim" />
      <path d="M 150 104 L 150 84 L 178 84" fill="none" stroke={color} strokeWidth={1.5} className="kiA-art-dim" />
      {[
        [14, 100], [78, 82], [130, 82], [196, 64],
        [14, 34], [64, 52], [120, 52], [150, 104], [178, 84]
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={5} fill="none" stroke={color} strokeWidth={2} />
          <circle cx={x} cy={y} r={1.8} fill={color} />
        </g>
      ))}
    </svg>
  );
}

const ART: Record<string, (p: { color: string }) => ReactNode> = {
  em2: ArtEm2,
  signals: ArtSignals,
  fis: ArtFis,
  digital: ArtDigital
};

/* ------------------------------------------------------------------ */
/* Overview page — Obsidian Atlas (ChatGPT Round A 2026-11-04 ~14:20)   */
/* ------------------------------------------------------------------ */

/** Archive stat — CountUp from real data, once per load; "—" while loading. */
function Stat({ value, label, loaded }: { value: number; label: string; loaded: boolean }) {
  return (
    <div className="kiA-stat">
      <span className="kiA-stat-num">
        {loaded
          ? <CountUp to={value} duration={0.9} trigger="load" separator="," className="kiA-stat-count" />
          : '—'}
      </span>
      <span className="kiA-stat-label">{label}</span>
    </div>
  );
}

/** "opened 4 Nov" style date for the activity card. */
function fmtDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Overview({ files, onOpenReader, onGoSubject, onGoSearch }: OverviewProps) {
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
  const bookmarkKeys = useMemo(() => readJson<string[]>('kl:bookmarks', []), []);
  const bookmarkCount = bookmarkKeys.length;

  // Recent notes — real kl:notes:* entries, latest first.
  const recentNotes = useMemo(() => {
    const out: Array<{ file: LibFile; page: number; ts: number }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('kl:notes:')) continue;
        const fileKey = k.slice('kl:notes:'.length);
        const f = filesByKey.get(fileKey);
        if (!f) continue;
        const notes = JSON.parse(localStorage.getItem(k) || '[]');
        if (!Array.isArray(notes) || notes.length === 0) continue;
        const latest = notes.reduce((a: { ts: number }, b: { ts: number }) =>
          (b?.ts || 0) > (a?.ts || 0) ? b : a, notes[0]);
        out.push({ file: f, page: latest?.page ?? 1, ts: latest?.ts ?? 0 });
      }
    } catch { /* storage unavailable */ }
    return out.sort((a, b) => b.ts - a.ts).slice(0, 3);
  }, [filesByKey]);

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

  const savedEntries = useMemo(() => {
    const out: Array<{ file: LibFile; key: string }> = [];
    for (const key of [...bookmarkKeys].reverse().slice(0, 3)) {
      const f = filesByKey.get(key);
      if (f) out.push({ file: f, key });
    }
    return out;
  }, [bookmarkKeys, filesByKey]);

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
                  {loaded ? <CountUp to={counts[s.id] ?? 0} duration={0.9} trigger="view" /> : '—'}
                  <span className="kiA-subj-count-suffix"> docs</span>
                </span>
              </div>
              <div className="kiA-subj-art"><Art color={color} /></div>
              <p className="kiA-subj-code">{s.code}</p>
              <h3 className="kiA-subj-title">{s.name}</h3>
              <p className="kiA-subj-desc">{s.tagline}</p>
              <span className="kiA-subj-cta" aria-hidden="true">Open discipline →</span>
            </div>
          )
        };
      }),
    [counts, loaded, onGoSubject]
  );

  const qaSections = [
    {
      id: 'recent',
      label: 'Recently opened',
      items: recentEntries.slice(0, 3).map(({ file, key }) => ({
        key, title: file.title, subj: file.subj,
        meta: `opened ${relTime(recentTs[key] ?? null)}`,
      })),
    },
    {
      id: 'saved',
      label: 'Recent bookmarks',
      items: savedEntries.map(({ file, key }) => ({
        key, title: file.title, subj: file.subj,
        meta: file.pages ? `${file.pages} pages` : 'saved',
      })),
    },
    {
      id: 'notes',
      label: 'Recent notes',
      items: recentNotes.map(({ file, page, ts }) => ({
        key: file.key, title: file.title, subj: file.subj,
        meta: `p.${page} · ${fmtDate(ts)}`,
      })),
    },
  ].filter(sec => sec.items.length > 0);

  return (
    <div className="kiA">
      {/* 1 — Hero: Aurora (global backdrop, masked top) + Split Text headline */}
      <AnimatedContent
        className="kiA-hero-anim"
        trigger="mount"
        distance={18}
        duration={0.7}
        once
      >
        <header className="kiA-hero kiA-controlroom">
          <div className="kiA-hero-inner">
            <div className="kiA-hero-copy">
              <p className="kiA-eyebrow">
                <ShinyText
                  text="K/IND LIBRARY"
                  color="#6B7585"
                  shineColor="#EDEAE0"
                  speed={7}
                  delay={2.5}
                  trigger="loop"
                  glow={0}
                  disabled={reduceMotion}
                />
              </p>
              {!reduceMotion ? (
                <SplitText
                  text="Your knowledge, without boundaries."
                  className="kiA-headline"
                  splitType="words"
                  effect="fade"
                  delay={140}
                  duration={0.9}
                  trigger="load"
                  tag="h1"
                />
              ) : (
                <h1 className="kiA-headline">Your knowledge, without boundaries.</h1>
              )}
              <p className="kiA-hero-sub">Four disciplines. One connected archive.</p>
              <div className="kiA-stats" role="list" aria-label="Archive statistics">
                <div role="listitem"><Stat value={totalDocs} label="DOCS" loaded={loaded} /></div>
                <div role="listitem"><Stat value={totalPages} label="PAGES" loaded={loaded} /></div>
                <div role="listitem"><Stat value={SUBJECTS.length} label="SUBJECTS" loaded={loaded} /></div>
                <div role="listitem"><Stat value={bookmarkCount} label="SAVED" loaded={loaded} /></div>
              </div>
              <button type="button" className="kiA-specular" onClick={onGoSearch}>
                <span>Search the archive</span>
                <span className="kiA-specular-arrow" aria-hidden="true">→</span>
              </button>
              <hr className="kiA-hero-divider" />
              <div className="kiA-continue">
                <p className="kiA-eyebrow">Study activity</p>
                {continueFile ? (
                  <StudyActivityCard
                    file={continueFile.file}
                    page={continuePos}
                    openedLabel={relTime(recentTs[continueFile.key] ?? null)}
                    openedDate={fmtDate(recentTs[continueFile.key] ?? null)}
                    onOpen={() => onOpenReader(continueFile.key, [continueFile.key])}
                  />
                ) : (
                  <div className="kiA-qa-empty-compact">
                    <p className="kiA-qa-empty-compact-title">No study history yet.</p>
                    <p className="kiA-qa-empty-compact-sub">
                      Open any document and it will appear here with your progress.
                    </p>
                    <button
                      type="button"
                      className="kiA-specular kiA-specular--ghost kiA-specular--sm"
                      onClick={() => onGoSubject('all')}
                    >
                      <span>Explore the archive</span>
                      <span className="kiA-specular-arrow" aria-hidden="true">→</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="kiA-hero-art">
              <div className="kiA-netframe">
                <KnowledgeMap counts={counts} onGoSubject={onGoSubject} reducedMotion={reduceMotion} />
                <div className="kiA-net-glow" />
              </div>
            </div>
          </div>
        </header>
      </AnimatedContent>

      {/* 2 — Four disciplines: large interactive tiles */}
      <AnimatedContent
        className="kiA-section-anim"
        trigger="scroll"
        distance={28}
        duration={0.7}
        once
      >
        <section className="kiA-section">
          <p className="kiA-eyebrow">Your four disciplines</p>
          <h2 className="kiA-section-title">Browse the collection</h2>
          <MagicBento
            items={bentoItems}
            columns={2}
            rowHeight={340}
            gap={18}
            glowColor="35,125,160"
            spotlightRadius={260}
            enableBorderGlow={true}
            enableSpotlight={true}
            enableStars={false}
            enableTilt={false}
            enableMagnetism={false}
            intro={false}
            className="kiA-bento"
          />
        </section>
      </AnimatedContent>

      {/* 3 — Quick access: real data only, sections with none are hidden */}
      {qaSections.length > 0 && (
        <AnimatedContent
          className="kiA-section-anim"
          trigger="scroll"
          distance={28}
          duration={0.7}
          once
        >
          <section className="kiA-section">
            <p className="kiA-eyebrow">Quick access</p>
            <h2 className="kiA-section-title">Pick up where you left off</h2>
            <div className="kiA-qa">
              {qaSections.map(sec => (
                <div key={sec.id} className="kiA-surface kiA-qa-col">
                  <p className="kiA-qa-label">{sec.label}</p>
                  <ul className="kiA-qa-list">
                    {sec.items.map(it => {
                      const c = v2SubjectColor(it.subj);
                      return (
                        <li key={it.key}>
                          <button
                            type="button"
                            className="kiA-qa-row"
                            onClick={() => onOpenReader(it.key, [it.key])}
                          >
                            <span className="kiA-dot" style={{ background: c }} aria-hidden="true" />
                            <span className="kiA-qa-row-text">
                              <span className="kiA-qa-row-title">{it.title}</span>
                              <span className="kiA-qa-row-meta">{it.meta}</span>
                            </span>
                            <span className="kiA-qa-row-arrow" aria-hidden="true">→</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </AnimatedContent>
      )}

      {/* 4 — Recently added: horizontal strip */}
      <AnimatedContent
        className="kiA-section-anim"
        trigger="scroll"
        distance={28}
        duration={0.7}
        once
      >
        <section className="kiA-section">
          <p className="kiA-eyebrow">Recently added</p>
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
      </AnimatedContent>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Study activity card: last opened doc + subject + last page + progress +
 * last-accessed date + Resume. Real kl:* history only. */
function StudyActivityCard({
  file,
  page,
  openedLabel,
  openedDate,
  onOpen
}: {
  file: LibFile;
  page: number;
  openedLabel: string;
  openedDate: string;
  onOpen: () => void;
}) {
  const pct = file.pages > 0 ? Math.round((page / file.pages) * 100) : 0;
  const subjColor = v2SubjectColor(file.subj);
  const subj = SUBJECTS.find(s => s.id === file.subj);
  return (
    <div className="kiA-surface kiA-activity" style={{ '--subj': subjColor } as CSSProperties}>
      <p className="kiA-activity-kicker">
        <span className="kiA-dot" style={{ background: subjColor }} />
        {subj?.code ?? file.subj.toUpperCase()} · LAST OPENED {openedDate.toUpperCase()}
      </p>
      <h3 className="kiA-activity-title">{file.title}</h3>
      <p className="kiA-activity-meta">
        Page {page} of {file.pages} · {pct}% read · opened {openedLabel}
      </p>
      <div className="kiA-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="kiA-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <button type="button" className="kiA-specular kiA-activity-btn" onClick={onOpen}>
        <span>Resume</span>
        <span className="kiA-specular-arrow" aria-hidden="true">→</span>
      </button>
    </div>
  );
}

function RecentCard({
  file,
  openedLabel,
  onOpen
}: {
  file: LibFile;
  page?: number;
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
