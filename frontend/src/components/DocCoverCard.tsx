// K/IND Library — generative document cover (Obsidian Atlas v3.0,
// ChatGPT Round A 2026-11-04 ~14:20). Desktop library grid only.
//
// Signature template for all 100 docs: thin subject-color top-edge accent,
// doc type, doc identifier, page count, and UNIQUE abstract discipline
// artwork — every document gets a deterministic variation (seeded by its
// stable key), so the library reads as a curated archive of 100 distinct
// documents. The full title + metadata live UNDER the cover in the card
// body, never on the artwork. REAL metadata only — titles never altered,
// contents never invented.

import type { CSSProperties, ReactNode } from 'react';
import { sectionLabel, subjectOf, v2SubjectColor } from '../shared';

interface DocCoverCardProps {
  subj: string;
  title: string; // kept for API compatibility; rendered under the cover, not on it
  section: string;
  pages: number;
  /** stable 1-based number of this doc within its subject */
  docNo: number;
  /** stable per-document seed (doc key) — same doc → same cover, always */
  seed?: string;
}

/** djb2 — deterministic seed per document. */
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/* ---------------- abstract discipline artwork (original SVG) ---------------- */

/** FIS — classical forms: stone arch, column orders, ivory/gold on dark. */
function ArtFIS(): ReactNode {
  return (
    <svg viewBox="0 0 200 266" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M 30 250 A 70 70 0 0 1 170 250" fill="none" strokeWidth={1.6} className="dc-art-stroke" />
      <path d="M 48 250 A 52 52 0 0 1 152 250" fill="none" strokeWidth={1} className="dc-art-faint" />
      {[62, 100, 138].map(x => (
        <g key={x}>
          <line x1={x - 7} y1={250} x2={x - 7} y2={120} strokeWidth={2} className="dc-art-stroke" />
          <line x1={x + 7} y1={250} x2={x + 7} y2={120} strokeWidth={2} className="dc-art-stroke" />
          <line x1={x - 12} y1={120} x2={x + 12} y2={120} strokeWidth={2.4} className="dc-art-stroke" />
          <line x1={x - 12} y1={250} x2={x + 12} y2={250} strokeWidth={2.4} className="dc-art-stroke" />
        </g>
      ))}
      <circle cx={100} cy={58} r={20} fill="none" strokeWidth={1.4} className="dc-art-stroke" />
      <circle cx={100} cy={58} r={27} fill="none" strokeWidth={1} className="dc-art-faint" strokeDasharray="3 5" />
      <path d="M 24 96 Q 40 84 58 92" fill="none" strokeWidth={1.2} className="dc-art-faint" />
      <path d="M 176 96 Q 160 84 142 92" fill="none" strokeWidth={1.2} className="dc-art-faint" />
      <text x={100} y={216} textAnchor="middle" fontSize={34} className="dc-art-serif dc-art-faint">Φ</text>
    </svg>
  );
}

/** EM2 — geometric: coordinate field, parabola, axes, tangent (technical blue). */
function ArtEM2(): ReactNode {
  const grid: ReactNode[] = [];
  for (let i = 1; i < 10; i++) {
    grid.push(<line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={266} className="dc-art-faint" strokeWidth={1} />);
    grid.push(<line key={`h${i}`} x1={0} y1={i * 26} x2={200} y2={i * 26} className="dc-art-faint" strokeWidth={1} />);
  }
  return (
    <svg viewBox="0 0 200 266" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {grid}
      <line x1={18} y1={240} x2={182} y2={240} strokeWidth={1.6} className="dc-art-stroke" />
      <line x1={30} y1={250} x2={30} y2={14} strokeWidth={1.6} className="dc-art-stroke" />
      <path d="M 30 240 Q 95 240 105 120 T 182 40" fill="none" strokeWidth={2.6} className="dc-art-stroke" />
      <path d="M 30 232 Q 100 232 128 150" fill="none" strokeWidth={1.4} className="dc-art-faint" strokeDasharray="5 4" />
      <line x1={70} y1={170} x2={150} y2={120} strokeWidth={1.2} className="dc-art-faint" />
      <circle cx={105} cy={120} r={4.5} className="dc-art-dot" />
      <circle cx={150} cy={120} r={3} className="dc-art-dot" opacity={0.6} />
      <path d="M 128 210 q 14 -34 30 -38" fill="none" strokeWidth={1.4} className="dc-art-faint" />
    </svg>
  );
}

/** Signals — waveforms & frequency traces (violet energy). */
function ArtSignals(): ReactNode {
  const bars = [30, 62, 46, 84, 110, 74, 96, 56, 38, 68, 88, 50];
  return (
    <svg viewBox="0 0 200 266" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {bars.map((h, i) => (
        <rect key={i} x={14 + i * 15} y={250 - h} width={9} height={h} rx={2}
          className="dc-art-bar" opacity={0.28 + (h / 110) * 0.5} />
      ))}
      <path d="M 8 150 C 40 90, 70 90, 100 150 S 160 210, 192 150"
        fill="none" strokeWidth={2.6} className="dc-art-stroke" />
      <path d="M 8 168 C 50 128, 90 128, 120 168 S 170 205, 192 168"
        fill="none" strokeWidth={1.3} className="dc-art-faint" />
      <circle cx={100} cy={52} r={26} fill="none" strokeWidth={1.2} className="dc-art-faint" strokeDasharray="4 5" />
      <circle cx={100} cy={52} r={5} className="dc-art-dot" />
      <path d="M 100 26 v 10 M 100 68 v 10 M 74 52 h 10 M 116 52 h 10" strokeWidth={1.2} className="dc-art-faint" />
    </svg>
  );
}

