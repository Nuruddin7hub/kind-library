// K/IND mobile engine — immersive study reader (ChatGPT Round C rebuild, 2026-11-03).
//
// Single-page flex layout (exact spec direction):
//   .mr-reader {position:fixed; inset:0; z-index:200; display:flex;
//               flex-direction:column; background:#080B11; overflow:hidden}
//   54px header (back | 1-line ellipsis title | bookmark | more)
//   48px modebar (READ/STUDY/FIND + page x/y, page counter TAPPABLE →
//     page-jump sheet with numeric input + thumbnail strip)
//   .mr-stage {flex:1; min-height:0; display:flex; overflow:auto; padding:12px;
//              background:#151D29} with the page image at REAL aspect ratio
//     (max-width:100%; max-height:100%; object-fit:contain; NO stretching)
//   Study toolbar: 4 EXPLICIT tools — Highlight (color choice), Note (tap page
//     to pin), Draw (pen + eraser + undo), Bookmark (save page + optional
//     label) — each with a VISIBLE selected state and a small contextual
//     toolbar (Undo/Cancel); annotations saved against document ID + page
//     number, positioned relative to the page.
//   Read mode: page nav + zoom controls only.
//   Find mode: search field + match count + prev/next match.
//   Global bottom nav stays hidden in the reader (z-index 200 covers the dock).
//
// Page content is server-rendered IMAGES (no PDF.js, no text layer —
// established decision), so long-press text selection is impossible.
// kl:pos / kl:posx / kl:marks / kl:draw / kl:notes all byte-compatible:
//   kl:pos:<key>   = current page (int, desktop + resume compat)
//   kl:posx:<key>  = {p, s, z} — s is 0 in the single-page layout (schema kept)
//   kl:marks:<key> = [{page, name, ts}]
//   kl:draw:<key>  = {page: [{c, w, pts}]} (normalized 0..1 coords; highlight
//                    strokes are wide translucent strokes in the same store)
//   kl:notes:<key> = [{page, text, ts, x?, y?}] — x/y (0..1) only on tap-pinned
//                    notes; legacy notes without x/y still parse and list.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import BottomSheet from './BottomSheet';
import { consumeReaderStartPage } from '../readerStart';
import type { SearchHit } from '../shared';
import './MobileReader.css';

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
  subjectCode: string;
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
  reducedMotion?: boolean;
}

function pageImageUrl(subj: string, file: string, page: number, totalPages: number): string {
  const stem = file.replace(/\.pdf$/i, '');
  const digits = String(totalPages).length;
  const nn = String(page).padStart(digits, '0');
  return `/assets/pages/${subj}/${stem}/p-${nn}.jpg`;
}

const posKey = (k: string) => `kl:pos:${k}`;
const posxKey = (k: string) => `kl:posx:${k}`;
const notesKey = (k: string) => `kl:notes:${k}`;
const marksKey = (k: string) => `kl:marks:${k}`;
const drawKey = (k: string) => `kl:draw:${k}`;
const SUBJECT_COLORS: Record<string, string> = {
  em2: '#719AFF', signals: '#B38AFF', fis: '#E6B36C', digital: '#38D5C1',
};

type Sheet = 'pages' | 'pin' | 'notes' | 'marks' | 'info' | null;

/** Reader modes (Round C P0): Read = page nav + zoom only;
 *  Study = 4 explicit annotation tools; Find = in-doc search. */
type ReaderMode = 'read' | 'study' | 'find';
/** Study tools — 4 explicit, each with visible selected state + contextual bar. */
type StudyTool = 'highlight' | 'note' | 'draw' | 'bookmark' | null;

interface Note {
  page: number;
  text: string;
  ts: number;
  x?: number;
  y?: number;
}

interface Mark {
  page: number;
  name: string;
  ts: number;
}

function loadNotes(key: string): Note[] {
  try {
    const raw = JSON.parse(localStorage.getItem(notesKey(key)) || '[]');
    return Array.isArray(raw) ? raw.filter(n => typeof n?.text === 'string') : [];
  } catch { return []; }
}

function loadMarks(key: string): Mark[] {
  try {
    const raw = JSON.parse(localStorage.getItem(marksKey(key)) || '[]');
    return Array.isArray(raw)
      ? raw.filter(m => typeof m?.page === 'number' && typeof m?.name === 'string')
          .sort((a: Mark, b: Mark) => a.page - b.page || a.ts - b.ts)
      : [];
  } catch { return []; }
}

