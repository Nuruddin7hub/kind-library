// K/IND mobile engine — shared subject index (ChatGPT Round B, 2026-11-03 rebuild).
// ONE component, theme per subject via config — never duplicated pages.
// Distinct per-subject visual storytelling: discipline badge → editorial
// headline → lede → custom SVG artwork band → one-line meta → BROWSE BY TYPE
// filter chips → featured resource → document list. Only real stored
// metadata: doc counts, distinct sections, saved pages, most-recently-opened.
// Never invent reading progress or document types.
// Desktop is untouched — mobile only. All classes prefixed msi-.

import { useEffect, useMemo, useState } from 'react';
import './MobileSubjectIndex.css';
import MobileDocRow, { type RowFile } from './MobileDocRow';
import DocCover from './DocCover';
import RowStagger from './RowStagger';
import { pageImageUrl, SUBJECTS } from '../shared';
import ScrollReveal from '../bits/ScrollReveal';
import BlurText from '../bits/BlurText';
import Aurora from '../bits/Aurora';
import SpotlightCard from '../bits/SpotlightCard';
import AnimatedContent from '../bits/AnimatedContent';
import GlareHover from '../bits/GlareHover';
import Noise from '../bits/Noise';

interface ThemeConfig {
  badge: string;
  headline: string;
  lede: string;
  /** subject-specific document-list label (Round C P1: never generic) */
  listLabel: string;
  /** featured-card entry label: Digital = START HERE, FIS = RECOMMENDED ENTRY */
  featStartLabel: string;
  /** tappable hero questions (FIS only) — each runs a real search */
  questions?: string[];
}

const THEMES: Record<string, ThemeConfig> = {
  em2: {
    badge: 'THE PROOF ROOM',
    headline: 'Where proofs become intuition.',
    lede: 'Equations, transforms and the machinery of mathematical methods — worked end to end.',
    listLabel: 'THE PROOF ARCHIVE',
    featStartLabel: 'START HERE',
  },
  signals: {
    badge: 'THE FREQUENCY DOMAIN',
    headline: 'Time becomes frequency.',
    lede: 'Signals, systems and their responses — in time, in frequency, in practice.',
    listLabel: 'THE SIGNAL ARCHIVE',
    featStartLabel: 'START HERE',
  },
  fis: {
    badge: 'THE PHILOSOPHY COLLECTION',
    headline: 'The art of questioning.',
    lede: 'Ideas. Arguments. Meaning — examined, page by page.',
    listLabel: 'THE IDEA ARCHIVE',
    featStartLabel: 'RECOMMENDED ENTRY',
    questions: ['What is metaphysics?', 'What is epistemology?', 'Is truth relative?'],
  },
  digital: {
    badge: 'THE CIRCUIT LAB',
    headline: 'Logic becomes reality.',
    // Round B 2026-11-04 (1420 loop): new subline from the critique
    lede: 'From Boolean logic to working systems. Explore the hardware that makes computation possible.',
    listLabel: 'THE CIRCUIT ARCHIVE',
    featStartLabel: 'START HERE',
  },
};

/** FIS question cards — editorial entries with REAL descriptions from the
 *  PDF contents (Round B 2026-11-04, 1420 loop). Descriptions are grounded
 *  in the full-text index snippets for each chapter; page counts and
 *  chapter numbers are real library metadata. */
const FIS_QUESTIONS = [
  {
    q: 'What is metaphysics?',
    desc: 'Chapter 5 — the concept of man: what is real, and what lies beyond nature.',
    meta: 'CHAPTER 05 · 32 PAGES',
  },
  {
    q: 'What is epistemology?',
    desc: 'Chapter 6 — how we know: from faith and authority to reason, science and experience.',
    meta: 'CHAPTER 06 · 42 PAGES',
  },
  {
    q: 'Is truth relative?',
    desc: 'Chapter 7 — postmodern relativism: is truth shaped by culture, language and society?',
    meta: 'CHAPTER 07 · 48 PAGES',
  },
];

/** Curated featured picks (Round C P0): genuine entries from real document
 *  metadata — never an internal/working title as editorial content. Matched
 *  by file name; falls back to the recent/first logic below. */
const CURATED_FEATURED: Record<string, string> = {
  digital: 'Dig_Elec_Sep26_Course_Intro__Overview.pdf',
};

/** Titles that read like internal working notes — never featured. */
const INTERNAL_TITLE_RE = /to replace|draft|todo|fixme|untitled|placeholder/i;

