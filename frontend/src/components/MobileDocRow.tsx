// K/IND mobile engine — document row (ChatGPT Round B P0 rework, 2026-11-03).
// 88px rows, grid 48px cover / 1fr title / 24px chevron. 48px 3:4 covers via
// <DocCover> (never blank — subject-branded fallback). Single metadata line
// in IBM Plex Mono. Whole row tappable; swipe-left reveals bookmark;
// long-press (clean: no scroll, <10px drift) opens a bookmark/share menu.
// Mobile only; desktop untouched.

import { useRef, useState } from 'react';
import DocCover from './DocCover';
import { pageImageUrl } from '../shared';
import './DocCover.css';

export interface RowFile {
  key: string;
  subj: string;
  title: string;
  section: string;
  file: string;
  pages: number;
}

interface Props {
  f: RowFile;
  index: number;
  accent: string;
  subjectCode: string;
  sectionLabel: string;
  bookmarked: boolean;
  /** real study state: "CONTINUE P.12" / "OPENED 2H AGO" — never invented */
  studyState?: string | null;
  onOpen: () => void;
  onToggleBookmark: () => void;
}

export default function MobileDocRow({
  f, index, accent, subjectCode, sectionLabel,
  bookmarked, studyState, onOpen, onToggleBookmark,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPress = useRef<number | null>(null);
  const moved = useRef(false);

  const clearPress = () => {
    if (longPress.current) { window.clearTimeout(longPress.current); longPress.current = null; }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    moved.current = false;
    // long-press: 550ms, <10px drift, no scroll → bookmark/share menu
    longPress.current = window.setTimeout(() => {
      if (!moved.current) {
        setMenuOpen(true);
        try { navigator.vibrate?.(12); } catch { /* ignore */ }
      }
      longPress.current = null;
    }, 550);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      moved.current = true;
      clearPress();
    }
    // vertical gesture → it's a scroll, never hijack it
    if (Math.abs(dy) > 24) { start.current = null; return; }
    if (dx < -48) { setRevealed(true); start.current = null; }
    else if (dx > 48) { setRevealed(false); start.current = null; }
  };

  const onTouchEnd = () => { clearPress(); start.current = null; };

  const open = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation(); // AnimatedList's item click must not double-fire
    if (menuOpen) return; // a long-press menu tap must not also open the doc
    onOpen();
  };

  const share = async () => {
    const payload = { title: f.title, text: `${subjectCode} · ${f.title}` };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${payload.text}`);
        setShared(true);
        window.setTimeout(() => setShared(false), 1600);
      }
    } catch { /* dismissed — nothing to do */ }
    setMenuOpen(false);
  };

  const coverSrc = f.file
    ? pageImageUrl(f.subj, f.file, 1, f.pages)
    : null;

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
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(e); }}
        aria-label={`Open ${f.title}`}
      >
        <span className="ki-row-cover" aria-hidden="true">
          <DocCover
            src={coverSrc}
            subj={f.subj}
            docIndex={index + 1}
            docType={sectionLabel}
            className="ki-row-coverimg"
          />
        </span>
        <span className="ki-row-body">
          <span className="ki-row-micro" style={{ color: accent }}>
            {subjectCode} / {sectionLabel.toUpperCase()}
          </span>
          <span className="ki-row-title">{f.title}</span>
          <span className="ki-row-meta">
            {f.pages} PAGES · PDF{studyState ? ` · ${studyState}` : ''}
          </span>
        </span>
        <span className="ki-row-chev" aria-hidden="true">›</span>
      </div>

      {/* long-press menu: bookmark + share (44px+ targets) */}
      {menuOpen && (
        <div className="ki-row-menuwrap" onClick={() => setMenuOpen(false)}>
          <div
            className="ki-row-menu"
            role="menu"
            aria-label={`Actions for ${f.title}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="ki-row-menu-btn"
              onClick={() => { onToggleBookmark(); setMenuOpen(false); }}
            >
              {bookmarked ? '★ REMOVE BOOKMARK' : '☆ BOOKMARK'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="ki-row-menu-btn"
              onClick={share}
            >
              {shared ? '✓ COPIED' : '⇗ SHARE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