// Pages sheet tile: dark tile with a skeleton shimmer until the thumbnail
// loads — never a blank white tile. Turquoise outline marks the current page.
function ThumbTile({ page, src, selected, onGo, eager }: {
  page: number; src: string; selected: boolean; onGo: () => void; eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button type="button" onClick={onGo} className={`mr-thumb${selected ? ' on' : ''}`} aria-label={`Go to page ${page}`}>
      <span className="mr-thumb-frame">
        <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} draggable={false}
          onLoad={() => setLoaded(true)} className={loaded ? 'in' : ''} />
        {!loaded && <span className="mr-thumb-shimmer" aria-hidden="true" />}
        {selected && <span className="mr-thumb-current">CURRENT</span>}
      </span>
      <span className="mr-thumb-num">{page}</span>
    </button>
  );
}

// ---------- freehand ink overlay (Draw + Highlight tools) ----------
// One canvas per mounted page, absolutely positioned over the page box.
// Strokes are stored in normalized 0..1 coordinates so they survive
// zoom/resize, and persisted per document under kl:draw:<key>. Highlight
// strokes are wide translucent strokes in the same store.
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

interface DrawApi { undo: () => void; }

function DrawLayer({ page, docKey, ink, color, width, erase, apiRef }: {
  page: number; docKey: string;
  ink: boolean;              // pen/highlighter captures pointer when true
  color: string; width: number;
  erase: boolean;            // tap-a-stroke deletes it
  apiRef: React.MutableRefObject<DrawApi | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(() => loadStrokes(docKey, page));
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(width);
  widthRef.current = width;
  const eraseRef = useRef(erase);
  eraseRef.current = erase;
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
      drawStroke({ c: colorRef.current, w: widthRef.current, pts: cur.current.pts });
    }
  }, []);

  useEffect(() => {
    apiRef.current = {
      undo: () => setStrokes(prev => {
        const n = prev.slice(0, -1);
        saveStrokes(docKey, page, n);
        return n;
      }),
    };
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
      if (apiRef.current) apiRef.current = null;
      ro?.disconnect();
      img?.removeEventListener('load', onLoad);
    };
  }, [page, docKey, paint, apiRef]);

  useEffect(() => { paint(); }, [strokes, ink, paint]);

  const toNorm = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height)));
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  };

  // eraser: delete the nearest stroke within ~14px of the tap
  const eraseAt = (p: [number, number]) => {
    const list = strokesRef.current;
    let best = -1, bestD = 0.035;
    for (let i = list.length - 1; i >= 0; i--) {
      for (const q of list[i].pts) {
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    if (best >= 0) {
      setStrokes(prev => {
        const n = prev.filter((_, i) => i !== best);
        saveStrokes(docKey, page, n);
        return n;
      });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`mr-draw-canvas${ink ? ' on' : ''}`}
      aria-hidden="true"
      onPointerDown={e => {
        if (!ink) return;
        e.preventDefault();
        const p = toNorm(e);
        if (eraseRef.current) { eraseAt(p); return; }
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
        cur.current = { pts: [p] };
      }}
      onPointerMove={e => {
        const c = cur.current;
        if (!c || !ink || eraseRef.current) return;
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
          const n = [...prev, { c: colorRef.current, w: widthRef.current, pts: c.pts }].slice(-60);
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
  const accent = SUBJECT_COLORS[file.subj] || '#38D5C1';

  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [mode, setMode] = useState<ReaderMode>('read');
  const [tool, setTool] = useState<StudyTool>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(file.key));
  const [marks, setMarks] = useState<Mark[]>(() => loadMarks(file.key));
  const [noteDraft, setNoteDraft] = useState('');
  const [markDraft, setMarkDraft] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [pinAt, setPinAt] = useState<{ x: number; y: number } | null>(null);
  const [pinPop, setPinPop] = useState<number | null>(null);
  const [pageInput, setPageInput] = useState('');
  const [ftQuery, setFtQuery] = useState('');
  const [ftLoading, setFtLoading] = useState(false);
  const [ftHits, setFtHits] = useState<Array<{ page_number: number; snippet: string; match_count: number }>>([]);
  const [ftIdx, setFtIdx] = useState(0);
  // study tool options
  const [hlColor, setHlColor] = useState('rgba(255, 236, 140, 0.55)');
  const [penColor, setPenColor] = useState(SUBJECT_COLORS[file.subj] || '#38D5C1');
  const [eraseMode, setEraseMode] = useState(false);
  const drawApi = useRef<DrawApi | null>(null);

  // page box geometry: real aspect ratio from the loaded image, fit into the stage
  const [imgAR, setImgAR] = useState(0.707); // w/h, updated on load
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const posxTimer = useRef<number | null>(null);
  const restored = useRef(false);
  const userTouched = useRef(false);
  const pagesGridRef = useRef<HTMLDivElement>(null);
  const pagesScrollPos = useRef(0);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTapEnd = useRef(0);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pageRef = useRef(page);
  pageRef.current = page;

  // reduced motion: prop wins, else the OS preference
  const [mqReduced, setMqReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMqReduced(mq.matches);
    apply();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, []);
  const motionReduced = props.reducedMotion ?? mqReduced;

  // measure the stage so the page box fits at real aspect ratio
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => ro?.disconnect();
  }, []);

  const fitW = Math.max(0, stageSize.w - 24);
  const fitH = Math.max(0, stageSize.h - 24);
  let baseW = fitW, baseH = fitW / Math.max(0.2, imgAR);
  if (baseH > fitH) { baseH = fitH; baseW = fitH * Math.max(0.2, imgAR); }
  const boxW = Math.max(40, Math.round(baseW * zoom / 100));
  const boxH = Math.max(40, Math.round(baseH * zoom / 100));

  const closeSheet = useCallback(() => setSheet(null), []);
  const openSheet = useCallback((s: Exclude<Sheet, null>) => {
    setSheet(prev => {
      if (prev === s) return null;
      if (s === 'pages') setPageInput(String(pageRef.current));
      return s;
    });
  }, []);

  // reset per document
  useEffect(() => {
    setPage(1); setZoom(100); setMode('read'); setTool(null); setSheet(null);
    setNoteDraft(''); setMarkDraft(''); setPinDraft(''); setPinAt(null); setPinPop(null);
    setPageInput(''); setFtQuery(''); setFtHits([]); setFtLoading(false); setFtIdx(0);
    setHlColor('rgba(255, 236, 140, 0.55)');
    setPenColor(SUBJECT_COLORS[file.subj] || '#38D5C1');
    setEraseMode(false);
    setNotes(loadNotes(file.key));
    setMarks(loadMarks(file.key));
    pagesScrollPos.current = 0;
    restored.current = false; userTouched.current = false;
    if (posxTimer.current) window.clearTimeout(posxTimer.current);
  }, [file.key, file.subj]);

  // debounced exact-position save: kl:posx:<key> = {p, s, z}
  // (s is always 0 in the single-page layout — schema kept byte-compatible)
  const schedulePosX = useCallback((p: number) => {
    if (posxTimer.current) window.clearTimeout(posxTimer.current);
    posxTimer.current = window.setTimeout(() => {
      if (!restored.current) return;
      try {
        localStorage.setItem(posxKey(file.key), JSON.stringify({
          p, s: 0, z: zoomRef.current,
        }));
      } catch { /* ignore — quota */ }
    }, 500);
  }, [file.key]);

  const persistPage = useCallback((p: number) => {
    try { localStorage.setItem(posKey(file.key), String(p)); } catch { /* ignore */ }
    schedulePosX(p);
  }, [file.key, schedulePosX]);

  const goToPage = useCallback((p: number) => {
    const pg = Math.max(1, Math.min(total, p));
    setPage(pg);
    setPinPop(null);
    const sc = stageRef.current;
    if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; }
    persistPage(pg);
    setSheet(null);
  }, [total, persistPage]);

  // restore reading position — a pending exact-page open from search wins
  // over everything. kl:posx restores zoom; otherwise fall back to kl:pos.
  useEffect(() => {
    if (restored.current) return;
    const forced = consumeReaderStartPage(file.key);
    let saved = 1;
    if (forced) {
      saved = forced;
    } else {
      try { saved = parseInt(localStorage.getItem(posKey(file.key)) || '1', 10) || 1; } catch { /* ignore */ }
    }
    saved = Math.min(Math.max(1, saved), total);
    if (!forced) {
      try {
        const raw = localStorage.getItem(posxKey(file.key));
        if (raw) {
          const j = JSON.parse(raw);
          if (typeof j?.z === 'number') {
            const z = Math.max(60, Math.min(300, Math.round(j.z)));
            setZoom(z);
            const p = Math.max(1, Math.min(total, Math.round(j.p ?? saved)));
            setPage(p);
            restored.current = true;
            persistPage(p);
            return;
          }
        }
      } catch { /* ignore */ }
    }
    setPage(saved);
    restored.current = true;
    persistPage(saved);
  }, [file.key, total, persistPage]);

  useEffect(() => () => {
    if (posxTimer.current) window.clearTimeout(posxTimer.current);
  }, []);

  // zoom changes re-record the exact position
  useEffect(() => { schedulePosX(pageRef.current); }, [zoom, schedulePosX]);

  // in-document full-text search — debounced 300ms, min 2 chars,
  // filtered to this document's key, passages sorted by page
  useEffect(() => {
    const q = ftQuery.trim();
    if (q.length < 2) { setFtHits([]); setFtLoading(false); setFtIdx(0); return; }
    setFtLoading(true);
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(res => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: SearchHit[] }) => {
          const passages: Array<{ page_number: number; snippet: string; match_count: number }> = [];
          for (const r of data.results || []) {
            if (r.key !== file.key) continue;
            for (const pg of r.passages || []) {
              passages.push({ page_number: pg.page_number, snippet: pg.snippet, match_count: pg.match_count });
            }
          }
          passages.sort((a, b) => a.page_number - b.page_number);
          setFtHits(passages);
          setFtIdx(0);
        })
        .catch(() => { /* aborted or network error — keep previous */ })
        .finally(() => { if (!ctrl.signal.aborted) setFtLoading(false); });
    }, 300);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [ftQuery, file.key]);
  const ftTotalMatches = ftHits.reduce((n, h) => n + (h.match_count || 0), 0);
  const ftPages = useMemo(
    () => [...new Set(ftHits.map(h => h.page_number))].sort((a, b) => a - b),
    [ftHits],
  );
  const ftStep = useCallback((dir: 1 | -1) => {
    if (!ftPages.length) return;
    setFtIdx(i => {
      const n = (i + dir + ftPages.length) % ftPages.length;
      goToPage(ftPages[n]);
      return n;
    });
  }, [ftPages, goToPage]);

  const switchMode = useCallback((m: ReaderMode) => {
    setSheet(null);
    setTool(null);
    setEraseMode(false);
    setMode(m);
    if (m === 'find') {
      window.setTimeout(() => findInputRef.current?.focus(), 120);
    }
  }, []);

  // touch: double-tap toggles zoom, horizontal swipe turns pages,
  // pinch zooms. While inking, the canvas owns the gesture.
  const pinchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    userTouched.current = true;
    if ((e.target as HTMLElement).closest('.mr-draw-canvas')) return;
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
    touchStart.current = null;
    if (!s) return;
    // a tool owns taps on the page (note pinning / inking handled elsewhere)
    if (tool) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    const dt = Date.now() - s.t;
    if (dt < 300 && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      // double-tap toggles zoom 100 ↔ 175
      if (Date.now() - lastTapEnd.current < 320) {
        setZoom(z => (z > 110 ? 100 : 175));
        lastTapEnd.current = 0;
      } else {
        lastTapEnd.current = Date.now();
      }
      return;
    }
    // horizontal swipe → prev/next page (only when not zoomed-in panning)
    if (dt < 500 && Math.abs(dx) > 80 && Math.abs(dy) < 60 && zoomRef.current <= 115) {
      if (dx < 0) goToPage(page + 1);
      else goToPage(page - 1);
    }
  };

  // tap-to-pin notes (NOTE tool): a TRUE tap on the page box (not a scroll)
  // opens the pin composer at the tapped normalized coordinates.
  const noteTapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPagePointerDown = (e: React.PointerEvent) => {
    if (tool !== 'note') return;
    if ((e.target as HTMLElement).closest('.mr-pin-anchor')) return; // pin's own tap
    noteTapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onPagePointerUp = (e: React.PointerEvent) => {
    const s = noteTapStart.current;
    noteTapStart.current = null;
    if (tool !== 'note' || !s) return;
    if ((e.target as HTMLElement).closest('.mr-pin-anchor')) return;
    const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    if (Date.now() - s.t > 350 || moved > 12) return; // it was a scroll, not a tap
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / Math.max(1, box.width)));
    const y = Math.min(1, Math.max(0, (e.clientY - box.top) / Math.max(1, box.height)));
    setPinAt({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    setPinDraft('');
    setSheet('pin');
  };

  const savePinNote = () => {
    const text = pinDraft.trim();
    if (!text || !pinAt) return;
    const next = [{ page, text, ts: Date.now(), x: pinAt.x, y: pinAt.y }, ...notes];
    setNotes(next);
    setPinDraft(''); setPinAt(null); setSheet(null);
    try { localStorage.setItem(notesKey(file.key), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    const next = [{ page, text, ts: Date.now() }, ...notes];
    setNotes(next);
    setNoteDraft('');
    try { localStorage.setItem(notesKey(file.key), JSON.stringify(next)); } catch { /* ignore */ }
  };
  const deleteNote = (ts: number) => {
    const next = notes.filter(n => n.ts !== ts);
    setNotes(next);
    if (pinPop === ts) setPinPop(null);
    try { localStorage.setItem(notesKey(file.key), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveMark = () => {
    const name = markDraft.trim() || `Page ${page}`;
    const next = [
      ...marks.filter(m => m.page !== page),
      { page, name, ts: Date.now() },
    ].sort((a, b) => a.page - b.page || a.ts - b.ts);
    setMarks(next);
    setMarkDraft('');
    setTool(null);
    try { localStorage.setItem(marksKey(file.key), JSON.stringify(next)); } catch { /* ignore */ }
  };
  const deleteMark = (ts: number) => {
    const next = marks.filter(m => m.ts !== ts);
    setMarks(next);
    try { localStorage.setItem(marksKey(file.key), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const doPageJump = () => {
    const p = parseInt(pageInput, 10);
    if (p >= 1 && p <= total) {
      goToPage(p);
      setPageInput('');
    }
  };

  const MODES: Array<{ id: ReaderMode; label: string; aria: string }> = [
    { id: 'read', label: 'READ', aria: 'Read mode — page navigation and zoom' },
    { id: 'study', label: 'STUDY', aria: 'Study mode — highlight, notes, draw, bookmarks' },
    { id: 'find', label: 'FIND', aria: 'Find mode — search in this document' },
  ];

  const TOOLS: Array<{ id: Exclude<StudyTool, null>; label: string; icon: string; aria: string }> = [
    { id: 'highlight', label: 'HIGHLIGHT', icon: '▬', aria: 'Highlight tool — choose a color' },
    { id: 'note', label: 'NOTE', icon: '✚', aria: 'Note tool — tap the page to pin a note' },
    { id: 'draw', label: 'DRAW', icon: '✎', aria: 'Draw tool — pen, eraser, undo' },
    { id: 'bookmark', label: 'BOOKMARK', icon: '⚑', aria: 'Bookmark tool — save this page with a label' },
  ];

  const HL_COLORS = [
    { c: 'rgba(255, 236, 140, 0.55)', label: 'Yellow highlighter' },
    { c: accent, label: 'Subject highlighter' },
    { c: 'rgba(255, 150, 180, 0.5)', label: 'Pink highlighter' },
  ];
  const PEN_COLORS = [
    { c: accent, label: 'Subject ink' },
    { c: '#FFFFFF', label: 'White ink' },
    { c: '#FF7A7A', label: 'Red ink' },
  ];

  const inking = tool === 'highlight' || tool === 'draw';
  const pageNotes = notes.filter(n => n.page === page);
  const pinned = pageNotes.filter(n => typeof n.x === 'number' && typeof n.y === 'number');
  const progress = total ? Math.round((page / total) * 100) : 0;

  // PAGES sheet: preserve the thumbnail grid scroll position across re-opens
  useEffect(() => {
    if (sheet === 'pages' && pagesGridRef.current) {
      pagesGridRef.current.scrollTop = pagesScrollPos.current;
    }
  }, [sheet]);
  const savePagesScroll = useCallback(() => {
    if (pagesGridRef.current) pagesScrollPos.current = pagesGridRef.current.scrollTop;
  }, []);

  return (
    <div
      className={`mr-reader${motionReduced ? ' mr-reduced-motion' : ''}`}
      style={{ ['--subject-accent' as any]: accent }}
    >
      {/* 54px header: back | 1-line ellipsis title | bookmark | more */}
      <div className="mr-reader-head">
        <button type="button" className="mr-back" onClick={props.onClose} aria-label="Back to library">‹</button>
        <div className="mr-titlewrap">
          <span className="mr-title">{file.title}</span>
        </div>
        <button
          type="button"
          className={`mr-iconbtn${props.bookmarked ? ' on' : ''}`}
          onClick={() => props.onToggleBookmark()}
          aria-label={props.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          aria-pressed={props.bookmarked}
        >
          {props.bookmarked ? '★' : '☆'}
        </button>
        <button type="button" className="mr-iconbtn" onClick={() => openSheet('info')} aria-label="More options">⋯</button>
      </div>

      {/* 48px modebar: READ·STUDY·FIND segmented + PAGE x/y (tap → PAGES sheet) */}
      <div className="mr-moderow">
        <div className="mr-modeseg" role="tablist" aria-label="Reader mode">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`mr-modebtn${mode === m.id ? ' on' : ''}`}
              onClick={() => switchMode(m.id)}
              aria-label={m.aria}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mr-pagebtn"
          onClick={() => openSheet('pages')}
          aria-label={`Open page thumbnails, currently page ${page} of ${total}`}
        >
          PAGE {page}/{total} ›
        </button>
      </div>

      {/* study toolbar: 4 explicit tools with VISIBLE selected state */}
      {mode === 'study' && (
        <div className="mr-studybar" role="toolbar" aria-label="Study tools">
          {TOOLS.map(t => (
            <button
              type="button"
              key={t.id}
              className={`mr-tool${tool === t.id ? ' on' : ''}`}
              onClick={() => {
                setTool(prev => (prev === t.id ? null : t.id));
                setEraseMode(false);
                if (t.id === 'bookmark') setMarkDraft('');
              }}
              aria-label={t.aria}
              aria-pressed={tool === t.id}
            >
              <span className="mr-tool-icon" aria-hidden="true">{t.icon}</span>
              <span className="mr-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* contextual mini-toolbar per tool: tool controls + Undo + Cancel */}
      {mode === 'study' && tool === 'highlight' && (
        <div className="mr-ctxbar" role="toolbar" aria-label="Highlight options">
          <span className="mr-ctx-hint">SWIPE TO HIGHLIGHT</span>
          {HL_COLORS.map(o => (
            <button
              type="button"
              key={o.label}
              className={`mr-swatch${hlColor === o.c ? ' on' : ''}`}
              style={{ background: o.c }}
              onClick={() => setHlColor(o.c)}
              aria-label={o.label}
              aria-pressed={hlColor === o.c}
            />
          ))}
          <button type="button" className="mr-ctxbtn" onClick={() => drawApi.current?.undo()}>UNDO</button>
          <button type="button" className="mr-ctxbtn mr-ctxdone" onClick={() => setTool(null)}>CANCEL</button>
        </div>
      )}
      {mode === 'study' && tool === 'note' && (
        <div className="mr-ctxbar" role="toolbar" aria-label="Note options">
          <span className="mr-ctx-hint">TAP THE PAGE TO PIN A NOTE</span>
          <button type="button" className="mr-ctxbtn" onClick={() => openSheet('notes')}>VIEW NOTES</button>
          <button type="button" className="mr-ctxbtn mr-ctxdone" onClick={() => setTool(null)}>CANCEL</button>
        </div>
      )}
      {mode === 'study' && tool === 'draw' && (
        <div className="mr-ctxbar" role="toolbar" aria-label="Draw options">
          {PEN_COLORS.map(o => (
            <button
              type="button"
              key={o.label}
              className={`mr-swatch${!eraseMode && penColor === o.c ? ' on' : ''}`}
              style={{ background: o.c }}
              onClick={() => { setPenColor(o.c); setEraseMode(false); }}
              aria-label={o.label}
              aria-pressed={!eraseMode && penColor === o.c}
            />
          ))}
          <button
            type="button"
            className={`mr-ctxbtn${eraseMode ? ' on' : ''}`}
            onClick={() => setEraseMode(v => !v)}
            aria-pressed={eraseMode}
          >
            ERASER
          </button>
          <button type="button" className="mr-ctxbtn" onClick={() => drawApi.current?.undo()}>UNDO</button>
          <button type="button" className="mr-ctxbtn mr-ctxdone" onClick={() => { setTool(null); setEraseMode(false); }}>CANCEL</button>
        </div>
      )}
      {mode === 'study' && tool === 'bookmark' && (
        <div className="mr-ctxbar mr-ctxbar-input" role="toolbar" aria-label="Bookmark options">
          <input
            className="mr-ctx-input"
            value={markDraft}
            onChange={e => setMarkDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveMark(); }}
            placeholder={`Label for page ${page} (optional)`}
            maxLength={60}
            aria-label="Bookmark label"
          />
          <button type="button" className="mr-ctxbtn mr-ctxprimary" onClick={saveMark}>SAVE</button>
          <button type="button" className="mr-ctxbtn mr-ctxdone" onClick={() => setTool(null)}>CANCEL</button>
        </div>
      )}

      {/* .reader-stage: flex-1, centered, page at REAL aspect ratio */}
      <div
        ref={stageRef}
        className="mr-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="mr-pagebox"
          style={{ width: boxW, height: boxH }}
          onPointerDown={onPagePointerDown}
          onPointerUp={onPagePointerUp}
        >
          <img
            src={pageImageUrl(file.subj, file.file, page, total)}
            alt={`Page ${page}`}
            className="mr-pageimg"
            draggable={false}
            onLoad={e => {
              const im = e.currentTarget;
              if (im.naturalWidth > 0 && im.naturalHeight > 0) {
                setImgAR(im.naturalWidth / im.naturalHeight);
              }
            }}
          />
          <DrawLayer
            key={`${file.key}-${page}`}
            page={page}
            docKey={file.key}
            ink={inking}
            color={tool === 'highlight' ? hlColor : penColor}
            width={tool === 'highlight' ? 10 : 3}
            erase={tool === 'draw' && eraseMode}
            apiRef={drawApi}
          />
          {/* tap-pinned notes, positioned relative to the page */}
          {pinned.map(n => (
            <span key={n.ts} className="mr-pin-anchor" style={{ left: `${(n.x as number) * 100}%`, top: `${(n.y as number) * 100}%` }}>
              <button
                type="button"
                className={`mr-pin${pinPop === n.ts ? ' on' : ''}`}
                onClick={ev => { ev.stopPropagation(); setPinPop(pinPop === n.ts ? null : n.ts); }}
                aria-label={`Note on page ${n.page}: ${n.text}`}
              >
                ✎
              </button>
              {pinPop === n.ts && (
                <span className={`mr-pin-pop${(n.y as number) < 0.4 ? ' below' : ''}`} role="dialog" aria-label="Pinned note">
                  <span className="mr-pin-text">{n.text}</span>
                  <span className="mr-pin-actions">
                    <button type="button" className="mr-pin-jump" onClick={() => openSheet('notes')}>ALL NOTES</button>
                    <button type="button" className="mr-pin-del" onClick={() => deleteNote(n.ts)}>DELETE</button>
                  </span>
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Read mode: page nav + zoom controls ONLY */}
      {mode === 'read' && (
        <div className="mr-readbar" role="toolbar" aria-label="Page navigation and zoom">
          <button type="button" className="mr-rbtn" onClick={() => goToPage(page - 1)}
            disabled={page <= 1} aria-label="Previous page">‹</button>
          <button type="button" className="mr-rbtn" onClick={() => setZoom(z => Math.max(60, z - 25))}
            disabled={zoom <= 60} aria-label="Zoom out">−</button>
          <button type="button" className="mr-rzoom" onClick={() => setZoom(100)}
            aria-label="Reset zoom to 100 percent">{zoom}%</button>
          <button type="button" className="mr-rbtn" onClick={() => setZoom(z => Math.min(300, z + 25))}
            disabled={zoom >= 300} aria-label="Zoom in">+</button>
          <button type="button" className="mr-rbtn" onClick={() => goToPage(page + 1)}
            disabled={page >= total} aria-label="Next page">›</button>
        </div>
      )}

      {/* Find mode: search field + match count + prev/next match */}
      {mode === 'find' && (
        <div className="mr-findpanel">
          <div className="mr-findbar">
            <input
              ref={findInputRef}
              value={ftQuery}
              onChange={e => setFtQuery(e.target.value)}
              placeholder="Search in this document…"
              aria-label="Search document text"
              enterKeyHint="search"
            />
            <span className="mr-findcount" aria-live="polite">
              {ftLoading ? '…' : `${ftTotalMatches} HIT${ftTotalMatches === 1 ? '' : 'S'}`}
            </span>
            {ftPages.length > 0 && (
              <span className="mr-findpos" aria-hidden="true">{ftIdx + 1}/{ftPages.length}</span>
            )}
            <button type="button" className="mr-findnav" onClick={() => ftStep(-1)}
              disabled={!ftPages.length} aria-label="Previous match">‹</button>
            <button type="button" className="mr-findnav" onClick={() => ftStep(1)}
              disabled={!ftPages.length} aria-label="Next match">›</button>
          </div>
          <div className="mr-ft-list mr-findresults">
            {ftHits.map((h, i) => (
              <button
                type="button"
                key={`${h.page_number}-${i}`}
                className="mr-ft-hit"
                onClick={() => goToPage(h.page_number)}
                aria-label={`Go to page ${h.page_number}`}
              >
                <span className="mr-ft-page">P. {h.page_number}</span>
                <span className="mr-ft-snippet">{h.snippet}</span>
              </button>
            ))}
            {ftQuery.trim().length >= 2 && !ftLoading && ftHits.length === 0 && (
              <p className="mr-empty">No matches for “{ftQuery.trim()}”.</p>
            )}
          </div>
        </div>
      )}

      {/* PAGES sheet — numeric input + thumbnail strip */}
      <BottomSheet open={sheet === 'pages'} onClose={closeSheet} title="Pages" height="min(76dvh, calc(100dvh - 48px))">
        <div className="mr-jump-row">
          <input
            value={pageInput}
            onChange={e => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') doPageJump(); }}
            placeholder={`Page 1–${total}`}
            inputMode="numeric"
            enterKeyHint="go"
            aria-label="Page number"
          />
          <span className="mr-jump-total" aria-hidden="true">OF {total}</span>
          <button type="button" className="mr-go" onClick={doPageJump}>GO</button>
        </div>
        <div className="mr-find-nav">
          <button type="button" className="mr-chip" onClick={() => goToPage(1)}>First</button>
          <button type="button" className="mr-chip" onClick={() => goToPage(page - 1)} aria-label="Previous page">‹ Prev</button>
          <button type="button" className="mr-chip" onClick={() => goToPage(page + 1)} aria-label="Next page">Next ›</button>
          <button type="button" className="mr-chip" onClick={() => goToPage(total)}>Last</button>
        </div>
        <div className="mr-thumb-grid" ref={pagesGridRef} onScroll={savePagesScroll}>
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <ThumbTile
              key={p}
              page={p}
              src={pageImageUrl(file.subj, file.file, p, total)}
              selected={p === page}
              onGo={() => goToPage(p)}
              eager={p <= 12}
            />
          ))}
        </div>
      </BottomSheet>

      {/* PIN sheet — compose a tap-pinned note */}
      <BottomSheet open={sheet === 'pin'} onClose={closeSheet} title={`Pin note · page ${page}`}>
        <div className="mr-note-form">
          <textarea
            value={pinDraft}
            onChange={e => setPinDraft(e.target.value)}
            placeholder="Write the note…"
            aria-label="Pinned note text"
          />
          <button type="button" className="mr-note-save" onClick={savePinNote} disabled={!pinDraft.trim()}>
            PIN NOTE · P. {page}
          </button>
        </div>
      </BottomSheet>

      {/* NOTES sheet — add/list; tapping a note jumps to its page */}
      <BottomSheet open={sheet === 'notes'} onClose={closeSheet} title="Notes" height="78vh">
        <div className="mr-note-form">
          <textarea
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            placeholder={`Note on page ${page}…`}
            aria-label="Write a note"
          />
          <button type="button" className="mr-note-save" onClick={saveNote} disabled={!noteDraft.trim()}>
            SAVE NOTE · P. {page}
          </button>
        </div>
        <div className="mr-note-list">
          {notes.map(n => (
            <div key={n.ts} className="mr-note">
              <button type="button" className="mr-note-body" onClick={() => goToPage(n.page)}
                aria-label={`Jump to note on page ${n.page}`}>
                <span className="mr-note-page">PAGE {n.page}</span>
                <span className="mr-note-text">{n.text}</span>
              </button>
              <button type="button" className="mr-del" onClick={() => deleteNote(n.ts)} aria-label="Delete note">✕</button>
            </div>
          ))}
          {notes.length === 0 && (
            <p className="mr-empty">No notes yet. In Study mode, tap NOTE then tap the page to pin one.</p>
          )}
        </div>
      </BottomSheet>

      {/* MARKS sheet — named page bookmarks */}
      <BottomSheet open={sheet === 'marks'} onClose={closeSheet} title="Page marks" height="72vh">
        <div className="mr-jump-row">
          <input
            value={markDraft}
            onChange={e => setMarkDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveMark(); }}
            placeholder="Name this page…"
            maxLength={60}
            aria-label="Mark name"
          />
          <button type="button" className="mr-go" onClick={saveMark}>SAVE PAGE MARK</button>
        </div>
        <p className="mr-hint">Marks the page you&rsquo;re on: page {page}</p>
        <div className="mr-mark-list">
          {marks.map(m => (
            <div key={m.ts} className="mr-mark-row">
              <button type="button" className="mr-mark-jump" onClick={() => goToPage(m.page)}
                aria-label={`Jump to ${m.name}, page ${m.page}`}>
                <span className="mr-mark-name">{m.name}</span>
                <span className="mr-mark-page">PAGE {m.page}</span>
              </button>
              <button type="button" className="mr-del" onClick={() => deleteMark(m.ts)}
                aria-label={`Delete mark ${m.name}`}>✕</button>
            </div>
          ))}
          {marks.length === 0 && (
            <p className="mr-empty">No page marks yet. Name the page you&rsquo;re on and save it.</p>
          )}
        </div>
      </BottomSheet>

      {/* INFO sheet */}
      <BottomSheet open={sheet === 'info'} onClose={closeSheet} title="Document info">
        <div className="mr-info">
          <div className="mr-info-row"><span className="mr-info-k">TITLE</span><span>{file.title}</span></div>
          <div className="mr-info-row"><span className="mr-info-k">SUBJECT</span><span>{props.subjectLabel}</span></div>
          <div className="mr-info-row"><span className="mr-info-k">SECTION</span><span>{props.sectionLabel}</span></div>
          <div className="mr-info-row"><span className="mr-info-k">PAGES</span><span>{total}</span></div>
          <div className="mr-info-row"><span className="mr-info-k">POSITION</span><span>Page {page} of {total} · {progress}% read</span></div>
          <div className="mr-info-row"><span className="mr-info-k">DOCUMENT</span><span>{props.docIndex + 1} of {props.docTotal}</span></div>
          <div className="mr-info-row"><span className="mr-info-k">MODES</span><span>Read = page navigation + zoom · Study = highlight, tap-to-pin notes, draw with eraser, page bookmarks · Find = in-document text search</span></div>
          <div className="mr-info-row"><span className="mr-info-k">GESTURES</span><span>Pinch or double-tap to zoom · swipe sideways to turn pages</span></div>
          <div className="mr-info-actions">
            <button type="button" className="mr-chip" onClick={() => openSheet('notes')}>Notes</button>
            <button type="button" className="mr-chip" onClick={() => openSheet('marks')}>Page Marks</button>
            {props.onPrev && (
              <button type="button" className="mr-chip" onClick={() => { closeSheet(); props.onPrev?.(); }}>← Prev doc</button>
            )}
            {props.onNext && (
              <button type="button" className="mr-chip" onClick={() => { closeSheet(); props.onNext?.(); }}>Next doc →</button>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
