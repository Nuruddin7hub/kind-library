import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import CountUp from '../bits/CountUp';
import Particles from '../bits/Particles';
import BlurText from '../bits/BlurText';
import StarBorder from '../bits/StarBorder';
import AnimatedContent from '../bits/AnimatedContent';
import SpotlightCard from '../bits/SpotlightCard';
import GlareHover from '../bits/GlareHover';
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

/* Orbital discipline network (critiqueA 2026-11-07 P2): Σ EM2 top,
 * ◉ KIND centre, Φ FIS / ∿ SIGNALS sides, ⌘ DIGITAL bottom, with
 * orbital traces + centre spokes + a selective Particles field.
 * Nodes sit on/near the outer orbit (top 50,20 · sides 10/90,50 ·
 * bottom 50,74, clear of the head/detail lines). */
const FIELD_NODES: Array<{ x: number; y: number }> = [
  { x: 50, y: 20 }, // EM2 — top
  { x: 90, y: 50 }, // Signals — right
  { x: 10, y: 50 }, // FIS — left
  { x: 50, y: 74 }, // Digital — bottom
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
      {/* Orbital traces: four ellipses around the centre KIND mark.
          Nodes sit on/near the outer trace. The fourth (outermost)
          ring is the Round F addition — a subtler outer orbit
          (opacity .6 over the .16 trace stroke, so ~.10 effective);
          no new nodes or labels. */}
      <svg className="kiA-field-orbits" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="50" cy="50" rx="40" ry="30" />
        <ellipse cx="50" cy="50" rx="30" ry="20" transform="rotate(35 50 50)" />
        <ellipse cx="50" cy="50" rx="20" ry="12" transform="rotate(-30 50 50)" />
        <ellipse cx="50" cy="50" rx="46" ry="35" opacity="0.6" />
      </svg>
      {/* Connection lines: centre KIND mark → each node. The hovered
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
      <div className="kiA-field-centre" aria-hidden="true"><span>◉ KIND</span></div>
      {/* Particles — critiqueA 2026-11-07 §1 verbatim, except
          particleBaseSize: spec 48 renders near-invisible in this
          WebGL impl (same finding as every prior loop: baseSize 2
          and 48 both leave ~0 lit pixels when sampled). 60 is the
          proven working value. clickBurst off; drift forward. */}
      {!reducedMotion && (
        <div className="kiA-field-particles" aria-hidden="true">
          <Particles
            particleCount={65}
            particleSpread={9}
            speed={0.035}
            particleColors={['#59ded3', '#8baaff', '#e6aa53', '#76d6a0']}
            particleBaseSize={60}
            sizeRandomness={0.8}
            shape="circle"
            glow={0.35}
            twinkle={0.15}
            depthOfField={0.35}
            connections
            connectionDistance={125}
            drift="forward"
            driftSpeed={0.12}
            moveParticlesOnHover
            hoverEffect="attract"
            particleHoverFactor={0.35}
            hoverRadius={180}
            clickBurst={false}
            alphaParticles
            opacity={0.2}
          />
        </div>
      )}
      <div className="kiA-field-head">
        <span>DISCIPLINE FIELD</span>
        {/* ROUND C 2026-11-08: "docs" (not "documents") — at the new
            75/25 hero ratio the field column is ~266px wide and the
            full word wraps onto the EM2 node glyph; the nodes already
            say "docs". Counts stay real. */}
        <span><strong>04 active</strong> · {total} docs</span>
      </div>
      {SUBJECTS.map((s, i) => {
        const color = v2SubjectColor(s.id);
        const pos = FIELD_NODES[i];
        return (
          <button
            key={s.id}
            type="button"
            className="kiA-field-node"
            data-subj={s.id}
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

/* Per-subject card visuals (critiqueA 2026-11-07 P2): each discipline
 * its own tiny behaviour — EM2 contour lines, Signals waveform, FIS
 * orbit network, Digital binary grid. Pure SVG, subject-coloured. */
function DisciplineVisual({ id }: { id: string }) {
  if (id === 'em2') {
    return (
      <svg viewBox="0 0 120 56" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
        <ellipse cx="60" cy="28" rx="54" ry="24" opacity="0.9" />
        <ellipse cx="62" cy="28" rx="40" ry="17" opacity="0.65" />
        <ellipse cx="58" cy="28" rx="26" ry="11" opacity="0.45" />
        <ellipse cx="60" cy="28" rx="12" ry="5" opacity="0.3" />
      </svg>
    );
  }
  if (id === 'signals') {
    return (
      <svg viewBox="0 0 120 56" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M0 28 Q 15 6, 30 28 T 60 28 T 90 28 T 120 28" />
        <path d="M0 40 Q 15 22, 30 40 T 60 40 T 90 40 T 120 40" opacity="0.55" strokeWidth="1" />
        <path d="M0 16 Q 15 -4, 30 16 T 60 16 T 90 16 T 120 16" opacity="0.55" strokeWidth="1" />
      </svg>
    );
  }
  if (id === 'fis') {
    return (
      <svg viewBox="0 0 120 56" fill="none" stroke="currentColor" aria-hidden="true">
        <ellipse cx="60" cy="28" rx="52" ry="20" strokeWidth="1" opacity="0.9" />
        <ellipse cx="60" cy="28" rx="34" ry="13" strokeWidth="1" opacity="0.6" transform="rotate(28 60 28)" />
        <circle cx="60" cy="28" r="3" fill="currentColor" stroke="none" />
        <circle cx="98" cy="18" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="28" cy="40" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="76" cy="44" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 56" fill="currentColor" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        return (
          <circle
            key={i}
            cx={14 + col * 23}
            cy={10 + row * 12}
            r={i % 4 === 0 ? 2.4 : 1.5}
            opacity={i % 3 === 0 ? 0.9 : 0.45}
          />
        );
      })}
      <g stroke="currentColor" strokeWidth="1" opacity="0.5">
        <line x1="14" y1="10" x2="60" y2="22" />
        <line x1="60" y1="22" x2="106" y2="10" />
        <line x1="37" y1="34" x2="83" y2="34" />
      </g>
    </svg>
  );
}

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
        {/* Aurora lived here (hero-only) until 2026-11-06. Round A
            2026-11-07 moves it to a GLOBAL layer behind the entire
            main content (App.tsx, spec colorStops, opacity 0.28) —
            the hero no longer carries its own Aurora. */}
        <div className="kiA-hero-copy">
          <p className="kiA-eyebrow">FIELD EDITION · 004 · YOUR PERSONAL KNOWLEDGE SYSTEM</p>
          {/* BlurText (React Bits, word blur, once on entry —
              Round A 2026-11-09 spec §G5): the editorial headline
              blurs in by word, two lines. "connection." is italic +
              cyan, larger, via the .de-blurline--accent rule in
              living-archive.css. Replaces SplitText (line reveal)
              on this headline only. */}
          <h1 className="kiA-display kiA-hero-title">
            <span className="de-blurline">
              <BlurText text="Your knowledge lives in" animateBy="words" direction="top" trigger="load" delay={100} stepDuration={0.35} />
            </span>
            <span className="de-blurline de-blurline--accent">
              <BlurText text="connection." animateBy="words" direction="top" trigger="load" delay={400} stepDuration={0.35} />
            </span>
          </h1>
          <p className="kiA-hero-sub">
            Four disciplines. One connected archive. Every page within reach.
          </p>
          <div className="kiA-hero-cta">
            {/* StarBorder (React Bits) on the primary CTA only —
                Round A 2026-11-09 spec §G5: replaces Magnet +
                GlareHover here. The secondary CTA is plain —
                GlareHover is reserved for selected search results
                + doc covers. */}
            <StarBorder
              as="button"
              type="button"
              className="de-star-cta"
              color="#ffffff"
              trailColor="#ffffff"
              backgroundColor="#65e5d2"
              textColor="#050911"
              borderColor="rgba(101, 229, 210, 0.5)"
              radius={12}
              duration={5}
              thickness={1.5}
              stars={1}
              glow={0.6}
              sparkle={false}
              hover="lap"
              clickPulse
              onClick={() => onGoSubject('all')}
            >
              Explore the archive&nbsp;&nbsp;→
            </StarBorder>
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
      {/* Statistics strip — real backend counts, 42px data objects (§16),
          Count Up once on load only. Round C P1: no AnimatedContent
          wrapper here — the spec reserves it for document/card
          entrances, and the stats already animate via CountUp. */}
      <div className="kiA-stats" role="list" aria-label="Archive statistics">
        <Stat value={totalDocs} label="DOCUMENTS" loaded={loaded} />
        <Stat value={totalPages} label="PAGES" loaded={loaded} />
        <Stat value={SUBJECTS.length} label="FIELDS" loaded={loaded} pad2 />
        <Stat value={bookmarkCount} label="SAVED" loaded={loaded} pad2 />
      </div>

      {/* 2 — The four discipline plates. Round C P1: this IS a
          card entrance, so it keeps AnimatedContent — on the spec
          motion language (distance 18, duration 0.48, threshold
          0.12, stagger 0.06, once). */}
      <AnimatedContent
        trigger="mount"
        distance={18}
        duration={0.48}
        ease="power3.out"
        initialOpacity={0}
        blur={0}
        threshold={0.12}
        stagger={0.06}
        once
      >
      <section className="kiA-section">
        <p className="kiA-eyebrow">Your disciplines</p>
        <h2 className="kiA-display kiA-section-title">Choose your discipline.</h2>
        {/* Spotlight Card instruments (Round A 2026-11-08 spec §3):
            the four discipline plates are React Bits Spotlight Cards
            — pointer-following illumination, no tilt, no bento.
            Each card: symbol, name, doc count, one-line description,
            micro archive-share signal (real counts: n / 100).
            Subject accent stays 5–8% of the card. The section keeps
            its AnimatedContent entrance (stagger 0.06). */}
        <div className="de-spot-plates" role="list">
          {SUBJECTS.map((s) => {
            const color = v2SubjectColor(s.id);
            const n = counts[s.id] ?? 0;
            return (
              <SpotlightCard
                key={s.id}
                className={`de-spot-plate${fieldHover === s.id ? ' kiA-platecard--lit' : ''}`}
                spotlightColor={color}
                intensity={0.15}
                spotlightSize={220}
                softness={0.8}
                borderGlow={0.3}
                proximity={120}
                flare={false}
                grain={0}
                theme="dark"
                // The wrapper carries the surface (solid deep archive
                // blue) so the pointer spotlight washes the card;
                // the inner plate goes transparent (field-edition.css).
                style={{ '--spotlight-card-surface': '#0d1c2b' } as CSSProperties}
              >
                <div
                  role="button"
                  className="kiA-platecard-btn"
                  style={{ '--subj': color } as CSSProperties}
                  onClick={() => onGoSubject(s.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoSubject(s.id); } }}
                  tabIndex={0}
                  /* ROUND H 2026-11-09 (critiqueC H-07): the field
                     responds to discipline selection both ways —
                     hovering/focusing a plate lights its field node
                     (and subdues the others) via the shared
                     fieldHover state, mirroring node -> plate. */
                  onMouseEnter={() => setFieldHover(s.id)}
                  onMouseLeave={() => setFieldHover(null)}
                  onFocus={() => setFieldHover(s.id)}
                  onBlur={() => setFieldHover(null)}
                  aria-label={`${s.name} — ${n} documents`}
                >
                  <span className="de-plate-visual" aria-hidden="true">
                    <DisciplineVisual id={s.id} />
                  </span>
                  <span className="kiA-platecard-glyph" aria-hidden="true">{disciplineGlyph(s.id)}</span>
                  <h3 className="kiA-platecard-name">{s.name}</h3>
                  <p className="kiA-platecard-tag">{s.tagline}</p>
                  <span className="kiA-platecard-share" aria-label={`${n} of ${totalDocs} documents in the archive`}>
                    {String(n).padStart(2, '0')} / {String(totalDocs).padStart(3, '0')} ARCHIVE SHARE
                  </span>
                  <span className="kiA-platecard-foot">
                    <span className="kiA-platecard-count">
                      <strong>{loaded ? n : '—'}</strong> documents
                    </span>
                    <span className="kiA-platecard-arrow" aria-hidden="true">Explore discipline →</span>
                  </span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </section>
      </AnimatedContent>

      {/* Resume reading — intentional empty state, never a dashed box.
          Round C P1: no AnimatedContent wrapper — the spec reserves
          it for document/card entrances. */}
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

      {/* 3 — Quick access ledger. Round C P1: no AnimatedContent
          wrapper — the spec reserves it for document/card
          entrances. */}
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

      {/* 4 — Recent shelf. Round C P1: no AnimatedContent wrapper —
          the spec reserves it for document/card entrances. */}
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
      {/* ROUND A 2026-11-09 (spec §G5): GlareHover on doc covers —
          the Recent shelf covers are the only real cover images on
          Overview. */}
      <GlareHover className="de-glare-block" glareColor="#ffffff" glareOpacity={0.18}>
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
      </GlareHover>
    </div>
  );
}