/** Digital — circuit diagrams & logic gates (turquoise traces). */
function ArtDigital(): ReactNode {
  return (
    <svg viewBox="0 0 200 266" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M 16 230 L 70 230 L 88 212 L 140 212 L 158 194 L 186 194"
        fill="none" strokeWidth={2.2} className="dc-art-stroke" />
      <path d="M 16 60 L 52 60 L 70 78 L 130 78" fill="none" strokeWidth={1.5} className="dc-art-faint" />
      <path d="M 158 236 L 158 216 L 184 216" fill="none" strokeWidth={1.5} className="dc-art-faint" />
      <path d="M 96 150 h 28 a 16 16 0 0 1 0 32 h -28 z" fill="none" strokeWidth={1.8} className="dc-art-stroke" />
      <path d="M 40 108 q 0 22 20 22 q 20 0 20 -22" fill="none" strokeWidth={1.4} className="dc-art-faint" />
      <rect x={30} y={140} width={26} height={26} rx={3} fill="none" strokeWidth={1.4} className="dc-art-faint" />
      {[
        [16, 230], [88, 212], [140, 212], [186, 194],
        [16, 60], [70, 78], [130, 78], [158, 236], [184, 216], [96, 150], [96, 182]
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={4.6} fill="none" strokeWidth={1.8} className="dc-art-stroke" />
          <circle cx={x} cy={y} r={1.7} className="dc-art-dot" />
        </g>
      ))}
      <line x1={124} y1={166} x2={152} y2={166} strokeWidth={1.4} className="dc-art-faint" />
      <circle cx={160} cy={166} r={3.4} fill="none" strokeWidth={1.4} className="dc-art-stroke" />
    </svg>
  );
}

const ART: Record<string, () => ReactNode> = {
  em2: ArtEM2,
  signals: ArtSignals,
  fis: ArtFIS,
  digital: ArtDigital,
};

/** Large faint discipline glyphs — one per cover, seeded. */
const GLYPHS: Record<string, string[]> = {
  em2: ['∫', 'Σ', 'π', 'Δ', '∂', 'φ', 'λ', '∞'],
  signals: ['∿', '∼', 'Ω', 'Ψ', 'ƒ', '∫', '∆', '∞'],
  fis: ['?', 'Φ', '§', '∞', '∴', '◊', '¶', 'λ'],
  digital: ['⌗', '⊕', '⊗', '¬', '∧', '∨', '⊻', '◈'],
};

export default function DocCoverCard({ subj, title: _title, section, pages, docNo, seed }: DocCoverCardProps) {
  void _title; // title lives in the card body under the cover (spec) — not on the artwork
  const s = subjectOf(subj);
  const color = v2SubjectColor(subj);
  const code = s?.code ?? subj.toUpperCase();
  const Art = ART[subj] ?? ArtEM2;

  // Deterministic per-document variation: same doc → same cover, always.
  const h = hashSeed(seed ?? `${subj}-${docNo}`);
  const rot = (h % 4) * 90;                    // 0 / 90 / 180 / 270 artwork rotation
  const flip = (h >> 2) % 2 === 1;             // occasional horizontal mirror
  const glyphSet = GLYPHS[subj] ?? GLYPHS.em2;
  const glyph = glyphSet[(h >> 3) % glyphSet.length];
  const gx = 18 + ((h >> 6) % 64);             // glyph x %
  const gy = 30 + ((h >> 12) % 40);            // glyph y %
  const wash = 8 + ((h >> 18) % 10);           // accent wash strength %

  const artTransform = `rotate(${rot} 100 133)${flip ? ' translate(200 0) scale(-1 1)' : ''}`;

  return (
    <div
      className="kiA-doccover"
      style={
        {
          '--kiA-accent': color,
          '--dc-wash': `${wash}%`,
          '--dc-gx': `${gx}%`,
          '--dc-gy': `${gy}%`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="kiA-doccover-edge" />
      <span className="kiA-doccover-art">
        <svg viewBox="0 0 200 266" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g transform={artTransform}>
            <Art />
          </g>
        </svg>
        <span className="kiA-doccover-glyph" aria-hidden="true">{glyph}</span>
      </span>
      <span className="kiA-doccover-scrim" />
      <span className="kiA-doccover-top">
        <span className="kiA-doccover-type">{sectionLabel(section).toUpperCase()}</span>
        <span className="kiA-doccover-id">
          {code}-{String(Math.max(1, docNo)).padStart(2, '0')}
        </span>
      </span>
      <span className="kiA-doccover-foot">
        <span className="kiA-doccover-pages">
          {pages} PAGE{pages === 1 ? '' : 'S'}
        </span>
        <span className="kiA-doccover-code">{code}</span>
      </span>
    </div>
  );
}
