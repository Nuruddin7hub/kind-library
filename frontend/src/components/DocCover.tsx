// K/IND mobile engine — DocCover (ChatGPT Round C rebuild, 2026-11-04).
//
// Generative document-cover system: every document gets a distinct cover
// built from a consistent system — subject colour + large document number +
// a unique diagram/mathematical mark + a short title fragment. Deterministic
// per document (hash of the doc key): the same document always gets the same
// cover, so the library reads as a curated archive of 100 distinct
// documents. Never alters titles (the fragment is a substring of the real
// title) and never invents contents (marks are abstract subject motifs).
//
// The server-rendered page thumbnail still fades in OVER the generative
// cover once loaded — covers that prefer the real page image keep it; the
// generative tile is never blank, not while loading, not on failure.
// Mobile only; desktop untouched.

import { useState } from 'react';
import { subjectOf } from '../shared';
import './DocCover.css';

/** djb2 — deterministic motif pick per document. */
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Short title fragment: first two words of the REAL title, uppercase,
 *  hard-capped — a substring, never rewritten. */
function titleFragment(title?: string): string {
  if (!title) return '';
  const frag = title.trim().split(/\s+/).slice(0, 2).join(' ');
  return frag.length > 16 ? `${frag.slice(0, 15).trimEnd()}…` : frag;
}

/* ---------- abstract subject motifs (decorative only) ---------- */

function Em2Mark({ i }: { i: number }) {
  const glyphs = ['∫', 'Σ', 'π', 'Δ', '∂', 'φ', 'λ', '∞'];
  return (
    <text x="24" y="35" textAnchor="middle" fontSize="34" fill="currentColor"
      fontFamily="'Instrument Serif', Georgia, serif">
      {glyphs[i % glyphs.length]}
    </text>
  );
}

function SignalsMark({ i }: { i: number }) {
  const paths = [
    'M4 24 C10 6 16 6 22 24 S34 42 40 24 S48 12 52 24',           // sine
    'M4 34 H14 V14 H24 V34 H34 V14 H44',                            // square
    'M4 24 H22 M24 8 V40 M26 8 V40 M28 24 H44',                     // impulse
    'M4 36 L14 12 L24 36 L34 12 L44 36',                           // triangle
    'M4 24 C12 24 14 10 22 10 C30 10 32 24 40 24 S46 34 52 30',     // damped
    'M6 34 V14 M6 24 H42 M36 18 L44 24 L36 30',                     // arrow axis
  ];
  return (
    <path d={paths[i % paths.length]} fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  );
}

function FisMark({ i }: { i: number }) {
  const glyphs = ['?', '§', '∞', '∴', '◊', '¶'];
  return (
    <text x="24" y="35" textAnchor="middle" fontSize="32" fill="currentColor"
      fontFamily="'Instrument Serif', Georgia, serif">
      {glyphs[i % glyphs.length]}
    </text>
  );
}