/* ---------- per-subject SVG artwork bands (decorative, subtle: ≤0.9 opacity, 1px strokes) ---------- */

/* ---------- per-subject SVG artwork bands (decorative, subtle: ≤0.9 opacity, 1px strokes) ----------
 * Digital art upgraded (Round B 2026-11-04): full-width × 144px, bigger AND
 * gate, A/B in → Y out, animated signal pulse, truth table, PCB traces,
 * teal glow — custom SVG/CSS, NO WebGL. */

function DigitalArt({ animated }: { animated: boolean }) {
  // Circuit Lab accents (Round B 2026-11-04, 1420 loop): signal #42D9B5,
  // trace #1C938A, base #0A2425. Taller frame (200px), traces extending
  // BEYOND the frame (slice clips them at the edges), two animated signal
  // pulses on independent cycles, glowing nodes, truth table.
  const signal = '#42D9B5';
  const trace = '#1C938A';
  return (
    <svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="msi-tealglow" cx="35%" cy="50%" r="60%">
          <stop offset="0%" stopColor={signal} stopOpacity="0.24" />
          <stop offset="100%" stopColor={signal} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="msi-nodeglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={signal} stopOpacity="0.9" />
          <stop offset="100%" stopColor={signal} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="360" height="200" fill="url(#msi-tealglow)" />
      {/* circuit traces extending beyond the frame */}
      <path d="M-24 170 H60 L112 118 H180" fill="none" stroke={trace} strokeWidth="1.5" opacity="0.7" />
      <path d="M-24 26 H70 L122 78" fill="none" stroke={trace} strokeWidth="1.5" opacity="0.6" />
      <path d="M228 214 H300 L384 130" fill="none" stroke={trace} strokeWidth="1.5" opacity="0.55" />
      <path d="M250 -14 H310 L384 62" fill="none" stroke={trace} strokeWidth="1.5" opacity="0.5" />
      <path d="M180 214 V158" fill="none" stroke={trace} strokeWidth="1" opacity="0.4" />
      <path d="M-24 120 H36" fill="none" stroke={trace} strokeWidth="1" opacity="0.35" />
      {/* glowing nodes */}
      <circle cx="60" cy="170" r="8" fill="url(#msi-nodeglow)" opacity="0.8" />
      <circle cx="60" cy="170" r="3" fill={signal} />
      <circle cx="300" cy="192" r="8" fill="url(#msi-nodeglow)" opacity="0.7" />
      <circle cx="300" cy="192" r="3" fill={signal} />
      <circle cx="310" cy="8" r="7" fill="url(#msi-nodeglow)" opacity="0.6" />
      <circle cx="310" cy="8" r="2.5" fill={signal} />
      <circle cx="112" cy="118" r="6" fill="url(#msi-nodeglow)" opacity="0.55" />
      <circle cx="112" cy="118" r="2.5" fill={signal} />
      {/* AND gate, enlarged and centred left */}
      <g transform="translate(140 100) scale(1.25) translate(-106 -78)">
        <line x1="16" y1="58" x2="66" y2="58" stroke={signal} strokeWidth="2.5" opacity="0.95" />
        <line x1="16" y1="98" x2="66" y2="98" stroke={signal} strokeWidth="2.5" opacity="0.95" />
        <path d="M66 40 H112 A38 38 0 0 1 112 116 H66 Z"
          fill="rgba(66,217,181,0.07)" stroke={signal} strokeWidth="3" opacity="0.98" />
        <line x1="150" y1="78" x2="196" y2="78" stroke={signal} strokeWidth="2.5" opacity="0.95" />
        <circle cx="16" cy="58" r="4" fill="none" stroke={signal} strokeWidth="1.5" opacity="0.95" />
        <circle cx="16" cy="98" r="4" fill="none" stroke={signal} strokeWidth="1.5" opacity="0.95" />
        <circle cx="196" cy="78" r="4" fill="none" stroke={signal} strokeWidth="1.5" opacity="0.95" />
        {/* TWO signal pulses on independent cycles: A→Y (3.2s) and B→Y (4.6s).
            Gated by `animated` (parent passes false when reduced motion). */}
        {animated && (
          <g>
            <circle r="4" fill={signal}>
              <animateMotion dur="3.2s" repeatCount="indefinite" calcMode="linear"
                keyTimes="0;0.62;1" keyPoints="0;1;1"
                path="M16 58 C60 58 80 78 108 78 H196" />
            </circle>
            <circle r="3" fill="#ffffff" opacity="0.85">
              <animateMotion dur="4.6s" begin="1.1s" repeatCount="indefinite" calcMode="linear"
                keyTimes="0;0.7;1" keyPoints="0;1;1"
                path="M16 98 C60 98 80 78 108 78 H196" />
            </circle>
          </g>
        )}
        <text x="4" y="62" fontFamily="var(--font-mono)" fontSize="12" fill={signal} opacity="0.95">A</text>
        <text x="4" y="102" fontFamily="var(--font-mono)" fontSize="12" fill={signal} opacity="0.95">B</text>
        <text x="204" y="82" fontFamily="var(--font-mono)" fontSize="12" fill={signal} opacity="0.95">Y</text>
        <text x="70" y="28" fontFamily="var(--font-mono)" fontSize="10" fill="#ffffff" opacity="0.55">AND</text>
      </g>
      {/* truth table: the gate's behaviour, stated plainly */}
      <text x="272" y="52" fontFamily="var(--font-mono)" fontSize="11" fill="#ffffff" opacity="0.6">A B │ Y</text>
      <text x="272" y="76" fontFamily="var(--font-mono)" fontSize="12" fill={signal} opacity="0.92">0 0 │ 0</text>
      <text x="272" y="98" fontFamily="var(--font-mono)" fontSize="12" fill={signal} opacity="0.92">0 1 │ 0</text>
      <text x="272" y="120" fontFamily="var(--font-mono)" fontSize="12" fill={signal} opacity="0.92">1 0 │ 0</text>
      <text x="272" y="142" fontFamily="var(--font-mono)" fontSize="12" fill="#ffffff" opacity="0.95">1 1 │ 1</text>
      <text x="272" y="166" fontFamily="var(--font-mono)" fontSize="10" fill="#ffffff" opacity="0.5">Y = A · B</text>
    </svg>
  );
}

