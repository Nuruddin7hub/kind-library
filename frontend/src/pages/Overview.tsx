import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import SpotlightCard from '../bits/SpotlightCard';
import CountUp from '../bits/CountUp';
import Aurora from '../bits/Aurora';
import Particles from '../bits/Particles';
import BlurText from '../bits/BlurText';
import Magnet from '../bits/Magnet';
import AnimatedContent from '../bits/AnimatedContent';
import {
  SUBJECTS,
  disciplineGlyph,
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
/* Discipline field (critique §4, 2026-11-06): the signature hero      */
/* object — a 420px field where React Bits Particles live (inside the  */
/* field ONLY, never site-wide). Hovering a node illuminates it and    */
/* shows its real count + discipline name; the matching plate below    */
/* lights up too (P1 hero interaction). Replaces the 2026-11-05       */
/* AtlasMap (Magnet Lines + SVG graticule).                           */
/* ------------------------------------------------------------------ */

const FIELD_NODES: Array<{ x: number; y: number }> = [
  { x: 27, y: 24 }, // EM2
  { x: 73, y: 27 }, // Signals
  { x: 30, y: 72 }, // FIS
  { x: 71, y: 70 }, // Digital
];

function DisciplineField({
  counts,
  onGoSubject,
  reducedMotion,
  hovered,
  onHover,
}: {
  counts: Record<string, number>;
  onGoSubject: (subj: string) => void;
  reducedMotion: boolean;
  hovered: string | null;
  onHover: (subj: string | null) => void;
}): ReactNode {
  const total = SUBJECTS.reduce((a, s) => a + (counts[s.id] ?? 0), 0);
  const hoveredSubject = hovered ? SUBJECTS.find(s => s.id === hovered) : null;
  return (
    <div className="kiA-field" role="group" aria-label="Discipline field — four disciplines" data-hover={hovered ?? ''}>
      {/* Connection lines: centre K/IND mark → each node. The hovered
          discipline's line illuminates (field-edition.css, via
          data-hover); the rest stay faint. */}
      <svg className="kiA-field-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {SUBJECTS.map((s, i) => (
          <line
            key={s.id}
            className={`fl-${s.id}`}
            x1="50" y1="50"
            x2={FIELD_NODES[i].x} y2={FIELD_NODES[i].y}
            vectorEffect="non-scaling-stroke"
            style={{ '--line': v2SubjectColor(s.id) } as CSSProperties}
          />
        ))}
      </svg>
      <div className="kiA-field-centre" aria-hidden="true"><span>K/IND</span></div>
      {/* Particles — spec §4 verbatim: 68 particles, discipline colors,
          connections, hover attract. Field only. */}
      {!reducedMotion && (
        <div className="kiA-field-particles" aria-hidden="true">
          <Particles
            particleCount={68}
            particleSpread={7}
            speed={0.08}
            particleColors={['#59ded3', '#8baaff', '#e6aa53', '#76d6a0']}
            /* DEVIATION from spec §4: spec says baseSize 2, but this
               component's scale is ~100 (registry default; camera 20) —
               baseSize 2 renders at ~1% alpha, i.e. invisible (verified
               by pixel-sampling the live canvas: 0 lit pixels). 60 keeps
               the dots restrained in a 420px field while actually
               visible. All other spec values verbatim. */
            particleBaseSize={60}
            sizeRandomness={0.7}
            shape="circle"
            glow={0.35}
            twinkle={0.15}
            depthOfField={0.2}
            connections
            connectionDistance={92}
            drift="none"
            moveParticlesOnHover
            hoverEffect="attract"
            particleHoverFactor={0.3}
            hoverRadius={110}
            clickBurst
            alphaParticles
            opacity={0.55}
          />
        </div>
      )}
      <div className="kiA-field-head">
        <span>DISCIPLINE FIELD</span>
        <span><strong>04 active</strong> · {total} documents</span>
      </div>
      {SUBJECTS.map((s, i) => {
        const color = v2SubjectColor(s.id);
        const pos = FIELD_NODES[i];
        return (
          <button
            key={s.id}
            type="button"
            className="kiA-field-node"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, '--node': color } as CSSProperties}
            onClick={() => onGoSubject(s.id)}
            onMouseEnter={() => onHover(s.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(s.id)}
            onBlur={() => onHover(null)}
            aria-label={`${s.name} — ${counts[s.id] ?? 0} documents`}
          >
            <span className="kiA-field-glyph" aria-hidden="true">{disciplineGlyph(s.id)}</span>
            <span className="kiA-field-code">{s.code}</span>
            <span className="kiA-field-count">{counts[s.id] ?? 0} docs</span>
          </button>
        );
      })}
      <div className="kiA-field-detail" aria-live="polite">
        {hoveredSubject ? (
          <span>
            <strong style={{ ['--node' as string]: v2SubjectColor(hoveredSubject.id) } as CSSProperties}>
              {hoveredSubject.code}
            </strong>
            {' — '}
            {counts[hoveredSubject.id] ?? 0} documents · {hoveredSubject.short}
          </span>
        ) : (
          <span>04 disciplines · {total} documents</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview page — THE GRAND ARCHIVE (ATLAS edition, 2026-11-05)       */
/* ------------------------------------------------------------------ */

function Stat({ value, label, loaded, pad2 }: { value: number; label: string; loaded: boolean; pad2?: boolean }) {
  return (
    <div className="kiA-stat" role="listitem">
      <span className="kiA-stat-num">
        {loaded
          ? <CountUp to={value} duration={0.9} trigger="load" separator="," prefix={pad2 && value < 10 ? '0' : ''} className="kiA-stat-count" />
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
  // P1 hero interaction: hovering a discipline node lights its plate.
  const [fieldHover, setFieldHover] = useState<string | null>(null);

  const counts = useMemo(() => getSubjectCounts(files), [files]);
  const totalDocs = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const totalPages = useMemo(() => files.reduce((s, f) => s + (f.pages || 0), 0), [files]);
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
      {/* 1 — Hero: "Knowledge, connected." (KNOWLEDGE INSTRUMENT, 2026-11-06) */}
      <header className="kiA-hero">
        {/* Aurora — spec §2 verbatim, behind the hero only (right 72%,
            520px): an illuminated archive chamber, not a landing page. */}
        {!reduceMotion && (
          <div className="kiA-hero-aurora" aria-hidden="true">
            <Aurora
              colorStops={['#0b2630', '#123f4b', '#071722']}
              amplitude={0.8}
              blend={0.72}
              speed={0.35}
              height={0.58}
              scale={1.15}
              glow={0.42}
              brightness={0.7}
              layers={2}
              mouseInteraction
              opacity={0.34}
              intro={false}
            />
          </div>
        )}
        <div className="kiA-hero-copy">
          <p className="kiA-eyebrow">YOUR PERSONAL KNOWLEDGE SYSTEM</p>
          {/* BlurText (React Bits, verified) — hero headline, focus-to-
              sharp reveal once on load; "connection." is italic + cyan
              via the last-word rule in field-edition.css */}
          <h1 className="kiA-display kiA-hero-title">
            <BlurText
              text="Your knowledge lives in connection."
              trigger="load"
              animateBy="words"
              delay={90}
              stepDuration={0.3}
              blur={10}
              distance={40}
              className="de-blurline"
            />
          </h1>
          <p className="kiA-hero-sub">
            Four disciplines. One connected archive. Every page within reach.
          </p>
          <div className="kiA-hero-cta">
            {/* Magnet on the primary CTA only, very slight */}
            <Magnet magnetStrength={0.6} maxOffset={6}>
              <button
                type="button"
                className="de-btn-primary"
                onClick={() => onGoSubject('all')}
              >
                Explore the archive&nbsp;&nbsp;→
              </button>
            </Magnet>
            <button type="button" className="de-btn-secondary" onClick={onGoSearch}>
              Search the archive
            </button>
          </div>
        </div>
        <div className="kiA-hero-field">
          <DisciplineField
            counts={counts}
            onGoSubject={onGoSubject}
            reducedMotion={reduceMotion}
            hovered={fieldHover}
            onHover={setFieldHover}
          />
        </div>
      </header>

      {/* Statistics strip — real backend counts, 42px data objects (§16),
          Count Up once on load only */}
      <AnimatedContent
        className="kiA-stats"
        trigger="mount"
        distance={24}
        duration={0.7}
        ease="power3.out"
        initialOpacity={0}
        threshold={0.1}
        once
      >
        <div role="list" aria-label="Archive statistics" style={{ display: 'contents' }}>
          <Stat value={totalDocs} label="DOCUMENTS" loaded={loaded} />
          <Stat value={totalPages} label="PAGES" loaded={loaded} />
          <Stat value={SUBJECTS.length} label="FIELDS" loaded={loaded} pad2 />
          <Stat value={bookmarkCount} label="SAVED" loaded={loaded} pad2 />
        </div>
      </AnimatedContent>

      {/* 2 — The four discipline plates */}
      <AnimatedContent
        trigger="mount"
        distance={24}
        duration={0.7}
        ease="power3.out"
        initialOpacity={0}
        threshold={0.1}
        once
      >
      <section className="kiA-section">
        <p className="kiA-eyebrow">Your disciplines</p>
        <h2 className="kiA-display kiA-section-title">Choose your discipline.</h2>
        {/* Staggered entrance: AnimatedContent staggers its direct
            children (the four SpotlightCards) on mount. */}
        <AnimatedContent
          className="kiA-plates"
          trigger="mount"
          distance={18}
          duration={0.6}
          ease="power3.out"
          initialOpacity={0}
          threshold={0.1}
          stagger={0.08}
          once
        >
          {SUBJECTS.map((s) => {
            const color = v2SubjectColor(s.id);
            return (
              <SpotlightCard
                key={s.id}
                className={`kiA-platecard${fieldHover === s.id ? ' kiA-platecard--lit' : ''}`}
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
                  <span className="kiA-platecard-glyph" aria-hidden="true">{disciplineGlyph(s.id)}</span>
                  <h3 className="kiA-platecard-name">{s.name}</h3>
                  <p className="kiA-platecard-tag">{s.tagline}</p>
                  <span className="kiA-platecard-foot">
                    <span className="kiA-platecard-count">
                      <strong>{loaded ? counts[s.id] ?? 0 : '—'}</strong> documents
                    </span>
                    <span className="kiA-platecard-arrow" aria-hidden="true">→</span>
                  </span>
                </button>
              </SpotlightCard>
            );
          })}
        </AnimatedContent>
      </section>
      </AnimatedContent>

      {/* Resume reading — intentional empty state, never a dashed box */}
      <AnimatedContent
        trigger="mount"
        distance={24}
        duration={0.7}
        ease="power3.out"
        initialOpacity={0}
        threshold={0.1}
        once
      >
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
      </AnimatedContent>

      {/* 3 — Quick access ledger */}
      {qaSections.length > 0 && (
      <AnimatedContent
        trigger="mount"
        distance={24}
        duration={0.7}
        ease="power3.out"
        initialOpacity={0}
        threshold={0.1}
        once
      >
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
      </AnimatedContent>
      )}

      {/* 4 — Recent shelf */}
      <AnimatedContent
        trigger="mount"
        distance={24}
        duration={0.7}
        ease="power3.out"
        initialOpacity={0}
        threshold={0.1}
        once
      >
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
      </AnimatedContent>
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
        {subj?.code ?? file.subj.toUpperCase()} · Last opened {openedDate}
      </p>
      <h3 className="kiA-activity-title">{file.title}</h3>
      <p className="kiA-activity-meta">
        Page {page} of {file.pages} · {pct}% read
      </p>
      <div className="kiA-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="kiA-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <button type="button" className="de-btn-primary" onClick={onOpen}>
        Resume&nbsp;&nbsp;→
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
