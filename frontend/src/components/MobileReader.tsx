// K/IND mobile engine — immersive study reader (ChatGPT Round C afternoon, 2026-11-02).
// Round C P0 rebuild: compact chrome — 34px topline / 2-line title / one meta line /
// 3px progress (header ≤125px excl. safe-area); PDF viewport padding 0 so the page
// starts immediately beneath the header; 5-tool bottom grid (Pages/Mark/Draw/Notes/Find).
// Draw = real freehand ink overlay per page, persisted kl:draw:<key>.
// Find = page finder sheet. Pages are server-rendered PDF page images — real PDF
// content (established decision: no PDF.js).

import { useEffect, useRef, useState, useCallback } from 'react';
import { consumeReaderStartPage } from '../readerStart';

export interface DocLite {
  key: string;
  subj: string;
  title: string;
  section: string;
  file: string;
  pages: number;
}

interface Props {
  file: DocLite;
  subjectLabel: string;
  sectionLabel: string;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  docIndex: number;
  docTotal: number;
  contents: { id: string; label: string; docs: DocLite[] }[];
  bookmarkedDocs: DocLite[];
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenDoc: (key: string) => void;
}

function pageImageUrl(subj: string, file: string, page: number, totalPages: number): string {
  const stem = file.replace(/\.pdf$/i, '');
  const digits = String(totalPages).length;
  const nn = String(page).padStart(digits, '0');
  return `/assets/pages/${subj}/${stem}/p-${nn}.jpg`;
}

const posKey = (k: string) => `kl:pos:${k}`;
const notesKey = (k: string) => `kl:notes:${k}`;
const drawKey = (k: string) => `kl:draw:${k}`;
const SUBJECT_COLORS: Record<string, string> = {
  em2: '#6B9DFF', signals: '#B18AFF', fis: '#E6B76C', digital: '#45D9C2',
};

type Sheet = 'pages' | 'notes' | 'contents' | 'bookmarks' | 'info' | 'find' | null;

interface Note {
  page: number;
  text: string;
  ts: number;
}

function loadNotes(key: string): Note[] {
  try {
    const raw = JSON.parse(localStorage.getItem(notesKey(key)) || '[]');
    return Array.isArray(raw) ? raw.filter(n => typeof n?.text === 'string') : [];
  } catch { return []; }
}

// Pages sheet tile: dark tile with a skeleton shimmer until the thumbnail
// loads — never a blank white tile.
function ThumbTile({ page, src, selected, onGo }: {
  page: number; src: string; selected: boolean; onGo: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button onClick={onGo} className={`ap-thumb${selected ? ' on' : ''}`} aria-label={`Go to page ${page}`}>
      <span className="ap-thumb-frame">
        <img src={src} alt="" loading="lazy" draggable={false}
          onLoad={() => setLoaded(true)} className={loaded ? 'in' : ''} />
        {!loaded && <span className="ap-thumb-shimmer" aria-hidden="true" />}
        {selected && <span className="ap-thumb-current">CURRENT</span>}
      </span>
      <span className="ap-thumb-num">{page}</span>
    </button>
  );
}

// ---------- freehand ink overlay (Draw tool) ----------
// One canvas per page, absolutely positioned over the page image. Strokes are
// stored in normalized 0..1 coordinates so they survive zoom/resize, and
// persisted per document under kl:draw:<key>.
interface Stroke { c: string; w: number; pts: [number, number][]; }

function loadStrokes(docKey: string, page: number): Stroke[] {
  try {
    const all = JSON.parse(localStorage.getItem(drawKey(docKey)) || '{}');
    const arr = all[String(page)];
    return Array.isArray(arr) ? arr.filter(s => Array.isArray(s?.pts) && s.pts.length > 1) : [];
  } catch { return []; }
}
function saveStrokes(docKey: string, page: number, strokes: Stroke[]) {
  try {
    const all = JSON.parse(localStorage.getItem(drawKey(docKey)) || '{}');
    if (strokes.length) all[String(page)] = strokes;
    else delete all[String(page)];
    localStorage.setItem(drawKey(docKey), JSON.stringify(all));
  } catch { /* ignore — quota */ }
}

interface DrawApi { undo: () => void; clear: () => void; }