function FisArt({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 360 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* thin editorial rules */}
      <line x1="24" y1="26" x2="150" y2="26" stroke="#ffffff" strokeWidth="1" opacity="0.35" />
      <line x1="24" y1="40" x2="112" y2="40" stroke="#ffffff" strokeWidth="1" opacity="0.22" />
      <line x1="24" y1="118" x2="170" y2="118" stroke="#ffffff" strokeWidth="1" opacity="0.28" />
      {/* numbered questions */}
      <text x="24" y="66" fontFamily="var(--font-mono)" fontSize="10" fill={accent} opacity="0.85">Q.01 — WHAT IS KNOWLEDGE?</text>
      <text x="24" y="88" fontFamily="var(--font-mono)" fontSize="10" fill="#ffffff" opacity="0.5">Q.02 — WHAT CAN BE KNOWN?</text>
      <text x="24" y="110" fontFamily="var(--font-mono)" fontSize="10" fill="#ffffff" opacity="0.38">Q.03 — WHY DOES IT MATTER?</text>
      {/* oversized serif question mark */}
      <text x="252" y="116" fontFamily="var(--font-display)" fontSize="112" fill={accent} opacity="0.85">?</text>
    </svg>
  );
}

function Em2Art({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 360 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* coordinate grid */}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`v${i}`} x1={i * 30} y1="0" x2={i * 30} y2="132" stroke="#ffffff" strokeWidth="1" opacity="0.18" />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 33} x2="360" y2={i * 33} stroke="#ffffff" strokeWidth="1" opacity="0.18" />
      ))}
      {/* axes */}
      <line x1="24" y1="0" x2="24" y2="132" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
      <line x1="0" y1="100" x2="360" y2="100" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
      {/* curve: parabola sweep */}
      <path d="M24 96 C110 96 140 22 336 14" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.9" />
      <path d="M24 118 C120 118 150 62 336 58" fill="none" stroke={accent} strokeWidth="1" opacity="0.35" />
      <circle cx="216" cy="46" r="3" fill={accent} opacity="0.9" />
      {/* decorative glyphs */}
      <text x="64" y="58" fontFamily="var(--font-display)" fontSize="30" fill={accent} opacity="0.6">∫</text>
      <text x="300" y="48" fontFamily="var(--font-display)" fontSize="26" fill={accent} opacity="0.55">Σ</text>
      <text x="150" y="124" fontFamily="var(--font-display)" fontSize="20" fill={accent} opacity="0.5">π</text>
      <text x="326" y="118" fontFamily="var(--font-display)" fontSize="20" fill={accent} opacity="0.5">Δ</text>
    </svg>
  );
}

