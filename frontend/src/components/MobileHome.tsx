// K/IND mobile engine — MOBILE HOME screen (ChatGPT Round B, 2026-11-04).
// FIELD EDITION mobile rebuild per the Round B critique (morning loop):
// page-specific field identity (field-atmosphere.css) · Aurora hero-only with
// the critique's exact settings (NO mouse interaction) · restrained
// teal/blue light field (CSS gradients — strongest behind the network
// graphic, weaker behind the stats) · upgraded network art (~280×200,
// pulsing nodes, halos, fixed labels, faint grid, travelling signal with
// arrival pulse — real subject data only) · BlurText
// headlines (words/top/70-110/0.4/7, first open only per session) · ShinyText eyebrow · CountUp stats
// (once, real values) · 54px search with SpecularButton GO · discipline
// tiles as signature cards (SpotlightCard tap/focus + full-bleed per-subject
// SVG artwork, subject bottom edge, art never behind text) · AnimatedContent
// section entrances. Desktop untouched. Mobile only.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { LibFile } from '../shared';
import { SUBJECTS, pageImageUrl, relTime, subjectOf } from '../shared';
import Aurora from '../bits/Aurora';
import Particles from '../bits/Particles';
import BlurText from '../bits/BlurText';
import ShinyText from '../bits/ShinyText';
import CountUp from '../bits/CountUp';
import SpotlightCard from '../bits/SpotlightCard';
import AnimatedContent from '../bits/AnimatedContent';
import SpecularButton from '../bits/SpecularButton';
import Carousel from '../bits/Carousel';
import DocCover from './DocCover';
import './DocCover.css';
import './MobileHome.css';

export interface ResumeInfo {
  file: LibFile;
  page: number;
}

export interface RecentInfo {
  file: LibFile;
  ts: number | null;
}

export interface MobileHomeProps {
  totalDocs: number;
  totalPages: number;
  subjectCounts: Record<string, number>;
  subjectPages: Record<string, number>; // Round C re-score: real per-subject page totals
  resume: ResumeInfo | null;          // real saved progress (kl:pos)
  recent: RecentInfo[];               // recently opened, max ~5
  reducedMotion: boolean;
  onOpenSubject: (subj: string) => void;
  onOpenReader: (key: string, list: string[]) => void;
  onSearch: (q: string) => void;      // submit hero search
}

/** Signature per-subject background artwork for the discipline tiles —
 *  full-bleed, bottom-right anchored, decorative (abstract motifs only —
 *  never fake content). Art never sits behind text: tiles keep text
 *  left-aligned with the art on the right edge. */
