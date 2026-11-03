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
import { pageImageUrl } from '../shared';
import ScrollReveal from '../bits/ScrollReveal';

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
    lede: 'From gate-level logic to working systems — the hardware made readable.',
    listLabel: 'THE CIRCUIT ARCHIVE',
    featStartLabel: 'START HERE',
  },
};

/** Curated featured picks (Round C P0): genuine entries from real document
 *  metadata — never an internal/working title as editorial content. Matched
 *  by file name; falls back to the recent/first logic below. */
const CURATED_FEATURED: Record<string, string> = {
  digital: 'Dig_Elec_Sep26_Course_Intro__Overview.pdf',
};

/** Titles that read like internal working notes — never featured. */
const INTERNAL_TITLE_RE = /to replace|draft|todo|fixme|untitled|placeholder/i;

/* ---------- per-subject SVG artwork bands (decorative, subtle: ≤0.9 opacity, 1px strokes) ---------- */

function DigitalArt({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 360 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* faint board traces behind the diagram */}
      <path d="M-4 122 H60 L96 86 H150" fill="none" stroke={accent} strokeWidth="1" opacity="0.28" />
      <path d="M-4 12 H70 L104 46" fill="none" stroke={accent} strokeWidth="1" opacity="0.22" />
      {/* labelled AND gate: inputs A, B → output Y */}
      <line x1="20" y1="56" x2="52" y2="56" stroke={accent} strokeWidth="1.5" opacity="0.9" />
      <line x1="20" y1="88" x2="52" y2="88" stroke={accent} strokeWidth="1.5" opacity="0.9" />
      <path d="M52 42 H88 A30 30 0 0 1 88 102 H52 Z" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.95" />
      <line x1="118" y1="72" x2="152" y2="72" stroke={accent} strokeWidth="1.5" opacity="0.9" />
      <circle cx="20" cy="56" r="3" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.9" />
      <circle cx="20" cy="88" r="3" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.9" />
      <circle cx="152" cy="72" r="3" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.9" />
      <text x="6" y="60" fontFamily="var(--font-mono)" fontSize="11" fill={accent} opacity="0.95">A</text>
      <text x="6" y="92" fontFamily="var(--font-mono)" fontSize="11" fill={accent} opacity="0.95">B</text>
      <text x="160" y="76" fontFamily="var(--font-mono)" fontSize="11" fill={accent} opacity="0.95">Y</text>
      <text x="54" y="30" fontFamily="var(--font-mono)" fontSize="9" fill="#ffffff" opacity="0.5">AND</text>
      {/* truth table: the gate's behaviour, stated plainly */}
      <text x="212" y="30" fontFamily="var(--font-mono)" fontSize="9" fill="#ffffff" opacity="0.55">A B │ Y</text>
      <text x="212" y="50" fontFamily="var(--font-mono)" fontSize="10" fill={accent} opacity="0.9">0 0 │ 0</text>
      <text x="212" y="68" fontFamily="var(--font-mono)" fontSize="10" fill={accent} opacity="0.9">0 1 │ 0</text>
      <text x="212" y="86" fontFamily="var(--font-mono)" fontSize="10" fill={accent} opacity="0.9">1 0 │ 0</text>
      <text x="212" y="104" fontFamily="var(--font-mono)" fontSize="10" fill={accent} opacity="0.9">1 1 │ 1</text>
      <text x="286" y="122" fontFamily="var(--font-mono)" fontSize="9" fill="#ffffff" opacity="0.45">Y = A · B</text>
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

function SubjectArtwork({ subject, accent }: { subject: string; accent: string }) {
  return (
    <div className="msi-art" aria-hidden="true">
      {subject === 'digital' && <DigitalArt accent={accent} />}
      {subject === 'fis' && <FisArt accent={accent} />}
      {subject === 'em2' && <Em2Art accent={accent} />}
      {subject === 'signals' && <SignalsArt accent={accent} />}
    </div>
  );
}

const posKey = (k: string) => `kl:pos:${k}`;

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
}

export default function MobileSubjectIndex({
  subject, subjectCode, accent, files,
  sectionLabelOf, bookmarks, toggleBookmark, openReader, recentKeys, reducedMotion, onBack,
  onSearchQuery,
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

  return (
    <div className="msi mobile-page" data-subject={subject} style={{ ['--subject-accent' as any]: accent }}>
      {onBack && (
        <button className="msi-back" onClick={onBack} aria-label="Back to all documents">
          ‹ LIBRARY
        </button>
      )}
      <span className="msi-badge">{theme.badge}</span>
      {reducedMotion ? (
        <h2 className="msi-headline">{theme.headline}</h2>
      ) : (
        <ScrollReveal
          containerClassName="msi-headline"
          textClassName="msi-headline"
        >
          {theme.headline}
        </ScrollReveal>
      )}
      <p className="msi-lede">{theme.lede}</p>

      {/* FIS hero questions: tappable, each runs a real library search */}
      {theme.questions && onSearchQuery && (
        <div className="msi-questions" role="group" aria-label="Start with a question">
          {theme.questions.map(q => (
            <button
              type="button"
              key={q}
              className="msi-question"
              onClick={() => onSearchQuery(q)}
            >
              <span className="msi-question-q">{q}</span>
              <span className="msi-question-go" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}

      <SubjectArtwork subject={subject} accent={accent} />

      <p className="msi-meta">{files.length} DOCUMENTS · {typeCount} TYPES</p>

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

      {featured && (
        <button
          type="button"
          className="msi-feat"
          onClick={() => openKey(featured.key)}
          aria-label={`Open ${featured.title}, page ${featuredPage}`}
        >
          <DocCover
            src={pageImageUrl(featured.subj, featured.file, featuredPage, featured.pages)}
            subj={featured.subj}
            docIndex={files.indexOf(featured) + 1}
            docType={sectionLabelOf(featured.section)}
            className="msi-feat-thumb"
          />
          <span className="msi-feat-body">
            <span className="msi-feat-eyebrow">
              {featuredPage > 1
                ? `RESUME · PAGE ${featuredPage}`
                : featuredIsRecent ? 'MOST RECENT' : theme.featStartLabel}
            </span>
            <span className="msi-feat-title">{featured.title}</span>
            <span className="msi-feat-meta">
              {sectionLabelOf(featured.section).toUpperCase()} · {featured.pages} PAGES
            </span>
            <span className="msi-feat-cta">OPEN →</span>
          </span>
        </button>
      )}

      <div className="msi-listhead">
        <span className="msi-eyebrow">{theme.listLabel}</span>
        <span className="msi-eyebrow dim">{filtered.length} ITEMS</span>
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
              onOpen={() => openKey(f.key)}
              onToggleBookmark={() => toggleBookmark(f.key)}
            />
          ))}
        </RowStagger>
      </div>
      <p className="msi-hint">SWIPE A ROW LEFT TO BOOKMARK</p>
    </div>
  );
}