function SignalsArt({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 360 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* vertical frequency lines */}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={i * 36 + 8} y1="0" x2={i * 36 + 8} y2="132" stroke="#ffffff" strokeWidth="1" opacity="0.16" />
      ))}
      {/* center axis */}
      <line x1="0" y1="66" x2="360" y2="66" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
      {/* layered sine wave */}
      <path
        d="M0 66 C30 6 60 6 90 66 S150 126 180 66 S240 6 270 66 S330 126 360 66"
        fill="none" stroke={accent} strokeWidth="1.5" opacity="0.9"
      />
      {/* square wave layer */}
      <path
        d="M0 100 H45 V32 H90 V100 H135 V32 H180 V100 H225 V32 H270 V100 H315 V32 H360"
        fill="none" stroke={accent} strokeWidth="1" opacity="0.5"
      />
      {/* faint harmonic */}
      <path
        d="M0 66 C20 46 40 46 60 66 S100 86 120 66 S160 46 180 66 S220 86 240 66 S280 46 300 66 S340 86 360 66"
        fill="none" stroke={accent} strokeWidth="1" opacity="0.28"
      />
      <circle cx="90" cy="66" r="3" fill={accent} opacity="0.9" />
    </svg>
  );
}

function SubjectArtwork({ subject, accent, animated }: { subject: string; accent: string; animated: boolean }) {
  return (
    <div className="msi-art" aria-hidden="true">
      {subject === 'digital' && <DigitalArt animated={animated} />}
      {subject === 'fis' && <FisArt accent={accent} />}
      {subject === 'em2' && <Em2Art accent={accent} />}
      {subject === 'signals' && <SignalsArt accent={accent} />}
    </div>
  );
}

/** FIS editorial feature — "THE BIG QUESTION" (Round C re-score):
 *  ONE static feature replacing the old 3-item list: mono micro label, one
 *  large question (first of theme.questions), one short factual
 *  explanation, an EXPLORE button that runs a real library search, and a
 *  bronze serif ? at ~42% width. No auto-rotation. */
function BigQuestionsCard({
  accent, questions, onSearchQuery,
}: {
  accent: string;
  questions: string[];
  onSearchQuery?: (q: string) => void;
}) {
  return (
    <div className="msi-bigq" aria-label="The big question">
      <div className="msi-bigq-left">
        <span className="msi-bigq-label">THE BIG QUESTION</span>
        <span className="msi-bigq-rule" aria-hidden="true" />
        <p className="msi-bigq-q-big">{questions[0]}</p>
        <p className="msi-bigq-desc">
          Four documents on what exists, what can be known, and whether truth holds.
        </p>
        {onSearchQuery && (
          <button
            type="button"
            className="msi-bigq-btn"
            onClick={() => onSearchQuery(questions[0])}
          >
            EXPLORE THE COLLECTION →
          </button>
        )}
        <span className="msi-bigq-rule" aria-hidden="true" />
      </div>
      <span className="msi-bigq-mark" style={{ color: accent }} aria-hidden="true">?</span>
    </div>
  );
}

const posKey = (k: string) => `kl:pos:${k}`;

/** Premium featured card (Round B 2026-11-04): subject top accent, larger
 *  cover, prominent title, real metadata, full-card tap, SpotlightCard
 *  tap/focus glow. Digital gets the teal light from the right; FIS the
 *  bronze top edge + amber CTA. */