function DigitalMark({ i }: { i: number }) {
  const gates = [
    // AND
    <g key="and" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M14 10 H24 A14 14 0 0 1 24 38 H14 Z" />
      <line x1="6" y1="17" x2="14" y2="17" /><line x1="6" y1="31" x2="14" y2="31" />
      <line x1="38" y1="24" x2="44" y2="24" />
    </g>,
    // OR
    <g key="or" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M10 8 C18 16 18 32 10 40 C22 36 34 32 38 24 C34 16 22 12 10 8 Z" />
      <line x1="4" y1="17" x2="12" y2="17" /><line x1="4" y1="31" x2="12" y2="31" />
      <line x1="38" y1="24" x2="44" y2="24" />
    </g>,
    // NOT
    <g key="not" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M10 12 L32 24 L10 36 Z" />
      <circle cx="36" cy="24" r="3.4" />
      <line x1="4" y1="24" x2="10" y2="24" /><line x1="39" y1="24" x2="45" y2="24" />
    </g>,
    // XOR-ish curves
    <g key="xor" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M8 8 C16 16 16 32 8 40" />
      <path d="M14 8 C24 16 24 32 14 40 C26 36 36 32 40 24 C36 16 26 12 14 8 Z" />
    </g>,
    // flip-flop box
    <g key="ff" fill="none" stroke="currentColor" strokeWidth="2.4">
      <rect x="10" y="12" width="28" height="24" rx="2" />
      <path d="M4 18 L10 18 L10 24 L4 24" />
      <line x1="38" y1="24" x2="44" y2="24" />
      <text x="24" y="30" textAnchor="middle" fontSize="11" fill="currentColor" stroke="none"
        fontFamily="'IBM Plex Mono', monospace">Q</text>
    </g>,
    // trace + via
    <g key="tr" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M4 36 H20 L30 26 H44" />
      <circle cx="4" cy="36" r="3.2" /><circle cx="44" cy="26" r="3.2" />
      <circle cx="30" cy="26" r="2" fill="currentColor" stroke="none" />
    </g>,
  ];
  return gates[i % gates.length];
}

function CoverMark({ subj, seed }: { subj: string; seed: string }) {
  const i = hashSeed(seed || subj);
  return (
    <svg className="doc-cover-gen-mark" viewBox="0 0 48 48" aria-hidden="true">
      {subj === 'em2' && <Em2Mark i={i} />}
      {subj === 'signals' && <SignalsMark i={i} />}
      {subj === 'fis' && <FisMark i={i} />}
      {subj === 'digital' && <DigitalMark i={i} />}
      {!['em2', 'signals', 'fis', 'digital'].includes(subj) && <Em2Mark i={i} />}
    </svg>
  );
}

interface DocCoverProps {
  /** full <img> src of the page thumbnail (may be null → generative tile only) */
  src: string | null;
  /** subject id (em2 | signals | fis | digital) for brand color */
  subj: string;
  /** doc index within the list (1-based number shown large on the tile) */
  docIndex?: number;
  /** doc type label (e.g. "LECTURES") shown on the tile */
  docType?: string;
  /** real document title — a short fragment is set on the tile */
  title?: string;
  /** stable per-document seed (doc key) for the deterministic motif */
  seed?: string;
  /** sizing class from the caller (width/height/border-radius) */
  className?: string;
  eager?: boolean;
}

/** Generative cover tile: subject colour + large document number + unique
 *  diagram/mathematical mark + short title fragment. Never blank. */
export function CoverFallback({
  subj, docIndex, docType, title, seed, className,
}: {
  subj: string; docIndex?: number; docType?: string; title?: string;
  seed?: string; className?: string;
}) {
  const s = subjectOf(subj);
  const color = s ? s.color : '#929DAE';
  const code = s ? s.code : subj.toUpperCase();
  const frag = titleFragment(title);
  return (
    <span
      className={`doc-cover-fallback${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{ ['--cover-c' as any]: color }}
    >
      <CoverMark subj={subj} seed={seed ?? `${subj}-${docIndex ?? 0}`} />
      <span className="doc-cover-fallback-num">
        {docIndex != null ? String(docIndex).padStart(2, '0') : '·'}
      </span>
      {frag && <span className="doc-cover-fallback-frag">{frag}</span>}
      <span className="doc-cover-fallback-code">{code}</span>
      {docType && <span className="doc-cover-fallback-type">{docType.toUpperCase()}</span>}
    </span>
  );
}

export default function DocCover({
  src, subj, docIndex, docType, title, seed, className, eager,
}: DocCoverProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`doc-cover${className ? ` ${className}` : ''}`} aria-hidden="true">
      <CoverFallback
        subj={subj}
        docIndex={docIndex}
        docType={docType}
        title={title}
        seed={seed}
        className="doc-cover-under"
      />
      {src && !failed && (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`doc-cover-img${loaded ? ' in' : ''}`}
        />
      )}
    </span>
  );
}
