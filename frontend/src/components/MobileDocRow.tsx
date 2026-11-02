// K/IND mobile engine — editorial document row (ChatGPT Round B afternoon, 2026-11-02).
// Compact numbered row (76–88px): ghost number · subject/type micro-label ·
// 2-line title · pages · 48×56 thumb · chevron. Swipe-left reveals the
// bookmark action; tap opens the document; bookmark is independent.

import { useRef, useState } from 'react';

export interface RowFile {
  key: string;
  subj: string;
  title: string;
  section: string;
  file: string;
  pages: number;
}

/** Real server-rendered page thumbnail — mirrors PdfReader's pageImageUrl. */
export function pageImageUrl(subj: string, file: string, page: number, totalPages: number): string {
  const stem = file.replace(/\.pdf$/i, '');
  const digits = String(Math.max(1, totalPages)).length;
  const nn = String(Math.max(1, page)).padStart(digits, '0');
  return `/assets/pages/${subj}/${stem}/p-${nn}.jpg`;
}

interface Props {
  f: RowFile;
  index: number;
  showNumber?: boolean;
  accent: string;
  subjectCode: string;
  sectionLabel: string;
  bookmarked: boolean;
  onOpen: () => void;
  onToggleBookmark: () => void;
}

export default function MobileDocRow({
  f, index, showNumber = true, accent, subjectCode, sectionLabel,
  bookmarked, onOpen, onToggleBookmark,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // vertical gesture → it's a scroll, never hijack it
    if (Math.abs(dy) > 24) { start.current = null; return; }
    if (dx < -48) { setRevealed(true); start.current = null; }
    else if (dx > 48) { setRevealed(false); start.current = null; }
  };

  const open = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation(); // AnimatedList's item click must not double-fire
    onOpen();
  };

  return (
    <div className={`ki-row${revealed ? ' revealed' : ''}`}>
      <div className="ki-row-actions" aria-hidden={!revealed}>
        <button
          className={`ki-row-bm${bookmarked ? ' on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          aria-pressed={bookmarked}
          tabIndex={revealed ? 0 : -1}
        >
          {bookmarked ? '★' : '☆'}
        </button>
      </div>
      <div
        className="ki-row-inner"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onClick={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(e); }}
        aria-label={`Open ${f.title}`}
      >
        {showNumber && (
          <span className="ki-row-num" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        <span className="ki-row-body">
          <span className="ki-row-micro" style={{ color: accent }}>
            {subjectCode} / {sectionLabel.toUpperCase()}
          </span>
          <span className="ki-row-title">{f.title}</span>
          <span className="ki-row-meta">{f.pages} PAGES · PDF</span>
        </span>
        <img
          className="ki-row-thumb"
          src={pageImageUrl(f.subj, f.file, 1, f.pages)}
          alt=""
          loading="lazy"
          draggable={false}
        />
        <span className="ki-row-chev" aria-hidden="true">›</span>
      </div>
    </div>
  );
}