function FeaturedCard({
  featured, featuredPage, featuredIsRecent, files, accent, theme,
  sectionLabelOf, openKey, spotlight, subject, subjectCode,
}: {
  featured: RowFile;
  featuredPage: number;
  featuredIsRecent: boolean;
  files: RowFile[];
  accent: string;
  theme: ThemeConfig;
  sectionLabelOf: (s: string) => string;
  openKey: (key: string) => void;
  spotlight: boolean;
  subject: string;
  subjectCode: string;
}) {
  const isDigital = subject === 'digital';
  // Restrained GlareHover (click-mode, opacity 0.32) wraps the featured
  // card for digital + FIS only; other subjects keep the plain card.
  const useGlare = isDigital || subject === 'fis';
  const isResume = featuredPage > 1 || featuredIsRecent;
  const eyebrow = featuredPage > 1
    ? `RESUME · PAGE ${featuredPage}`
    : featuredIsRecent ? 'MOST RECENT' : theme.featStartLabel;
  const meta = `${sectionLabelOf(featured.section).toUpperCase()} · ${featured.pages} PAGES`;
  // Digital MOST RECENT composition (1420 loop): eyebrow / DIGITAL /
  // title / pages·type / CONTINUE READING →
  const digitalMeta = `${featured.pages} PAGES · ${sectionLabelOf(featured.section).toUpperCase()}`;
  const body = (
    <>
      <DocCover
        src={pageImageUrl(featured.subj, featured.file, featuredPage, featured.pages)}
        subj={featured.subj}
        docIndex={files.indexOf(featured) + 1}
        docType={sectionLabelOf(featured.section)}
        title={featured.title}
        seed={featured.key}
        className="msi-feat-thumb"
      />
      <span className="msi-feat-body">
        {isDigital ? (
          <>
            <span className={`msi-feat-eyebrow${isResume ? ' quiet' : ''}`}>{eyebrow}</span>
            <span className="msi-feat-subj">{subjectCode}</span>
            <span className="msi-feat-title">{featured.title}</span>
            <span className="msi-feat-meta">{digitalMeta}</span>
            <span className="msi-feat-cta">{isResume ? 'CONTINUE READING →' : 'OPEN DOCUMENT →'}</span>
          </>
        ) : (
          <>
            <span className="msi-feat-eyebrow">{eyebrow}</span>
            <span className="msi-feat-title">{featured.title}</span>
            <span className="msi-feat-meta">{meta}</span>
            <span className="msi-feat-cta">OPEN →</span>
          </>
        )}
      </span>
    </>
  );
  const card = (
    <button
      type="button"
      className="msi-feat"
      onClick={() => openKey(featured.key)}
      aria-label={`Open ${featured.title}, page ${featuredPage}`}
    >
      {spotlight ? (
        <SpotlightCard
          className="msi-feat-spot"
          spotlightColor={accent}
          intensity={0.3}
          spotlightSize={170}
          softness={0.75}
          borderGlow={0.5}
          proximity={70}
          flare={false}
          grain={0}
          theme="dark"
        >
          {body}
        </SpotlightCard>
      ) : (
        <span className="msi-feat-spot msi-feat-static">{body}</span>
      )}
    </button>
  );
  return useGlare ? (
    <GlareHover
      mode="click"
      glareColor="#ffffff"
      glareOpacity={0.32}
      transitionDuration={550}
      className="msi-feat-glare"
    >
      {card}
    </GlareHover>
  ) : card;
}

interface Props {
  subject: string;
  subjectCode: string;
  accent: string;
  files: RowFile[];
  sectionLabelOf: (section: string) => string;
  bookmarks: string[];
  toggleBookmark: (key: string) => void;
  openReader: (key: string, list: string[]) => void;
  /** most-recently-opened keys first (kl:recent), for the featured pick */
  recentKeys: string[];
  reducedMotion: boolean;
  /** optional back affordance (parent hides its own library header here) */
  onBack?: () => void;
  /** run a real library search (FIS hero questions) */
  onSearchQuery?: (q: string) => void;
  /** collection navigator: jump to another subject's index */
  onOpenSubject?: (subj: string) => void;
}