function DrawLayer({ page, docKey, active, color, apis }: {
  page: number; docKey: string; active: boolean; color: string;
  apis: React.MutableRefObject<Map<number, DrawApi>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(() => loadStrokes(docKey, page));
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const colorRef = useRef(color);
  colorRef.current = color;
  const cur = useRef<{ pts: [number, number][] } | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const drawStroke = (s: Stroke) => {
      if (s.pts.length < 1) return;
      ctx.strokeStyle = s.c;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0] * w, s.pts[0][1] * h);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0] * w, s.pts[i][1] * h);
      ctx.stroke();
    };
    for (const s of strokesRef.current) drawStroke(s);
    if (cur.current && cur.current.pts.length > 0) {
      drawStroke({ c: colorRef.current, w: 3, pts: cur.current.pts });
    }
  }, []);

  useEffect(() => {
    apis.current.set(page, {
      undo: () => setStrokes(prev => {
        const n = prev.slice(0, -1);
        saveStrokes(docKey, page, n);
        return n;
      }),
      clear: () => { setStrokes([]); saveStrokes(docKey, page, []); },
    });
    paint();
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    let ro: ResizeObserver | null = null;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => paint());
      ro.observe(wrap);
    }
    const img = wrap?.querySelector('img');
    const onLoad = () => paint();
    img?.addEventListener('load', onLoad);
    return () => {
      apis.current.delete(page);
      ro?.disconnect();
      img?.removeEventListener('load', onLoad);
    };
  }, [page, docKey, paint, apis]);

  useEffect(() => { paint(); }, [strokes, active, paint]);

  const toNorm = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height)));
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  };

  return (
    <canvas
      ref={canvasRef}
      className={`ap-draw-canvas${active ? ' on' : ''}`}
      aria-hidden="true"
      onPointerDown={e => {
        if (!active) return;
        e.preventDefault();
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
        cur.current = { pts: [toNorm(e)] };
      }}
      onPointerMove={e => {
        const c = cur.current;
        if (!c || !active) return;
        const p = toNorm(e);
        const last = c.pts[c.pts.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004) return;
        c.pts.push(p);
        if (c.pts.length > 600) c.pts.shift();
        paint();
      }}
      onPointerUp={() => {
        const c = cur.current;
        cur.current = null;
        if (!c || c.pts.length < 2) { paint(); return; }
        setStrokes(prev => {
          const n = [...prev, { c: colorRef.current, w: 3, pts: c.pts }].slice(-60);
          saveStrokes(docKey, page, n);
          return n;
        });
      }}
      onPointerCancel={() => { cur.current = null; paint(); }}
    />
  );
}

