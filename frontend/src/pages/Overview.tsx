import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import SpotlightCard from '../bits/SpotlightCard';
import CountUp from '../bits/CountUp';
import SpecularButton from '../bits/SpecularButton';
import Aurora from '../bits/Aurora';
import MagnetLines from '../bits/MagnetLines';
import SplitText from '../components/SplitText';
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

const ROMAN = ['I', 'II', 'III', 'IV'];

/* ------------------------------------------------------------------ */
/* Atlas map plate: graticule frame, compass rose, four discipline      */
/* nodes in subject colors. Particles drift behind (clipped canvas).   */
/* ------------------------------------------------------------------ */

function AtlasMap({
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
    cx: [108, 332, 118, 322][i],
    cy: [84, 96, 252, 244][i],
  }));
  const links: Array<[number, number]> = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  const total = nodes.reduce((a, n) => a + n.count, 0);
  return (
    <div className="kiA-mapframe">
      {/* Magnet Lines — refined magnetic field around the four-discipline
          viz (spec: very thin lines, restrained interaction, cyan
          highlights, low contrast, no rainbow). */}
      {!reducedMotion && (
        <div className="kiA-map-magnet" aria-hidden="true">
          <MagnetLines
            spacing={26}
            lineColor="rgba(166, 178, 194, 0.28)"
            accentColor="#59E4D2"
            lineWidth={1}
            lineHeight={15}
            mode="attract"
            shape="line"
            radius={90}
            fade={0.55}
            edgeFade={0.35}
            stretch={1}
            reach={0.6}
            scatter={0.2}
            inertia={0.85}
            clickPulse={false}
            intro={false}
            idle={false}
          />
        </div>
      )}
      <div className="kiA-map-head">
        <span>DISCIPLINE MAP</span>
        <span><strong>04 ACTIVE</strong> · {total} DOCUMENTS</span>
      </div>
      <svg className="kiA-atlasmap" viewBox="0 0 440 340" role="img" aria-label="Atlas of the four disciplines">
        <defs>
          <pattern id="kiA-grat" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 H 0 V 24" fill="none" stroke="rgba(216,209,194,0.10)" strokeWidth="1" />
          </pattern>
          {nodes.map(n => (
            <radialGradient key={`halo-${n.id}`} id={`kiA-ahalo-${n.id}`}>
              <stop offset="0%" stopColor={n.color} stopOpacity="0.5" />
              <stop offset="55%" stopColor={n.color} stopOpacity="0.14" />
              <stop offset="100%" stopColor={n.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        <rect x={10} y={10} width={420} height={320} fill="url(#kiA-grat)" />
        <rect x={10} y={10} width={420} height={320} fill="none" stroke="rgba(216,209,194,0.35)" strokeWidth="1.2" />
        {/* compass rose */}
        <g className="kiA-compass" transform="translate(392,52)" aria-hidden="true">
          <circle r={20} fill="none" stroke="rgba(216,209,194,0.4)" strokeWidth="1" />
          <circle r={14} fill="none" stroke="rgba(216,209,194,0.22)" strokeWidth="1" />
          <path d="M 0 -19 L 4 0 L 0 19 L -4 0 Z" fill="rgba(216,209,194,0.75)" />
          <path d="M -19 0 L 0 -4 L 19 0 L 0 4 Z" fill="rgba(216,209,194,0.4)" />
          <text y={-26} textAnchor="middle" className="kiA-compass-n">N</text>
        </g>
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].cx} y1={nodes[a].cy}
            x2={nodes[b].cx} y2={nodes[b].cy}
            stroke="rgba(216,209,194,0.20)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        ))}
        {nodes.map(n => (
          <g
            key={n.id}
            className="kiA-anode"
            role="button"
            tabIndex={0}
            aria-label={`${n.name} — ${n.count} documents`}
            onClick={() => onGoSubject(n.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoSubject(n.id); } }}
          >
            <circle cx={n.cx} cy={n.cy} r={36} fill={`url(#kiA-ahalo-${n.id})`} />
            <circle cx={n.cx} cy={n.cy} r={12} fill="none" stroke={n.color} strokeWidth="1.4" />
            <circle cx={n.cx} cy={n.cy} r={12} fill="none" stroke={n.color} strokeWidth="1" opacity={0.35}
              transform={`rotate(0 ${n.cx} ${n.cy})`} className={reducedMotion ? undefined : 'kiA-anode-spin'}
              style={{ transformOrigin: `${n.cx}px ${n.cy}px` }} />
            <circle cx={n.cx} cy={n.cy} r={5} fill={n.color} />
            <text x={n.cx} y={n.cy + 34} textAnchor="middle" className="kiA-anode-label">
              {n.code}
            </text>
            <text x={n.cx} y={n.cy + 48} textAnchor="middle" className="kiA-anode-count" style={{ fill: n.color }}>
              {n.count} DOCS
            </text>
          </g>
        ))}
        <text x={22} y={324} className="kiA-map-caption">04 DISCIPLINES</text>
        <text x={418} y={324} textAnchor="end" className="kiA-map-caption">
          {total} DOCUMENTS
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview page — THE GRAND ARCHIVE (ATLAS edition, 2026-11-05)       */
/* ------------------------------------------------------------------ */

function Stat({ value, label, loaded }: { value: number; label: string; loaded: boolean }) {
  return (
    <div className="kiA-stat" role="listitem">
      <span className="kiA-stat-num">
        {loaded
          ? <CountUp to={value} duration={0.9} trigger="load" separator="," className="kiA-stat-count" />
          : '—'}
      </span>
      <span className="kiA-stat-label">{label}</span>
    </div>
  );
}

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
  const subjectPages = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of files) m[f.subj] = (m[f.subj] ?? 0) + (f.pages || 0);
    return m;
  }, [files]);
  const loaded = files.length > 0;

  const filesByKey = useMemo(() => {
    const m = new Map<string, LibFile>();
    for (const f of files) m.set(f.key, f);
    return m;
  }, [files]);

  const recentKeys = useMemo(() => readJson<string[]>('kl:recent', []), []);
  const recentTs = useMemo(() => readJson<Record<string, number>>('kl:recentTs', {}), []);
  const bookmarkKeys = useMemo(() => readJson<string[]>('kl:bookmarks', []), []);
  const bookmarkCount = bookmarkKeys.length;

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
      {/* 1 — Hero: "Knowledge, connected." (OBSIDIAN ATLAS, 2026-11-05) */}
      <header className="kiA-hero">
        {/* Aurora — restrained flowing light inside the hero only:
            cyan + muted blue + deep indigo, speed 0.2, opacity 0.22, 2 layers */}
        {!reduceMotion && (
          <div className="kiA-hero-aurora" aria-hidden="true">
            <Aurora
              colorStops={['#59E4D2', '#4A7FBF', '#1B2B4A']}
              amplitude={1}
              blend={0.5}
              speed={0.2}
              height={0.5}
              layers={2}
              opacity={0.18}
              mouseInteraction={false}
              intro={false}
            />
          </div>
        )}
        <div className="kiA-hero-copy">
          <p className="kiA-eyebrow">K/IND / THE KNOWLEDGE INSTRUMENT</p>
          <p className="kiA-eyebrow">REGISTRY NO. 001 · YOUR PERSONAL STUDY ARCHIVE</p>
          <h1 className="kiA-display kiA-hero-title">
            <SplitText
              lines={[
                { text: 'Knowledge,' },
                { text: 'connected.', italic: true },
              ]}
            />
          </h1>
          <p className="kiA-hero-sub">
            Four disciplines. One connected archive. Every page within reach.
          </p>
          <div className="kiA-hero-cta">
            <SpecularButton
              size="lg"
              className="kiA-cta"
              onClick={() => onGoSubject('all')}
              baseColor="#1a2b45"
              lineColor="#59e4d2"
              textColor="#f1eee6"
              glow={0.8}
            >
              Explore the archive&nbsp;&nbsp;→
            </SpecularButton>
            <button type="button" className="kiA-cta-ghost" onClick={onGoSearch}>
              Search the archive
            </button>
          </div>
        </div>
        <div className="kiA-hero-map">
          <AtlasMap counts={counts} onGoSubject={onGoSubject} reducedMotion={reduceMotion} />
        </div>
      </header>

      {/* Statistics strip — real backend counts, 38px serif numerals */}
      <div className="kiA-stats" role="list" aria-label="Archive statistics">
        <Stat value={totalDocs} label="DOCUMENTS" loaded={loaded} />
        <Stat value={totalPages} label="PAGES" loaded={loaded} />
        <Stat value={SUBJECTS.length} label="DISCIPLINES" loaded={loaded} />
        <Stat value={bookmarkCount} label="SAVED" loaded={loaded} />
      </div>

      {/* Resume reading — intentional empty state, never a dashed box */}
      <section className="kiA-section">
        <p className="kiA-eyebrow">Continue where you left off</p>
        <h2 className="kiA-display kiA-section-title">Resume your reading.</h2>
        <div className="kiA-continue">
          {continueFile ? (
            <StudyActivityCard
              file={continueFile.file}
              page={continuePos}
              openedDate={fmtDate(recentTs[continueFile.key] ?? null)}
              onOpen={() => onOpenReader(continueFile.key, [continueFile.key])}
            />
          ) : (
            <div className="kiA-resume-empty">
              <span className="kiA-resume-empty-art" aria-hidden="true">
                <svg width="76" height="76" viewBox="0 0 76 76" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M38 14 C 30 8, 16 8, 8 12 L 8 58 C 16 54, 30 54, 38 60 C 46 54, 60 54, 68 58 L 68 12 C 60 8, 46 8, 38 14 Z" />
                  <path d="M38 14 L 38 60" />
                  <path d="M16 20 C 22 18, 28 18, 33 20 M16 30 C 22 28, 28 28, 33 30 M16 40 C 22 38, 28 38, 33 40" opacity="0.7" />
                  <path d="M43 20 C 48 18, 54 18, 60 20 M43 30 C 48 28, 54 28, 60 30 M43 40 C 48 38, 54 38, 60 40" opacity="0.7" />
                </svg>
              </span>
              <span>
                <p className="kiA-resume-empty-title">Your next discovery starts here.</p>
                <p className="kiA-resume-empty-sub">
                  Open any document and it will appear here with your progress.
                </p>
                <button
                  type="button"
                  className="kiA-textbtn"
                  onClick={() => onGoSubject('all')}
                >
                  Explore the archive →
                </button>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2 — The four discipline plates */}
      <section className="kiA-section">
        <p className="kiA-eyebrow">Your four disciplines</p>
        <h2 className="kiA-display kiA-section-title">Choose your discipline.</h2>
        <div className="kiA-plates">
          {SUBJECTS.map((s, i) => {
            const color = v2SubjectColor(s.id);
            return (
              <SpotlightCard
                key={s.id}
                className="kiA-platecard"
                spotlightColor={color}
                intensity={0.2}
                softness={0.7}
                spotlightSize={240}
                borderGlow={0.45}
                proximity={130}
                flare={false}
                theme="dark"
                style={{ '--subj': color } as CSSProperties}
              >
                <button
                  type="button"
                  className="kiA-platecard-btn"
                  onClick={() => onGoSubject(s.id)}
                  aria-label={`Open ${s.name} — ${counts[s.id] ?? 0} documents`}
                >
                  <div className="kiA-platecard-top">
                    <span className="kiA-platecard-plate">PLATE {ROMAN[i]}</span>
                    <span className="kiA-platecard-num">{s.num}</span>
                  </div>
                  <h3 className="kiA-platecard-name">{s.name}</h3>
                  <p className="kiA-platecard-tag">{s.tagline}</p>
                  <div className="kiA-platecard-stats">
                    <span className="kiA-platecard-stat">
                      <span className="kiA-platecard-stat-num">
                        {loaded ? <CountUp to={counts[s.id] ?? 0} duration={0.9} trigger="view" /> : '—'}
                      </span>
                      <span className="kiA-platecard-stat-label">DOCUMENTS</span>
                    </span>
                    <span className="kiA-platecard-stat">
                      <span className="kiA-platecard-stat-num">
                        {loaded ? <CountUp to={subjectPages[s.id] ?? 0} duration={0.9} trigger="view" separator="," /> : '—'}
                      </span>
                      <span className="kiA-platecard-stat-label">PAGES</span>
                    </span>
                  </div>
                  <span className="kiA-platecard-cta">OPEN DISCIPLINE →</span>
                </button>
              </SpotlightCard>
            );
          })}
        </div>
      </section>

      {/* 3 — Quick access ledger */}
      {qaSections.length > 0 && (
        <section className="kiA-section">
          <p className="kiA-eyebrow">Quick access</p>
          <h2 className="kiA-display kiA-section-title">Pick up where you left off.</h2>
          <div className="kiA-qa">
            {qaSections.map(sec => (
              <div key={sec.id} className="kiA-plate kiA-qa-col">
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
      )}

      {/* 4 — Recent shelf */}
      <section className="kiA-section">
        <p className="kiA-eyebrow">Recently added</p>
        <h2 className="kiA-display kiA-section-title">Your recent shelf.</h2>
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

function StudyActivityCard({
  file,
  page,
  openedDate,
  onOpen
}: {
  file: LibFile;
  page: number;
  openedDate: string;
  onOpen: () => void;
}) {
  const pct = file.pages > 0 ? Math.round((page / file.pages) * 100) : 0;
  const subjColor = v2SubjectColor(file.subj);
  const subj = SUBJECTS.find(s => s.id === file.subj);
  return (
    <div className="kiA-plate kiA-activity" style={{ '--subj': subjColor } as CSSProperties}>
      <p className="kiA-activity-kicker">
        <span className="kiA-dot" style={{ background: subjColor }} />
        {subj?.code ?? file.subj.toUpperCase()} · LAST OPENED {openedDate.toUpperCase()}
      </p>
      <h3 className="kiA-activity-title">{file.title}</h3>
      <p className="kiA-activity-meta">
        Page {page} of {file.pages} · {pct}% read
      </p>
      <div className="kiA-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="kiA-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <SpecularButton
        size="md"
        className="kiA-activity-btn"
        onClick={onOpen}
        baseColor="#1a2b45"
        lineColor="#65d9d0"
        textColor="#f2ecdd"
        glow={0.7}
      >
        Resume&nbsp;&nbsp;→
      </SpecularButton>
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