function SubjectMotif({ id, color }: { id: string; color: string }) {
  if (id === 'em2') {
    // blue geometry: coordinate grid + parabola sweep + integral glyph
    return (
      <svg className="mh-motif" viewBox="0 0 160 160" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`v${i}`} x1={i * 32} y1="0" x2={i * 32} y2="160" stroke="rgba(255,255,255,.09)" strokeWidth="1" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 32} x2="160" y2={i * 32} stroke="rgba(255,255,255,.09)" strokeWidth="1" />
        ))}
        <path d="M8 148 C52 148 58 44 118 40 C142 38 150 62 160 58"
          stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M8 156 C60 156 66 84 130 80" stroke={color} strokeWidth="1.5"
          fill="none" strokeLinecap="round" opacity="0.5" />
        <circle cx="118" cy="40" r="4.5" fill={color} />
        <text x="108" y="128" fontSize="44" fill={color} opacity="0.75"
          fontFamily="'Instrument Serif', serif">∫</text>
      </svg>
    );
  }
  if (id === 'signals') {
    // violet waves: layered sine + square wave
    return (
      <svg className="mh-motif" viewBox="0 0 160 160" aria-hidden="true">
        <line x1="0" y1="80" x2="160" y2="80" stroke="rgba(255,255,255,.1)" strokeWidth="1" strokeDasharray="3 4" />
        <path d="M-4 80 C20 10 44 10 68 80 S116 150 140 80 S188 10 212 80"
          stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M-4 112 H28 V48 H60 V112 H92 V48 H124 V112 H156 V48 H188"
          stroke={color} strokeWidth="1.5" fill="none" opacity="0.55" />
        <path d="M-4 80 C16 60 36 60 56 80 S96 100 116 80 S156 60 176 80"
          stroke={color} strokeWidth="1.5" fill="none" opacity="0.4" />
        <circle cx="68" cy="80" r="4.5" fill={color} />
      </svg>
    );
  }
  if (id === 'fis') {
    // bronze marble: flowing organic strata + editorial quote mark
    return (
      <svg className="mh-motif" viewBox="0 0 160 160" aria-hidden="true">
        <path d="M-4 30 C40 22 60 44 104 36 C132 30 146 20 166 26"
          stroke={color} strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M-4 62 C36 56 66 76 108 66 C138 59 150 50 166 56"
          stroke={color} strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M-4 96 C44 90 62 110 104 100 C134 93 148 86 166 92"
          stroke={color} strokeWidth="1.5" fill="none" opacity="0.38" />
        <path d="M-4 128 C40 124 70 140 112 130 C140 124 152 118 166 124"
          stroke={color} strokeWidth="1" fill="none" opacity="0.28" />
        <text x="104" y="150" fontSize="92" fill={color} opacity="0.8"
          fontFamily="'Instrument Serif', serif">?</text>
        <line x1="10" y1="14" x2="58" y2="14" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
        <line x1="10" y1="22" x2="42" y2="22" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
      </svg>
    );
  }
  // digital — teal circuits: traces, pads, AND gate
  return (
    <svg className="mh-motif" viewBox="0 0 160 160" aria-hidden="true">
      <path d="M6 26 H64 V64 H118" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M6 120 H44 V96" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M118 64 V128 H152" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="6" cy="26" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="64" cy="64" r="3.5" fill={color} />
      <circle cx="44" cy="96" r="3.5" fill={color} />
      <circle cx="152" cy="128" r="5" fill="none" stroke={color} strokeWidth="2.5" />
      {/* mini AND gate */}
      <path d="M96 92 H116 A16 16 0 0 1 116 124 H96 Z" fill="none" stroke={color} strokeWidth="2.5" />
      <line x1="84" y1="102" x2="96" y2="102" stroke={color} strokeWidth="2" />
      <line x1="84" y1="114" x2="96" y2="114" stroke={color} strokeWidth="2" />
      <line x1="132" y1="108" x2="146" y2="108" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** The Knowledge Field — upgraded hero network art (~280×200). Four nodes,
 *  one per real discipline (SUBJECTS = the only network data: no invented
 *  relationships), visible connecting lines, pulsing nodes, subject halos,
 *  faint grid, fixed node labels. Slow SMIL travelling signal along one
 *  connection (Round B 2026-11-08 P1: 5.5s — ~3.5s travel with a
 *  cubic-bezier(.4,0,.2,1) ease, ~2.0s pause — one pulse at a time) with a
 *  halo pulse on the destination node on arrival. Static when reduced-motion.
 * Round B 2026-11-08 P2 (1420 loop): INTERACTIVE, no React Bits
 *  background — tapping a node selects it: the node illuminates (brighter
 *  halo + subject ring), the lines touching it brighten in the subject
 *  color, and the parent shows the discipline label + preview card with
 *  the real doc count. The 52px invisible tap circle per node (r=26)
 *  already exceeds the 44px floor and is unchanged. */
function NetworkField({ animate, selected, onNodeTap }: {
  animate: boolean;
  selected: string | null;
  onNodeTap: (id: string) => void;
}) {
  // Round C re-score: node spacing +8–10% — (64,64),(216,64),(64,236),(216,236)
  const nodes = [
    { x: 64, y: 64, s: SUBJECTS[0] },   // EM2
    { x: 216, y: 64, s: SUBJECTS[1] },  // SIGNALS
    { x: 64, y: 236, s: SUBJECTS[2] },  // FIS
    { x: 216, y: 236, s: SUBJECTS[3] }, // DIGITAL
  ];
  const grid: string[] = [];
  for (let x = 0; x <= 280; x += 20) grid.push(`M${x},0 V300`);
  for (let y = 0; y <= 300; y += 20) grid.push(`M0,${y} H300`);
  const links: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
  const selIdx = selected ? nodes.findIndex(n => n.s.id === selected) : -1;
  const selColor = selIdx >= 0 ? nodes[selIdx].s.color : null;
  const SIGNAL_PATH = 'M64,64 L216,236'; // EM2 → DIGITAL diagonal
  return (
    <svg className="mh-network" viewBox="0 0 280 300" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="Knowledge field: the four disciplines, connected. Tap a node to preview it.">
      <defs>
        <radialGradient id="mh-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={grid.join(' ')} stroke="rgba(150,180,215,.07)" strokeWidth="1" fill="none" />
      {links.map(([a, b], i) => {
        // Round B 2026-11-08 P2: lines touching the selected node brighten
        // in the subject color; the rest stay at the quiet default.
        const lit = selIdx >= 0 && (a === selIdx || b === selIdx);
        return (
          <line key={i}
            x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
            stroke={lit && selColor ? selColor : 'rgba(112,197,204,0.34)'}
            strokeOpacity={lit ? 0.85 : 1}
            strokeWidth={lit ? 2 : 1.15} />
        );
      })}
      {nodes.map((n, i) => (
        <g key={i}
          className={animate ? 'mh-node' : 'mh-node-tap'}
          style={{ animationDelay: `${i * 0.7}s` }}
          onClick={() => onNodeTap(n.s.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNodeTap(n.s.id); }
          }}
          tabIndex={0}
          role="button"
          aria-label={`${n.s.name} — tap to preview`}
          aria-pressed={selected === n.s.id}
          cursor="pointer"
        >
          <title>{n.s.name}</title>
          {/* 52px invisible tap target (44px minimum, thumb-friendly) */}
          <circle cx={n.x} cy={n.y} r="26" fill="transparent" />
          {/* faint subject-color outer halo (Round C re-score;
              Round B 1420 P1: opacity 0.16) */}
          <circle cx={n.x} cy={n.y} r="26" fill={n.s.color} opacity="0.16" />
          <circle cx={n.x} cy={n.y} r="13" fill={n.s.color} opacity="0.22"
            className={animate ? 'mh-halo-pulse' : undefined} style={{ animationDelay: `${i * 0.7}s` }} />
          {/* Round B 2026-11-08 P2: selected node illuminates — a
              stronger halo + a subject-color ring around the core dot. */}
          {selected === n.s.id && (
            <>
              <circle cx={n.x} cy={n.y} r="26" fill={n.s.color} opacity="0.3" />
              <circle cx={n.x} cy={n.y} r="9.5" fill="none" stroke={n.s.color} strokeWidth="2" opacity="0.95" />
            </>
          )}
          <circle cx={n.x} cy={n.y} r="5.5" fill={n.s.color} opacity="0.95" />
          <circle cx={n.x} cy={n.y} r="5.5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.5" />
          <text x={n.x} y={n.y + 28} textAnchor="middle" fontSize="8.5"
            fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.12em"
            fill="rgba(235,240,248,.62)">{n.s.code}</text>
        </g>
      ))}
      {animate && (
        <g aria-hidden="true">
          {/* Round B 2026-11-08 P1: one pulse at a time, 5.5s cycle,
              cubic-bezier(.4,0,.2,1) ease on the travel (SMIL spline) —
              travel ~3.5s, hold ~2.0s. */}
          <circle r="3" fill="#8FE8DA" opacity="0.9">
            <animateMotion
              dur="5.5s"
              repeatCount="indefinite"
              keyTimes="0;0.64;1"
              keyPoints="0;1;1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0 0 1 1"
              path={SIGNAL_PATH}
            />
          </circle>
          {/* arrival pulse on the destination node: same 5.5s period,
              delayed by the travel time (~3.5s), one pulse per cycle */}
          <circle cx="216" cy="236" r="10" fill="none" stroke="#32D3BD"
            strokeWidth="1.5" className="mh-arrival-pulse" />
        </g>
      )}
      <circle cx="140" cy="150" r="2.5" fill="rgba(255,255,255,.4)" />
    </svg>
  );
}

