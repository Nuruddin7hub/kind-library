// K/IND mobile engine — DocCover (ChatGPT Round B P0, 2026-11-03).
// A document cover that is NEVER blank: the subject-branded fallback tile
// (3:4, subject radial glow, subject color, doc index, doc type) renders
// UNDERNEATH at all times; the server-rendered page thumbnail fades in over
// it once loaded. Missing/failed images simply leave the branded tile.
// Mobile only; desktop untouched.

import { useState } from 'react';
import { subjectOf } from '../shared';
import './DocCover.css';

interface DocCoverProps {
  /** full <img> src of the page thumbnail (may be null → tile only) */
  src: string | null;
  /** subject id (em2 | signals | fis | digital) for brand color */
  subj: string;
  /** doc index within the list (1-based number shown on the tile) */
  docIndex?: number;
  /** doc type label (e.g. "LECTURES") shown on the tile */
  docType?: string;
  /** sizing class from the caller (width/height/border-radius) */
  className?: string;
  eager?: boolean;
}

/** Generated subject-branded tile: radial glow in the subject color,
 *  doc index + type — never a blank box. */
export function CoverFallback({
  subj, docIndex, docType, className,
}: {
  subj: string; docIndex?: number; docType?: string; className?: string;
}) {
  const s = subjectOf(subj);
  const color = s ? s.color : '#929DAE';
  const code = s ? s.code : subj.toUpperCase();
  return (
    <span
      className={`doc-cover-fallback${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{ ['--cover-c' as any]: color }}
    >
      <span className="doc-cover-fallback-num">
        {docIndex != null ? String(docIndex).padStart(2, '0') : '·'}
      </span>
      <span className="doc-cover-fallback-code">{code}</span>
      {docType && <span className="doc-cover-fallback-type">{docType.toUpperCase()}</span>}
    </span>
  );
}

export default function DocCover({
  src, subj, docIndex, docType, className, eager,
}: DocCoverProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`doc-cover${className ? ` ${className}` : ''}`} aria-hidden="true">
      <CoverFallback
        subj={subj}
        docIndex={docIndex}
        docType={docType}
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