export default function MobileReader(props: Props) {
  const { file } = props;
  const total = file.pages || 1;
  const [zoom, setZoom] = useState(100);
  const [visiblePage, setVisiblePage] = useState(1);
  const [immersive, setImmersive] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [titleOpen, setTitleOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(file.key));
  const [noteDraft, setNoteDraft] = useState('');
  const [findVal, setFindVal] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState(SUBJECT_COLORS[file.subj] || '#45D9C2');
  const drawApis = useRef(new Map<number, DrawApi>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const userTouched = useRef(false);
  const lastTapEnd = useRef(0);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const accent = SUBJECT_COLORS[file.subj] || '#45D9C2';

  // floating page pill: appears on scroll, fades after scroll settles
  const [pillOn, setPillOn] = useState(false);
  const pillTimer = useRef<number | null>(null);
  const bumpPill = useCallback(() => {
    setPillOn(true);
    if (pillTimer.current) window.clearTimeout(pillTimer.current);
    pillTimer.current = window.setTimeout(() => setPillOn(false), 1500);
  }, []);
  const goToPage = useCallback((p: number) => {
    const page = Math.max(1, Math.min(total, p));
    const el = document.getElementById(`kl-mpage-${page}`);
    if (el) el.scrollIntoView({ block: 'start' });
    setVisiblePage(page);
    setSheet(null);
  }, [total]);

  const closeSheet = useCallback(() => setSheet(null), []);

  useEffect(() => {
    setZoom(100); setVisiblePage(1); setImmersive(false); setSheet(null);
    setTitleOpen(false); setNoteDraft(''); setFindVal('');
    setDrawMode(false); setDrawColor(SUBJECT_COLORS[file.subj] || '#45D9C2');
    setNotes(loadNotes(file.key));
    restored.current = false; userTouched.current = false;
  }, [file.key, file.subj]);

  // restore reading position (kl:pos) once pages are in the DOM —
  // a pending exact-page open from search wins over the saved position.
  // Lazy-loaded page images shift layout, so jump immediately (best effort)
  // then re-assert until the target page actually sits at the stage top.
  useEffect(() => {
    if (restored.current) return;
    let saved = 1;
    const forced = consumeReaderStartPage(file.key);
    if (forced) {
      saved = forced;
    } else {
      try { saved = parseInt(localStorage.getItem(posKey(file.key)) || '1', 10) || 1; } catch { /* ignore */ }
    }
    saved = Math.min(Math.max(1, saved), total);
    const target = saved;
    const align = () => {
      const scroller = scrollRef.current;
      const el = document.getElementById(`kl-mpage-${target}`);
      if (!el || !scroller) return false;
      const r = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      if (Math.abs(r.top - sr.top) > 30) {
        el.scrollIntoView({ block: 'start' });
        setVisiblePage(target);
        return false;
      }
      setVisiblePage(target);
      return true;
    };
    align();
    let aligned = 0, n = 0;
    const iv = window.setInterval(() => {
      n++;
      // user took over scrolling — stop correcting
      if (userTouched.current || restored.current) {
        window.clearInterval(iv);
        restored.current = true;
        return;
      }
      if (align()) aligned++;
      else aligned = 0;
      if (aligned >= 3 || n >= 16) {
        window.clearInterval(iv);
        restored.current = true;
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [file.key, total]);

  // track page nearest viewport center → persist reading position (kl:pos)
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let raf = 0, last = 1;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!restored.current) return;
        let best = 1, bestDist = Infinity;
        const sr = scroller.getBoundingClientRect();
        for (let p = 1; p <= total; p++) {
          const el = document.getElementById(`kl-mpage-${p}`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const dist = Math.abs((r.top - sr.top) + r.height / 2 - scroller.clientHeight / 2);
          if (dist < bestDist) { bestDist = dist; best = p; }
        }
        if (best !== last) {
          last = best;
          setVisiblePage(best);
          try { localStorage.setItem(posKey(file.key), String(best)); } catch { /* ignore */ }
        }
        bumpPill();
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => { scroller.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [file.key, total, bumpPill]);

  // touch: tap-center toggles chrome, double-tap toggles zoom,
  // horizontal swipe → prev/next page, pinch → zoom.
  // While drawing, the ink canvas owns the gesture (guarded below).
  const pinchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    userTouched.current = true;
    if ((e.target as HTMLElement).closest('.ap-draw-canvas')) return;
    if (e.touches.length === 2) {
      pinchStart.current = { dist: pinchDist(e.touches), zoom };
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const d = pinchDist(e.touches);
      const ratio = d / Math.max(1, pinchStart.current.dist);
      setZoom(Math.max(60, Math.min(300, Math.round(pinchStart.current.zoom * ratio))));
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinchStart.current) { pinchStart.current = null; return; }
    const s = touchStart.current;
    if (!s || drawMode) { touchStart.current = null; return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    const dt = Date.now() - s.t;
    // quick tap, minimal movement
    if (dt < 300 && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      if (Date.now() - lastTapEnd.current < 320) {
        // double-tap toggles zoom
        setZoom(z => (z > 110 ? 100 : 175));
        lastTapEnd.current = 0;
      } else {
        // tap-center toggles chrome
        setImmersive(v => !v);
        lastTapEnd.current = Date.now();
      }
      touchStart.current = null;
      return;
    }
    // horizontal swipe at boundary → prev/next page
    if (dt < 500 && Math.abs(dx) > 80 && Math.abs(dy) < 50) {
      const scroller = scrollRef.current;
      const atTop = !scroller || scroller.scrollTop < 40;
      const atBottom = !scroller || scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 40;
      if (dx < 0 && atBottom) goToPage(visiblePage + 1);
      else if (dx > 0 && atTop) goToPage(visiblePage - 1);
      else if (dx < 0) goToPage(visiblePage + 1);
      else goToPage(visiblePage - 1);
    }
    touchStart.current = null;
  };

  const progress = total ? Math.round((visiblePage / total) * 100) : 0;

  const saveNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    const next = [{ page: visiblePage, text, ts: Date.now() }, ...notes];
    setNotes(next);
    setNoteDraft('');
    try { localStorage.setItem(notesKey(file.key), JSON.stringify(next)); } catch { /* ignore */ }
  };
  const deleteNote = (ts: number) => {
    const next = notes.filter(n => n.ts !== ts);
    setNotes(next);
    try { localStorage.setItem(notesKey(file.key), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const doFind = () => {
    const p = parseInt(findVal, 10);
    if (p >= 1 && p <= total) {
      goToPage(p);
      setFindVal('');
    }
  };

  const sheetHeader = (label: string) => (
    <div className="ap-sheet-head">
      <div className="ap-sheet-grip" />
      <div className="ap-sheet-title-row">
        <span className="ap-sheet-title">{label}</span>
        <button className="ap-icon-btn" onClick={closeSheet} aria-label="Close">✕</button>
      </div>
    </div>
  );

  const sheetLabel = (s: Exclude<Sheet, null>) =>
    s === 'pages' ? 'Pages' : s === 'notes' ? 'Notes' : s === 'contents' ? 'Contents'
      : s === 'bookmarks' ? 'Bookmarks' : s === 'find' ? 'Find' : 'Info';

  const tools: Array<{ id: string; label: string; icon: string; active: boolean; onPick: () => void; aria: string }> = [
    { id: 'pages', label: 'PAGES', icon: '▤', active: sheet === 'pages', onPick: () => setSheet(sheet === 'pages' ? null : 'pages'), aria: 'Page thumbnails' },
    { id: 'mark', label: 'MARK', icon: props.bookmarked ? '★' : '☆', active: props.bookmarked, onPick: () => props.onToggleBookmark(), aria: props.bookmarked ? 'Remove bookmark' : 'Bookmark this document' },
    { id: 'draw', label: 'DRAW', icon: '✎', active: drawMode, onPick: () => setDrawMode(v => !v), aria: drawMode ? 'Stop drawing' : 'Draw on the page' },
    { id: 'notes', label: 'NOTES', icon: '≡', active: sheet === 'notes', onPick: () => setSheet(sheet === 'notes' ? null : 'notes'), aria: 'Notes' },
    { id: 'find', label: 'FIND', icon: '⌕', active: sheet === 'find', onPick: () => setSheet(sheet === 'find' ? null : 'find'), aria: 'Find a page' },
  ];

  return (
    <div className="ap-reader" style={{ ['--subject-accent' as any]: accent }}>
      {/* compact header: 34px topline / 2-line title / one meta line / 3px bar */}
      {!immersive && (
        <header className="ki-rdr-head">
          <div className="ki-rdr-top">
            <button className="ki-rdr-back" onClick={props.onClose} aria-label="Back to library">‹</button>
            <span className="ki-rdr-crumb">
              K/IND <span>/</span> LIBRARY <span>/</span> {file.subj.toUpperCase()}
            </span>
            <button
              className={`ki-rdr-act${props.bookmarked ? ' on' : ''}`}
              onClick={() => props.onToggleBookmark()}
              aria-label={props.bookmarked ? 'Remove bookmark' : 'Bookmark'}
              aria-pressed={props.bookmarked}
            >
              {props.bookmarked ? '★' : '☆'}
            </button>
            <button className="ki-rdr-act" onClick={() => setSheet('info')} aria-label="Document info">ⓘ</button>
          </div>
          <h2 className={`ki-rdr-title${titleOpen ? ' open' : ''}`} onClick={() => setTitleOpen(v => !v)}>
            {file.title}
          </h2>
          <div className="ki-rdr-meta">PAGE {visiblePage} OF {total} · {progress}% READ</div>
          <span className="ki-rdr-bar" aria-hidden="true">
            <span style={{ width: `${progress}%`, background: accent }} />
          </span>
        </header>
      )}

      {/* full-viewport PDF canvas — padding 0, page starts under the header */}
      <div
        ref={scrollRef}
        className="ap-reader-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="ap-reader-pages">
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <div key={p} id={`kl-mpage-${p}`} className="ap-reader-pagewrap scroll-mt-2">
              <div className="ap-draw-wrap">
                <img
                  src={pageImageUrl(file.subj, file.file, p, total)}
                  alt={`Page ${p}`}
                  loading={p <= 3 ? 'eager' : 'lazy'}
                  className="ap-reader-page"
                  style={{ width: `${zoom}%`, maxWidth: 'none' }}
                  draggable={false}
                />
                <DrawLayer page={p} docKey={file.key} active={drawMode && !immersive}
                  color={drawColor} apis={drawApis} />
              </div>
              <div className="ap-reader-pagenum">{p}</div>
            </div>
          ))}
          <div style={{ height: immersive ? 40 : 120 }} />
        </div>
      </div>

      {/* floating page indicator — shows on scroll, fades after it settles */}
      <div className={`ap-page-pill${pillOn && !immersive ? ' on' : ''}`} aria-hidden="true">
        {visiblePage} / {total}
      </div>

      {/* draw tools — replaces chrome while inking */}
      {drawMode && !immersive && (
        <div className="ki-drawbar" role="toolbar" aria-label="Drawing tools">
          {[accent, '#FFFFFF', '#FF7A7A'].map(c => (
            <button
              key={c}
              className={`ki-draw-swatch${drawColor === c ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => setDrawColor(c)}
              aria-label={`Ink color ${c}`}
              aria-pressed={drawColor === c}
            />
          ))}
          <button className="ki-draw-btn" onClick={() => drawApis.current.get(visiblePage)?.undo()}>UNDO</button>
          <button className="ki-draw-btn" onClick={() => drawApis.current.get(visiblePage)?.clear()}>CLEAR</button>
          <button className="ki-draw-done" onClick={() => setDrawMode(false)}>DONE</button>
        </div>
      )}

      {/* 5-tool bottom grid — safe-area aware, never covers content */}
      {!immersive && (
        <div className="ki-tools" role="toolbar" aria-label="Reading tools">
          {tools.map(t => (
            <button
              key={t.id}
              className={`ki-tool${t.active ? ' on' : ''}`}
              onClick={t.onPick}
              aria-label={t.aria}
              aria-pressed={t.active}
            >
              <span className="ki-tool-icon" aria-hidden="true">{t.icon}</span>
              <span className="ki-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* bottom sheets */}
      {sheet && (
        <div className="ap-sheet-backdrop" onClick={closeSheet}>
          <div className="ap-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            {sheet === 'pages' && (
              <>
                <div className="ap-sheet-head">
                  <div className="ap-sheet-grip" />
                  <div className="ap-sheet-title-row">
                    <span className="ap-sheet-title">Pages</span>
                    <span className="ap-sheet-count">{visiblePage} of {total} pages</span>
                    <button className="ap-icon-btn" onClick={closeSheet} aria-label="Close">✕</button>
                  </div>
                </div>
                <div className="ap-thumb-grid">
                  {Array.from({ length: total }, (_, i) => i + 1).map(p => (
                    <ThumbTile
                      key={p}
                      page={p}
                      src={pageImageUrl(file.subj, file.file, p, total)}
                      selected={p === visiblePage}
                      onGo={() => goToPage(p)}
                    />
                  ))}
                </div>
              </>
            )}
            {sheet === 'notes' && (
              <>
                {sheetHeader('Notes')}
                <div className="ap-info">
                  <div className="ki-note-form">
                    <textarea
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      placeholder={`Note on page ${visiblePage}…`}
                      aria-label="Write a note"
                    />
                    <button
                      className="ki-note-save"
                      onClick={saveNote}
                      disabled={!noteDraft.trim()}
                    >
                      SAVE NOTE · P. {visiblePage}
                    </button>
                  </div>
                  <div className="ki-note-list">
                    {notes.map(n => (
                      <div key={n.ts} className="reader-note">
                        <div className="note-page">PAGE {n.page}</div>
                        <div className="note-text">{n.text}</div>
                        <button className="note-del" onClick={() => deleteNote(n.ts)}>Delete</button>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="ap-empty">No notes yet. Jot one down — it's pinned to the current page.</p>
                    )}
                  </div>
                </div>
              </>
            )}
            {sheet === 'find' && (
              <>
                {sheetHeader('Find a page')}
                <div className="ap-info">
                  <div className="ki-find-row">
                    <input
                      value={findVal}
                      onChange={e => setFindVal(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') doFind(); }}
                      placeholder={`Page 1–${total}`}
                      inputMode="numeric"
                      aria-label="Page number"
                    />
                    <button onClick={doFind} className="ki-find-go">GO →</button>
                  </div>
                  <div className="ap-info-actions">
                    <button className="ap-chip-btn" onClick={() => goToPage(1)}>First page</button>
                    <button className="ap-chip-btn" onClick={() => goToPage(total)}>Last page</button>
                    {props.onPrev && (
                      <button className="ap-chip-btn" onClick={() => { closeSheet(); props.onPrev?.(); }}>← Prev doc</button>
                    )}
                    {props.onNext && (
                      <button className="ap-chip-btn" onClick={() => { closeSheet(); props.onNext?.(); }}>Next doc →</button>
                    )}
                  </div>
                  <p className="ap-empty">Jump straight to any page in this document.</p>
                </div>
              </>
            )}
            {sheet === 'contents' && (
              <>
                {sheetHeader('Contents')}
                <div className="ap-contents">
                  {props.contents.map(sec => (
                    <div key={sec.id} className="ap-contents-sec">
                      <div className="ap-contents-label">{sec.label}</div>
                      {sec.docs.map(d => (
                        <button
                          key={d.key}
                          onClick={() => { closeSheet(); props.onOpenDoc(d.key); }}
                          className={`ap-contents-doc${d.key === file.key ? ' on' : ''}`}
                        >
                          <span className="ap-contents-dot" style={{ background: d.key === file.key ? accent : 'rgba(255,255,255,0.25)' }} />
                          <span className="ap-clamp1">{d.title}</span>
                          <span className="ap-contents-pages">{d.pages}p</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
            {sheet === 'bookmarks' && (
              <>
                {sheetHeader('Bookmarks')}
                <div className="ap-contents">
                  {props.bookmarkedDocs.length === 0 && (
                    <p className="ap-empty">No bookmarks yet. Tap ☆ on any document to pin it here.</p>
                  )}
                  {props.bookmarkedDocs.map(d => (
                    <button key={d.key} onClick={() => { closeSheet(); props.onOpenDoc(d.key); }} className="ap-contents-doc">
                      <span style={{ color: '#ffbf78' }}>★</span>
                      <span className="ap-clamp1">{d.title}</span>
                      <span className="ap-contents-pages">{d.subj.toUpperCase()} · {d.pages}p</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {sheet === 'info' && (
              <>
                {sheetHeader('Document info')}
                <div className="ap-info">
                  <div className="ap-info-row"><span className="ap-info-k">TITLE</span><span>{file.title}</span></div>
                  <div className="ap-info-row"><span className="ap-info-k">SUBJECT</span><span>{props.subjectLabel}</span></div>
                  <div className="ap-info-row"><span className="ap-info-k">SECTION</span><span>{props.sectionLabel}</span></div>
                  <div className="ap-info-row"><span className="ap-info-k">PAGES</span><span>{total}</span></div>
                  <div className="ap-info-row"><span className="ap-info-k">POSITION</span><span>Page {visiblePage} of {total} · {progress}% read</span></div>
                  <div className="ap-info-row"><span className="ap-info-k">DOCUMENT</span><span>{props.docIndex + 1} of {props.docTotal}</span></div>
                  <div className="ap-info-row"><span className="ap-info-k">GESTURES</span><span>Pinch or double-tap to zoom · swipe sideways to turn pages · tap the page to hide the interface</span></div>
                  <div className="ap-info-actions">
                    <button className="ap-chip-btn" onClick={() => setSheet('contents')}>Contents</button>
                    <button className="ap-chip-btn" onClick={() => setSheet('notes')}>Notes</button>
                    <button className="ap-chip-btn" onClick={() => setSheet('bookmarks')}>Bookmarks</button>
                    {props.onPrev && (
                      <button className="ap-chip-btn" onClick={() => { closeSheet(); props.onPrev?.(); }}>← Prev doc</button>
                    )}
                    {props.onNext && (
                      <button className="ap-chip-btn" onClick={() => { closeSheet(); props.onNext?.(); }}>Next doc →</button>
                    )}
                  </div>
                </div>
              </>
            )}
            {/* sheet quick tabs */}
            <div className="ap-sheet-tabs">
              {(['pages', 'notes', 'contents', 'bookmarks', 'find', 'info'] as Sheet[]).map(s => (
                <button
                  key={s as string}
                  onClick={() => setSheet(s)}
                  className={sheet === s ? 'on' : ''}
                  style={sheet === s ? { color: accent } : undefined}
                >
                  {sheetLabel(s as Exclude<Sheet, null>)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