/** AnimatedContent pass-through when reduced-motion is on (render children
 *  directly — no entrance animation). */
function MaybeAnim({ children, reducedMotion, ...props }: {
  children: ReactNode; reducedMotion: boolean; [k: string]: unknown;
}) {
  if (reducedMotion) return <>{children}</>;
  return <AnimatedContent {...(props as object)}>{children}</AnimatedContent>;
}

export default function MobileHome(props: MobileHomeProps) {
  const {
    totalDocs, totalPages, subjectCounts, subjectPages, resume, recent,
    reducedMotion, onOpenSubject, onOpenReader, onSearch,
  } = props;
  const [query, setQuery] = useState('');
  // Round B P2 CountUp: play once per tab session — the flag survives a
  // back-nav (MobileHome remounts on tab change), so the metrics never
  // restart. New key, no existing kl:* schema touched.
  const [heroCounted, setHeroCounted] = useState(() => {
    try { return sessionStorage.getItem('kl:hero-counted') === '1'; } catch { return false; }
  });
  const markHeroCounted = useCallback(() => {
    try { sessionStorage.setItem('kl:hero-counted', '1'); } catch { /* ignore */ }
    setHeroCounted(true);
  }, []);
  const showCountUp = !reducedMotion && !heroCounted;
  // Round B 2026-11-08 P1: BlurText entrance plays on Home FIRST open
  // only (per tab session). The flag is written on mount WITHOUT a
  // re-render, so this mount still animates and the NEXT mount renders
  // the static headline — marking it in state here would swap the
  // headline mid-animation. New key, no existing kl:* schema touched.
  const [heroBlurred] = useState(() => {
    try { return sessionStorage.getItem('kl:hero-blur-done') === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (reducedMotion || heroBlurred) return;
    try { sessionStorage.setItem('kl:hero-blur-done', '1'); } catch { /* ignore */ }
  }, [reducedMotion, heroBlurred]);
  const showBlur = !reducedMotion && !heroBlurred;
  // constellation node preview (Round B 2026-11-04, 1420 loop): tapping a
  // node shows a per-subject preview with the real document count
  const [preview, setPreview] = useState<string | null>(null);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch(q);
  };

  const resumeSubj = resume ? subjectOf(resume.file.subj) : undefined;
  const resumeColor = resumeSubj?.color ?? '#719AFF';
  const resumePage = resume ? Math.max(1, Math.min(resume.page, Math.max(1, resume.file.pages))) : 1;
  const resumePages = Math.max(1, resume?.file.pages ?? 1);
  const resumePct = Math.round((resumePage / resumePages) * 100);

  return (
    <div className="mh mobile-page">
      {/* 1 — Header 48px + subtle bottom border */}
      <header className="mh-header">
        <span className="mh-wordmark">K/IND</span>
        <span className="mh-micro">{totalDocs} DOCS · 4 DISCIPLINES</span>
      </header>

      {/* 2–6 — Hero: "The Knowledge Field" */}
      <section className="mh-hero">
        {!reducedMotion && (
          <div className="mh-aurora" aria-hidden="true">
            <Aurora
              colorStops={['#087F83', '#145D91', '#292B65']}
              amplitude={0.45}
              blend={0.8}
              height={0.38}
              speed={0.16}
              scale={1.3}
              glow={0.3}
              layers={2}
              opacity={0.32}
              mouseInteraction={false}
            />
          </div>
        )}

        <div className="mh-hero-copy">
          {reducedMotion ? (
            <p className="mh-eyebrow">K/IND · FIELD EDITION</p>
          ) : (
            <ShinyText
              text="K/IND · FIELD EDITION"
              className="mh-eyebrow"
              color="rgba(242,244,248,0.55)"
              shineColor="#8fe8da"
              speed={3.2}
              shineWidth={46}
              trigger="loop"
              yoyo={false}
              disabled={false}
            />
          )}
          {/* Round B 2026-11-08 P1: BlurText delays 70/110 (were 90/130),
              first open only — later Home visits render the static h1. */}
          {showBlur ? (
            <>
              <BlurText className="mh-headline" text="Think deeper." animateBy="words"
                direction="top" trigger="load" loop={false} delay={70} stepDuration={0.4} blur={7} distance={30} />
              <BlurText className="mh-headline" text="Connect everything." animateBy="words"
                direction="top" trigger="load" loop={false} delay={110} stepDuration={0.4} blur={7} distance={30} />
            </>
          ) : (
            <h1 className="mh-headline">Think deeper.<br />Connect everything.</h1>
          )}

          <div className="mh-network-wrap">
            {/* Particles behind the constellation — Round B 2026-11-06 spec:
                28 faint ambient particles INSIDE the discipline-map area
                only (spread 5, speed 0.06, opacity 0.28, hover-reactive).
                particleBaseSize 16, NOT the spec's 1.5: in this WebGL
                implementation coverage scales as (size/dist*dpr)^2, so 1.5
                renders ~2% alpha = invisible (same finding as Round A
                desktop, where 2 was invisible); 16 is the smallest size
                that visibly renders at opacity 0.28. */}
            {!reducedMotion && (
              <div className="mh-particles" aria-hidden="true">
                <Particles
                  particleCount={28}
                  particleSpread={5}
                  speed={0.06}
                  particleColors={['#8FE8DA', '#719AFF', '#B38AFF', '#E6B36C']}
                  alphaParticles
                  particleBaseSize={16}
                  sizeRandomness={0.35}
                  disableRotation
                  moveParticlesOnHover
                  opacity={0.28}
                  className="mh-particles-canvas"
                />
              </div>
            )}
            <NetworkField animate={!reducedMotion} selected={preview}
              // Round B 2026-11-08 P2: tapping the selected node again
              // deselects it (closes the preview + label).
              onNodeTap={(id) => setPreview(p => (p === id ? null : id))} />
            {preview && (() => {
              const s = SUBJECTS.find(x => x.id === preview);
              if (!s) return null;
              const count = subjectCounts[s.id] ?? 0;
              const pages = subjectPages[s.id] ?? 0;
              return (
                <div className="mh-preview" role="dialog" aria-label={`${s.name} preview`}>
                  <button
                    type="button"
                    className="mh-preview-close"
                    onClick={() => setPreview(null)}
                    aria-label="Close preview"
                  >
                    ×
                  </button>
                  <span className="mh-preview-code" style={{ color: s.color }}>{s.code}</span>
                  <span className="mh-preview-name">{s.name}</span>
                  <span className="mh-preview-count">{count} DOCUMENTS · {pages.toLocaleString('en-US')} PAGES</span>
                  <button
                    type="button"
                    className="mh-preview-open"
                    style={{ ['--sc' as any]: s.color }}
                    onClick={() => { setPreview(null); onOpenSubject(s.id); }}
                  >
                    OPEN COLLECTION →
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Round B 2026-11-08 P2: small label under the graphic showing
              the selected discipline + its real doc count. The preview
              card above (code/name/count/OPEN COLLECTION) is unchanged. */}
          {preview && (() => {
            const s = SUBJECTS.find(x => x.id === preview);
            if (!s) return null;
            const count = subjectCounts[s.id] ?? 0;
            return (
              <p className="mh-net-label" aria-live="polite">
                <span style={{ color: s.color }}>{s.code}</span>
                {' — '}{s.name.toUpperCase()} · {count} DOCUMENTS
              </p>
            );
          })()}

          <p className="mh-supporting">
            {totalDocs} documents. 4 disciplines. Your entire study world.
          </p>

          <form className="mh-search" onSubmit={submitSearch} role="search">
            <input
              className="mh-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an idea, equation, lecture…"
              enterKeyHint="search"
              aria-label="Search the library"
            />
            {reducedMotion ? (
              <button className="mh-search-go" type="submit" aria-label="Search">→</button>
            ) : (
              <SpecularButton
                type="submit"
                size="sm"
                className="mh-search-go"
                aria-label="Search"
                tint="#32D3BD"
                tintOpacity={0.5}
                textColor="#05211D"
                radius={12}
                intensity={0.9}
                idleIntensity={0.35}
                autoAnimate
                followMouse={false}
                glow={0.5}
              >
                →
              </SpecularButton>
            )}
          </form>

          {/* three stat figures — ONE connected strip with dividers,
              LIBRARY METRICS micro label; CountUp once, all real counts.
              Round C re-score: .hero-metrics editorial strip */}
          <div className="mh-stats hero-metrics" aria-label="Library statistics">
            <p className="mh-stats-eyebrow">LIBRARY METRICS</p>
            <div className="mh-stats-strip">
              <div className="mh-stat">
                <span className="mh-stat-num">
                  {showCountUp ? (
                    <CountUp to={totalDocs} from={0} duration={1.2} trigger="view" onEnd={markHeroCounted} className="mh-countup" />
                  ) : totalDocs}
                </span>
                <span className="mh-stat-label">DOCUMENTS</span>
              </div>
              <div className="mh-stat-divider" aria-hidden="true" />
              <div className="mh-stat">
                <span className="mh-stat-num">
                  {showCountUp ? (
                    <CountUp to={SUBJECTS.length} from={0} duration={1.0} trigger="view" onEnd={markHeroCounted} className="mh-countup" />
                  ) : SUBJECTS.length}
                </span>
                <span className="mh-stat-label">DISCIPLINES</span>
              </div>
              <div className="mh-stat-divider" aria-hidden="true" />
              <div className="mh-stat">
                <span className="mh-stat-num">
                  {showCountUp ? (
                    <CountUp to={totalPages} from={0} duration={1.2} separator="," trigger="view" onEnd={markHeroCounted} className="mh-countup" />
                  ) : totalPages.toLocaleString('en-US')}
                </span>
                <span className="mh-stat-label">PAGES</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8 — Disciplines: signature cards (SpotlightCard, tap/focus) */}
      <section className="mh-section mh-section--tiles">
        {/* Round C re-score: eyebrow before the discipline section */}
        <p className="mh-section-eyebrow">EXPLORE THE ARCHIVE</p>
        <h2 className="mh-section-head">YOUR DISCIPLINES</h2>
        <MaybeAnim
          reducedMotion={reducedMotion}
          className="mh-tiles"
          distance={18}
          duration={0.45}
          ease="power3.out"
          once
          stagger={0.08}
          trigger="scroll"
          container="#kl-mobile-scroll"
        >
          {SUBJECTS.map((s) => {
            const count = subjectCounts[s.id] ?? 0;
            return (
              <button
                key={s.id}
                className="mh-tile"
                style={{ '--sc': s.color } as CSSProperties}
                onClick={() => onOpenSubject(s.id)}
                aria-label={`${s.name} — ${count} documents`}
              >
                <SpotlightCard
                  className="mh-tile-spot"
                  spotlightColor={s.color}
                  intensity={0.32}
                  spotlightSize={150}
                  softness={0.75}
                  borderGlow={0.55}
                  proximity={60}
                  flare={false}
                  grain={0}
                  theme="dark"
                >
                  <SubjectMotif id={s.id} color={s.color} />
                  <span className="mh-tile-num">{s.num}</span>
                  <span className="mh-tile-short" style={{ color: s.color }}>
                    {s.short.toUpperCase()}
                  </span>
                  <span className="mh-tile-name">{s.name}</span>
                  <span className="mh-tile-count">{count} DOCUMENTS</span>
                </SpotlightCard>
              </button>
            );
          })}
        </MaybeAnim>
      </section>

      {/* 8b — Continue Reading */}
      {resume && (
        <section className="mh-section mh-resume-section">
          <h2 className="mh-section-head">CONTINUE READING</h2>
          <MaybeAnim
            reducedMotion={reducedMotion}
            distance={18}
            duration={0.45}
            ease="power3.out"
            once
            trigger="scroll"
            container="#kl-mobile-scroll"
          >
            <button
              className="mh-resume"
              style={{ '--sc': resumeColor } as CSSProperties}
              onClick={() => onOpenReader(resume.file.key, [resume.file.key])}
              aria-label={`Continue reading ${resume.file.title}, page ${resumePage} of ${resumePages}`}
            >
              <DocCover
                src={pageImageUrl(resume.file.subj, resume.file.file, resumePage, resumePages)}
                subj={resume.file.subj}
                docIndex={1}
                docType="RESUME"
                title={resume.file.title}
                seed={resume.file.key}
                className="mh-resume-thumb"
              />
              <span className="mh-resume-body">
                <span className="mh-resume-eyebrow" style={{ color: resumeColor }}>
                  {resumeSubj?.code ?? 'K/IND'}
                </span>
                <span className="mh-resume-title">{resume.file.title}</span>
                <span className="mh-resume-meta">
                  PAGE {resumePage} OF {resumePages} · {resumePct}%
                </span>
                <span className="mh-resume-bar">
                  <span className="mh-resume-fill" style={{ width: `${resumePct}%` }} />
                </span>
                <span className="mh-resume-cta">RESUME →</span>
              </span>
            </button>
          </MaybeAnim>
        </section>
      )}

      {/* 9 — Recently explored */}
      {recent.length > 0 && (
        <section className="mh-section">
          <h2 className="mh-section-head">RECENTLY EXPLORED</h2>
          {/* Round B 2026-11-06 (deferred 2026-11-05 P2): AnimatedContent on
              the hero's lower archive content too — tiles + resume already
              had it; this was the one section missing it. */}
          <MaybeAnim
            reducedMotion={reducedMotion}
            distance={18}
            duration={0.45}
            ease="power3.out"
            once
            trigger="scroll"
            container="#kl-mobile-scroll"
          >
          <Carousel cardWidth={150} gap={10} showArrows={false} ariaLabel="Recently explored documents">
            {recent.map((r, i) => (
              <button
                key={r.file.key}
                className="mh-recent-card"
                onClick={() => onOpenReader(r.file.key, [r.file.key])}
                aria-label={`Open ${r.file.title}`}
              >
                <DocCover
                  src={pageImageUrl(r.file.subj, r.file.file, 1, Math.max(1, r.file.pages))}
                  subj={r.file.subj}
                  docIndex={i + 1}
                  title={r.file.title}
                  seed={r.file.key}
                  className="mh-recent-thumb"
                />
                <span className="mh-recent-title">{r.file.title}</span>
                <span className="mh-recent-time">{relTime(r.ts)}</span>
              </button>
            ))}
          </Carousel>
          </MaybeAnim>
        </section>
      )}
    </div>
  );
}