export default function MobileSubjectIndex({
  subject, subjectCode, accent, files,
  sectionLabelOf, bookmarks, toggleBookmark, openReader, recentKeys, reducedMotion, onBack,
  onSearchQuery, onOpenSubject,
}: Props) {
  const theme = THEMES[subject] || THEMES.em2;
  const [activeSection, setActiveSection] = useState('all');

  // filter resets when the subject changes
  useEffect(() => { setActiveSection('all'); }, [subject]);

  // distinct document types = distinct real sections (never invented)
  const typeCount = useMemo(() => new Set(files.map(f => f.section)).size, [files]);

  // real per-section categories with real counts, first-appearance order
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of files) map.set(f.section, (map.get(f.section) || 0) + 1);
    return [...map.entries()];
  }, [files]);

  // featured = most recently opened doc in this subject, else the curated
  // pick for the subject, else the first non-internal title (Round C P0:
  // never an internal/working title as editorial content)
  const { featured, featuredIsRecent } = useMemo(() => {
    if (files.length === 0) return { featured: null, featuredIsRecent: false };
    const byKey = new Map(files.map(f => [f.key, f]));
    for (const k of recentKeys) {
      const f = byKey.get(k);
      if (f) return { featured: f, featuredIsRecent: true };
    }
    const stem = CURATED_FEATURED[subject];
    if (stem) {
      const pick = files.find(f => f.file === stem);
      if (pick) return { featured: pick, featuredIsRecent: false };
    }
    const clean = files.find(f => !INTERNAL_TITLE_RE.test(f.title));
    return { featured: clean ?? files[0], featuredIsRecent: false };
  }, [files, recentKeys, subject]);

  const featuredPage = useMemo(() => {
    if (!featured) return 1;
    try {
      const saved = parseInt(localStorage.getItem(posKey(featured.key)) || '1', 10) || 1;
      return Math.min(Math.max(1, saved), featured.pages || 1);
    } catch { return 1; }
  }, [featured]);

  // Round C P0: the featured document is part of the collection — it stays
  // in the list, so the header count and the list count always agree.
  const filtered = activeSection === 'all' ? files : files.filter(f => f.section === activeSection);
  const openKey = (key: string) => openReader(key, files.map(r => r.key));

  // Subject-matched Aurora (Round B 2026-11-04, 1420 loop): low, slow,
  // limited height, NO mouse interaction — ONE bg effect per screen.
  // Digital = teal, FIS = bronze.
  const auroraStops = subject === 'digital'
    ? ['#0B4F4A', '#0E7C72', '#123B45']
    : subject === 'fis'
      ? ['#5A3D1E', '#8A5A24', '#3A2A16']
      : null;
  const useBlurHeadline = subject === 'digital' || subject === 'fis';

  const animProps = {
    distance: 18,
    duration: 0.45,
    ease: 'power3.out',
    once: true,
    trigger: 'scroll' as const,
    container: '#kl-mobile-scroll',
  };

  return (
    <div className="msi" data-subject={subject} key={subject} style={{ ['--subject-accent' as any]: accent }}>
      {onBack && (
        <button className="msi-back" onClick={onBack} aria-label="Back to all documents">
          ‹ LIBRARY
        </button>
      )}

      {/* subject header: subject-matched Aurora (digital teal / fis bronze)
          behind the editorial block — low, slow, limited height */}
      <div className="msi-head">
        {!reducedMotion && auroraStops && (
          <div className="msi-veil" aria-hidden="true">
            <Aurora
              colorStops={auroraStops}
              amplitude={0.3}
              blend={0.8}
              height={0.5}
              speed={0.12}
              scale={1.1}
              glow={0.3}
              layers={2}
              opacity={0.35}
              mouseInteraction={false}
            />
          </div>
        )}
        {/* FIS only: subtle film grain over the dark amber header surface
            (behind text — covers and text stay crisp) */}
        {subject === 'fis' && <Noise opacity={0.05} className="msi-noise" />}
        <span className="msi-badge">{theme.badge}</span>
        {reducedMotion ? (
          <h2 className="msi-headline">{theme.headline}</h2>
        ) : useBlurHeadline ? (
          <BlurText
            className="msi-headline"
            text={theme.headline}
            animateBy="words"
            direction="top"
            trigger="load"
            loop={false}
            delay={90}
            stepDuration={0.4}
            blur={7}
            distance={30}
          />
        ) : (
          <ScrollReveal
            containerClassName="msi-headline"
            textClassName="msi-headline"
          >
            {theme.headline}
          </ScrollReveal>
        )}
        <p className="msi-lede">{theme.lede}</p>
      </div>

      {/* FIS question cards: editorial entries with REAL descriptions from
          the PDF contents (Round B 2026-11-04, 1420 loop). Tappable → each
          runs a real library search. */}
      {subject === 'fis' && (
        <div className="msi-qcards" role="group" aria-label="Start with a question">
          {FIS_QUESTIONS.map((qc, i) => (
            <button
              type="button"
              key={qc.q}
              className="msi-qcard"
              onClick={() => onSearchQuery?.(qc.q)}
              aria-label={`${qc.q} — explore the collection`}
            >
              <span className="msi-qcard-num" aria-hidden="true">Q.{String(i + 1).padStart(2, '0')}</span>
              <span className="msi-qcard-q">{qc.q}</span>
              <span className="msi-qcard-desc">{qc.desc}</span>
              <span className="msi-qcard-foot">
                <span className="msi-qcard-meta">{qc.meta}</span>
                <span className="msi-qcard-go" aria-hidden="true">EXPLORE →</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* FIS editorial feature (single, static) replaces the generic
          artwork band; its entry transition is the dedicated CSS
          (msi-fis-*, 500–700ms, no replay) — never the generic
          AnimatedContent wrapper. Other subjects keep their signature
          artwork (digital: upgraded circuit). */}
      {subject === 'fis' && theme.questions ? (
        <BigQuestionsCard accent={accent} questions={theme.questions} onSearchQuery={onSearchQuery} />
      ) : reducedMotion ? (
        <SubjectArtwork subject={subject} accent={accent} animated={false} />
      ) : (
        <AnimatedContent {...animProps}>
          <SubjectArtwork subject={subject} accent={accent} animated />
        </AnimatedContent>
      )}

      {subject !== 'fis' && (
        <p className="msi-meta">{files.length} DOCUMENTS · {typeCount} TYPES</p>
      )}

      {categories.length > 1 && (
        <div className="msi-cats">
          <p className="msi-cats-label">BROWSE BY TYPE</p>
          <div className="msi-chips" role="group" aria-label="Filter documents by type">
            <button
              type="button"
              className={`msi-chip${activeSection === 'all' ? ' on' : ''}`}
              onClick={() => setActiveSection('all')}
              aria-pressed={activeSection === 'all'}
            >
              ALL · {files.length}
            </button>
            {categories.map(([sec, n]) => (
              <button
                type="button"
                key={sec}
                className={`msi-chip${activeSection === sec ? ' on' : ''}`}
                onClick={() => setActiveSection(sec)}
                aria-pressed={activeSection === sec}
              >
                {sectionLabelOf(sec).toUpperCase()} · {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FIS: the meta strip is a connecting strip between the filter
          chips and the archive (fine rules top/bottom in CSS) */}
      {subject === 'fis' && (
        <p className="msi-meta">{files.length} DOCUMENTS · {typeCount} TYPES</p>
      )}

      {featured && (
        reducedMotion ? (
          <FeaturedCard
            featured={featured}
            featuredPage={featuredPage}
            featuredIsRecent={featuredIsRecent}
            files={files}
            accent={accent}
            theme={theme}
            sectionLabelOf={sectionLabelOf}
            openKey={openKey}
            spotlight={false}
            subject={subject}
            subjectCode={subjectCode}
          />
        ) : (
          <AnimatedContent {...animProps}>
            <FeaturedCard
              featured={featured}
              featuredPage={featuredPage}
              featuredIsRecent={featuredIsRecent}
              files={files}
              accent={accent}
              theme={theme}
              sectionLabelOf={sectionLabelOf}
              openKey={openKey}
              spotlight
              subject={subject}
              subjectCode={subjectCode}
            />
          </AnimatedContent>
        )
      )}

      <div className="msi-listhead">
        <span className="msi-eyebrow">{theme.listLabel}</span>
        <span className="msi-eyebrow dim">{filtered.length} DOCUMENTS</span>
      </div>
      <div className="msi-list">
        <RowStagger>
          {filtered.map((f, i) => (
            <MobileDocRow
              key={f.key}
              f={f}
              index={i}
              accent={accent}
              subjectCode={subjectCode}
              sectionLabel={sectionLabelOf(f.section)}
              bookmarked={bookmarks.includes(f.key)}
              showSubject={false}
              onOpen={() => openKey(f.key)}
              onToggleBookmark={() => toggleBookmark(f.key)}
            />
          ))}
        </RowStagger>
      </div>
      <p className="msi-hint">SWIPE A ROW LEFT TO BOOKMARK</p>

      {/* collection navigator: explore the other collections (1420 loop) */}
      {onOpenSubject && (
        <div className="msi-nav">
          <p className="msi-nav-label">EXPLORE OTHER COLLECTIONS</p>
          <div className="msi-nav-row">
            {SUBJECTS.filter(s => s.id !== subject).map(s => (
              <button
                key={s.id}
                type="button"
                className="msi-nav-btn"
                style={{ ['--sc' as any]: s.color }}
                onClick={() => onOpenSubject(s.id)}
                aria-label={`Open the ${s.name} collection`}
              >
                <span className="msi-nav-code" style={{ color: s.color }}>{s.code}</span>
                <span className="msi-nav-name">{s.short}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
