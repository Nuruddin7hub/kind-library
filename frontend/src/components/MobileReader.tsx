// K/IND mobile engine — immersive study reader (ChatGPT Round C rebuild, 2026-11-04;
// Round C re-score 2026-11-04).
//
// Two-row header (row 1: back | one-line title | bookmark | overflow;
//   row 2: READ/STUDY/FIND segmented — STUDY opens a real bottom sheet) ·
//   page status row (PAGE 01/17 | 100% | expand/collapse) · horizontal
//   thumbnail strip below the page (current + adjacent + numbers + page
//   indicator, collapsible) · stage with Gradual Blur feathering on the
//   chrome edges only (never the document) · deep charcoal/navy stage,
//   page 20px below controls, full available width minus 24px, soft broad
//   shadow, true aspect ratio (never stretched/cropped).
// Modes genuinely distinct:
//   READ = page nav + zoom + FIT WIDTH/PAGE + CONTINUOUS stacked scroll +
//     ONE sticky control dock (prev / zoom-out / % / zoom-in / next;
//     second line Fit width / Fit page / Continuous, 44px min);
//   STUDY = bottom sheet: add note / bookmark page / highlight / copy text /
//     view page notes (kl:* byte-compatible);
//   FIND = compact in-doc search (count + prev/next + PAGES jump).
// Global bottom nav stays hidden (z-index 200 covers the dock).
// No Aurora/Particles in the viewport. Subtle Animated Content for
// metadata/strip only. Reduced-motion respected.
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
import GradualBlur from '../bits/GradualBlur';
import AnimatedContent from '../bits/AnimatedContent';
import { consumeReaderStartPage, consumeReaderMatch, type ReaderMatch } from '../readerStart';
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

type Sheet = 'pages' | 'pin' | 'notes' | 'marks' | 'info' | 'study' | null;

/** Reader modes (Round C re-score): Read = nav + zoom + fit + continuous;
 *  Study = a real bottom sheet with 5 actions (add note / bookmark page /
 *  highlight / copy text / view page notes); Find = in-doc search. */
type ReaderMode = 'read' | 'study' | 'find';
/** Study annotation tools (Round C re-score) — highlight + note only,
 *  launched from the Study bottom sheet. */
type StudyTool = 'highlight' | 'note' | null;

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

// Horizontal thumbnail strip below the page (Round C re-score): the current
// page highlighted + adjacent thumbnails + page numbers + a page indicator.
// Collapsible via the status-row toggle. A ±3 window around the current page
// keeps it cheap even for 100+ page documents. Aspect ratio preserved
// (object-fit contain, never stretched/cropped); no Aurora/Particles here.
function ThumbStrip({ page, total, file, railRef, goToPage, motionReduced }: {
  page: number;
  total: number;
  file: DocLite;
  railRef: React.RefObject<HTMLDivElement | null>;
  goToPage: (p: number) => void;
  motionReduced: boolean;
}) {
  const lo = Math.max(1, page - 3);
  const hi = Math.min(total, page + 3);
  const pages: number[] = [];
  for (let p = lo; p <= hi; p++) pages.push(p);
  // keep the current thumbnail in view as the page changes
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const cur = rail.querySelector('.mr-ts-thumb.on') as HTMLElement | null;
    cur?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: motionReduced ? 'auto' : 'smooth',
    });
  }, [page, railRef, motionReduced]);
  return (
    <div className="mr-thumbstrip" aria-label="Page thumbnails">
      <span className="mr-thumbstrip-count" aria-hidden="true">{page}/{total}</span>
      <div className="mr-thumbstrip-rail" ref={railRef}>
        {pages.map(p => (
          <button
            key={p}
            type="button"
            className={`mr-ts-thumb${p === page ? ' on' : ''}`}
            onClick={() => goToPage(p)}
            aria-label={`Go to page ${p}`}
            aria-current={p === page ? 'page' : undefined}
          >
            <img
              src={pageImageUrl(file.subj, file.file, p, total)}
              alt=""
              loading="lazy"
              draggable={false}
            />
            <span className="mr-ts-num">{p}</span>
          </button>
        ))}
      </div>
    </div>
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
  // Honest match banner (Round C P1): set when the reader was opened from
  // a search result — the REAL backend snippet for the opened page.
  // Shown only while the reader is on that page; dismissible; never a
  // faked phrase highlight (pages are images, no text layer).
  const [matchBanner, setMatchBanner] = useState<ReaderMatch | null>(null);
  // collapsible thumbnail strip below the page (Round C re-score):
  // current page highlighted + adjacent thumbs + numbers + page indicator
  const [thumbStripOpen, setThumbStripOpen] = useState(true);
  const thumbRailRef = useRef<HTMLDivElement>(null);
  // study sheet copy feedback ("copy text" action)
  const [studyCopied, setStudyCopied] = useState(false);
  // copy-note feedback (Study "copy" action — kl:* compatible notes)
  // read-mode layout: fit + continuous
  const [fit, setFit] = useState<'page' | 'width'>('page');
  const [continuous, setContinuous] = useState(false);
  // study tool options
  const [hlColor, setHlColor] = useState('rgba(255, 236, 140, 0.55)');
  const drawApi = useRef<DrawApi | null>(null);

  // page box geometry: real aspect ratio from the loaded image, fit into the stage
  const [imgAR, setImgAR] = useState(0.707); // w/h, updated on load
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const scrollRaf = useRef(0);
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
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

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
  const motionReducedRef = useRef(motionReduced);
  motionReducedRef.current = motionReduced;

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
  }, [mode, continuous]);

  // single-page geometry: fit-page = contain in the stage; fit-width =
  // full available width minus 24px even if it overflows vertically
  const fitW = Math.max(0, stageSize.w - 24);
  // Round C 2026-11-06 P1: stage vertical padding is 28px top + 20px
  // bottom (48px) — FIT PAGE must fit the content box exactly, so the
  // whole page is visible with no scroll at 100%.
  const fitH = Math.max(0, stageSize.h - 48);
  let baseW = fitW, baseH = fitW / Math.max(0.2, imgAR);
  if (fit === 'page' && baseH > fitH) { baseH = fitH; baseW = fitH * Math.max(0.2, imgAR); }
  const boxW = Math.max(40, Math.round(baseW * zoom / 100));
  const boxH = Math.max(40, Math.round(baseH * zoom / 100));
  // continuous geometry: every page at full width minus 24px, 18px gutters
  const contW = Math.max(40, Math.round(fitW * zoom / 100));
  const contH = Math.max(40, Math.round(contW / Math.max(0.2, imgAR)));

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
    setFit('page'); setContinuous(false);
    setNoteDraft(''); setMarkDraft(''); setPinDraft(''); setPinAt(null); setPinPop(null);
    setPageInput(''); setFtQuery(''); setFtHits([]); setFtLoading(false); setFtIdx(0);
    setMatchBanner(null);
    setHlColor('rgba(255, 236, 140, 0.55)');
    setThumbStripOpen(true);
    setNotes(loadNotes(file.key));
    setMarks(loadMarks(file.key));
    pageEls.current.clear();
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
    if (sc) {
      if (continuousRef.current) {
        const el = pageEls.current.get(pg);
        if (el) {
          sc.scrollTo({
            top: Math.max(0, el.offsetTop - 20),
            behavior: motionReducedRef.current ? 'auto' : 'smooth',
          });
        }
      } else {
        sc.scrollTop = 0; sc.scrollLeft = 0;
      }
    }
    persistPage(pg);
    setSheet(null);
  }, [total, persistPage]);

  // continuous scroll → the nearest page becomes current
  const onStageScroll = useCallback(() => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const sc = stageRef.current;
      if (!sc) return;
      const top = sc.scrollTop + 80;
      let best = 1, bestD = Infinity;
      pageEls.current.forEach((el, p) => {
        const d = Math.abs(el.offsetTop - top);
        if (d < bestD) { bestD = d; best = p; }
      });
      if (best !== pageRef.current) {
        setPage(best);
        persistPage(best);
      }
    });
  }, [persistPage]);

  const toggleContinuous = useCallback((v: boolean) => {
    setTool(null);
    setContinuous(v);
    requestAnimationFrame(() => {
      const sc = stageRef.current;
      if (!sc) return;
      if (v) {
        const el = pageEls.current.get(pageRef.current);
        if (el) sc.scrollTop = Math.max(0, el.offsetTop - 20);
      } else {
        sc.scrollTop = 0; sc.scrollLeft = 0;
      }
    });
  }, []);

  // restore reading position — a pending exact-page open from search wins
  // over everything. kl:posx restores zoom; otherwise fall back to kl:pos.
  // A pending search-match banner (real snippet for the opened page) is
  // consumed alongside the forced page.
  useEffect(() => {
    if (restored.current) return;
    const forced = consumeReaderStartPage(file.key);
    const match = consumeReaderMatch(file.key);
    if (match) setMatchBanner(match);
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
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
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
  // GO TO NEXT MATCH (Round C P0): jump to the next matching page AFTER
  // the current page (wraps to the first match). Computed from the live
  // page, not the stale ftIdx — the user may have navigated by hand.
  const ftNextMatch = useCallback(() => {
    if (!ftPages.length) return;
    const after = ftPages.findIndex(p => p > pageRef.current);
    const n = after >= 0 ? after : 0;
    setFtIdx(n);
    goToPage(ftPages[n]);
  }, [ftPages, goToPage]);

  const switchMode = useCallback((m: ReaderMode) => {
    setSheet(null);
    setTool(null);
    // continuous scroll is a read-mode layout — leaving read resets it
    if (m !== 'read' && continuousRef.current) {
      setContinuous(false);
      requestAnimationFrame(() => {
        const sc = stageRef.current;
        if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; }
      });
    }
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
  const [copiedTs, setCopiedTs] = useState<number | null>(null);
  // "copy" in the Study bottom-sheet actions: copy a note's text to the
  // clipboard (notes stay kl:*-compatible — read from the same store)
  const copyNote = useCallback(async (text: string, ts: number) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedTs(ts);
        window.setTimeout(() => setCopiedTs(c => (c === ts ? null : c)), 1600);
      }
    } catch { /* clipboard unavailable — nothing to do */ }
  }, []);

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
    { id: 'read', label: 'READ', aria: 'Read mode — page navigation, zoom, fit, continuous scroll' },
    { id: 'study', label: 'STUDY', aria: 'Study mode — add note, bookmark page, highlight, copy text, view page notes' },
    { id: 'find', label: 'FIND', aria: 'Find mode — search in this document' },
  ];

  const HL_COLORS = [
    { c: 'rgba(255, 236, 140, 0.55)', label: 'Yellow highlighter' },
    { c: accent, label: 'Subject highlighter' },
    { c: 'rgba(255, 150, 180, 0.5)', label: 'Pink highlighter' },
  ];

  const inking = tool === 'highlight';
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

  const stripStatus =
    mode === 'read'
      ? continuous ? `CONTINUOUS · ${zoom}%` : `${zoom}% · FIT ${fit.toUpperCase()}`
      : ftQuery.trim().length >= 2 ? `${ftTotalMatches} HIT${ftTotalMatches === 1 ? '' : 'S'}` : 'IN-DOCUMENT SEARCH';

  // STUDY bottom sheet actions (Round C re-score) — all kl:* byte-compatible
  const studyAddNote = useCallback(() => setSheet('notes'), []);
  const studyViewNotes = useCallback(() => setSheet('notes'), []);
  const studyHighlight = useCallback(() => {
    setTool('highlight');
    setSheet(null);
  }, []);
  const studyBookmarkPage = useCallback(() => {
    saveMark(); // markDraft is empty here → saved as "Page N" (kl:marks)
    setSheet(null);
  }, [saveMark]);
  const studyCopyText = useCallback(async () => {
    // page content is server-rendered images (no text layer) — the honest
    // "copy text" is the document citation for this page
    const text = `${file.title} — page ${page} of ${total}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setStudyCopied(true);
        window.setTimeout(() => setStudyCopied(false), 1600);
      }
    } catch { /* clipboard unavailable — nothing to do */ }
    setSheet(null);
  }, [file.title, page, total]);

  const pageBox = (p: number, w: number, h: number, cont?: boolean) => (
    <div
      key={p}
      className="mr-pagebox"
      style={{ width: w, height: h }}
      ref={cont ? (el => { if (el) pageEls.current.set(p, el); else pageEls.current.delete(p); }) : undefined}
      onPointerDown={cont ? undefined : onPagePointerDown}
      onPointerUp={cont ? undefined : onPagePointerUp}
    >
      <img
        src={pageImageUrl(file.subj, file.file, p, total)}
        alt={`Page ${p}`}
        className="mr-pageimg"
        draggable={false}
        loading={cont && p > 6 ? 'lazy' : undefined}
        onLoad={e => {
          const im = e.currentTarget;
          if (im.naturalWidth > 0 && im.naturalHeight > 0) {
            setImgAR(im.naturalWidth / im.naturalHeight);
          }
        }}
      />
      {!cont && (
        <DrawLayer
          key={`${file.key}-${p}`}
          page={p}
          docKey={file.key}
          ink={inking}
          color={hlColor}
          width={10}
          erase={false}
          apiRef={drawApi}
        />
      )}
      {/* tap-pinned notes, positioned relative to the page (single-page only) */}
      {!cont && p === page && pinned.map(n => (
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
  );

  return (
    <div
      className={`mr-reader${motionReduced ? ' mr-reduced-motion' : ''}`}
      style={{ ['--subject-accent' as any]: accent }}
    >
      {/* two-row header — row 1: back | ONE-LINE truncated title |
          bookmark | overflow (1420 loop: no more compressed two-line stack).
          Tap the title for the full title + document info. */}
      <div className="mr-head">
        <div className="mr-row1">
          <button type="button" className="mr-back" onClick={props.onClose} aria-label="Back to library">‹</button>
          <button
            type="button"
            className="mr-titlewrap"
            onClick={() => openSheet('info')}
            aria-label={`${file.title} — show full title and document info`}
          >
            <span className="mr-title">{file.title}</span>
          </button>
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
        {/* row 2: FULL-WIDTH segmented Read/Study/Find (min 40px, 1420 loop) */}
        <div className="mr-row2">
          <div className="mr-modeseg" role="tablist" aria-label="Reader mode">
            <span
              className="mr-modepill"
              aria-hidden="true"
              style={{ transform: `translateX(${MODES.findIndex(m => m.id === mode) * 100}%)` }}
            />
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                className={`mr-modebtn${mode === m.id ? ' on' : ''}`}
                // Round C re-score: STUDY is a real bottom sheet, not a mode
                onClick={() => (m.id === 'study' ? openSheet('study') : switchMode(m.id))}
                aria-label={m.aria}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* page status row (Round C re-score): PAGE 01/17 | 100% |
          expand/collapse — the toggle collapses the thumbnail strip below */}
      <div className="mr-strip">
        <button
          type="button"
          className="mr-strip-page"
          onClick={() => openSheet('pages')}
          aria-label={`Open page thumbnails, currently page ${page} of ${total}`}
        >
          PAGE <strong>{String(page).padStart(2, '0')}/{total}</strong>
        </button>
        <span className="mr-strip-sep" aria-hidden="true">|</span>
        <span className="mr-strip-status" aria-live="polite">{stripStatus}</span>
        <button
          type="button"
          className="mr-strip-toggle"
          onClick={() => setThumbStripOpen(v => !v)}
          aria-label={thumbStripOpen ? 'Collapse thumbnail strip' : 'Expand thumbnail strip'}
          aria-expanded={thumbStripOpen}
        >
          {thumbStripOpen ? '▴' : '▾'}
        </button>
      </div>

      {/* Honest match banner (Round C P1): shown only when this reader was
          opened from a search result AND is still on the matched page.
          Plain real snippet text — never a faked phrase highlight. */}
      {matchBanner && matchBanner.page === page && (
        <div className="mr-matchbanner" role="status">
          <span className="mr-matchbanner-label">MATCH ON THIS PAGE</span>
          <span className="mr-matchbanner-text">{matchBanner.snippet}</span>
          <button
            type="button"
            className="mr-matchbanner-close"
            onClick={() => setMatchBanner(null)}
            aria-label="Dismiss match banner"
          >
            ✕
          </button>
        </div>
      )}

      {/* contextual mini-toolbar per tool: tool controls + Undo + Cancel.
          Launched from the Study bottom sheet (Round C re-score) — the
          highlight tool keeps its swatches, the note tool its pin hint. */}
      {tool === 'highlight' && (
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
      {tool === 'note' && (
        <div className="mr-ctxbar" role="toolbar" aria-label="Note options">
          <span className="mr-ctx-hint">TAP THE PAGE TO PIN A NOTE</span>
          <button type="button" className="mr-ctxbtn" onClick={() => openSheet('notes')}>VIEW NOTES</button>
          <button type="button" className="mr-ctxbtn mr-ctxdone" onClick={() => setTool(null)}>CANCEL</button>
        </div>
      )}

      {/* .reader-stage: page at REAL aspect ratio, 20px below the controls —
          the Study organizer is gone (Round C re-score): Study is a bottom sheet. */}
        <div className="mr-stagewrap">
          <div
            ref={stageRef}
            className={`mr-stage${continuous ? ' mr-stage-cont' : ''}`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onScroll={continuous ? onStageScroll : undefined}
          >
            {continuous
              ? Array.from({ length: total }, (_, i) => i + 1).map(p => pageBox(p, contW, contH, true))
              : pageBox(page, boxW, boxH, false)}
          </div>
          {/* Gradual Blur feathering on the chrome edges only — never the document */}
          <GradualBlur position="top" height="20px" strength={1.4} layers={6} zIndex={4} />
          <GradualBlur position="bottom" height="20px" strength={1.4} layers={6} zIndex={4} />
        </div>

      {/* Round C re-score: horizontal thumbnail strip below the page —
          current highlighted + adjacent + numbers + page indicator,
          collapsible via the status-row toggle */}
      {thumbStripOpen && mode === 'read' && (
        <ThumbStrip
          page={page}
          total={total}
          file={file}
          railRef={thumbRailRef}
          goToPage={goToPage}
          motionReduced={motionReduced}
        />
      )}

      {/* Read mode: page nav + zoom + fit + continuous */}
      {mode === 'read' && (
        <div className="mr-readbar" role="toolbar" aria-label="Page navigation and zoom">
          <div className="mr-readbar-row">
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
          <div className="mr-readbar-row mr-readbar-opts">
            {!continuous && (
              <div className="mr-fitseg" role="group" aria-label="Page fit">
                <button
                  type="button"
                  className={`mr-fitbtn${fit === 'width' ? ' on' : ''}`}
                  onClick={() => setFit('width')}
                  aria-pressed={fit === 'width'}
                >
                  FIT WIDTH
                </button>
                <button
                  type="button"
                  className={`mr-fitbtn${fit === 'page' ? ' on' : ''}`}
                  onClick={() => setFit('page')}
                  aria-pressed={fit === 'page'}
                >
                  FIT PAGE
                </button>
              </div>
            )}
            <button
              type="button"
              className={`mr-contbtn${continuous ? ' on' : ''}`}
              onClick={() => toggleContinuous(!continuous)}
              aria-pressed={continuous}
              aria-label={continuous ? 'Exit continuous scroll' : 'Continuous scroll — all pages in one column'}
            >
              {continuous ? '◉ CONTINUOUS' : '○ CONTINUOUS'}
            </button>
          </div>
        </div>
      )}

      {/* Find mode: compact search bar + match count + prev/next + PAGES jump */}
      {mode === 'find' && (
        motionReduced ? (
          <FindPanel
            ftQuery={ftQuery}
            setFtQuery={setFtQuery}
            ftLoading={ftLoading}
            ftTotalMatches={ftTotalMatches}
            ftPages={ftPages}
            ftIdx={ftIdx}
            ftStep={ftStep}
            ftHits={ftHits}
            findInputRef={findInputRef}
            goToPage={goToPage}
            openSheet={openSheet}
            page={page}
            goToNextMatch={ftNextMatch}
          />
        ) : (
          <AnimatedContent
            key="find"
            trigger="mount"
            distance={14}
            duration={0.28}
            ease="power3.out"
            once
            className="mr-ac-panel-bottom"
          >
            <FindPanel
              ftQuery={ftQuery}
              setFtQuery={setFtQuery}
              ftLoading={ftLoading}
              ftTotalMatches={ftTotalMatches}
              ftPages={ftPages}
              ftIdx={ftIdx}
              ftStep={ftStep}
              ftHits={ftHits}
              findInputRef={findInputRef}
              goToPage={goToPage}
              openSheet={openSheet}
              page={page}
              goToNextMatch={ftNextMatch}
            />
          </AnimatedContent>
        )
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
              <button type="button" className="mr-copy" onClick={() => copyNote(n.text, n.ts)}
                aria-label={copiedTs === n.ts ? 'Note copied' : `Copy note from page ${n.page}`}>
                {copiedTs === n.ts ? '✓' : '⧉'}
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
          <div className="mr-info-row"><span className="mr-info-k">MODES</span><span>Read = page navigation + zoom + fit + continuous scroll · Study = add note, bookmark page, highlight, copy text, view page notes · Find = in-document text search</span></div>
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

      {/* STUDY — a real bottom sheet (Round C re-score): add note /
          bookmark page / highlight / copy text / view page notes.
          Every action is kl:* byte-compatible (kl:notes / kl:marks /
          kl:draw). */}
      <BottomSheet open={sheet === 'study'} onClose={closeSheet} title={`Study · page ${page}`} height="auto">
        <div className="mr-study-actions">
          <button type="button" className="mr-study-action" onClick={studyAddNote}>
            <span className="mr-study-action-icon" aria-hidden="true">✚</span>
            <span className="mr-study-action-text">ADD NOTE
              <span className="mr-study-action-sub">Write on this page</span>
            </span>
            <span className="mr-study-action-go" aria-hidden="true">›</span>
          </button>
          <button type="button" className="mr-study-action" onClick={studyBookmarkPage}>
            <span className="mr-study-action-icon" aria-hidden="true">⚑</span>
            <span className="mr-study-action-text">BOOKMARK PAGE
              <span className="mr-study-action-sub">Save page {page} for later</span>
            </span>
            <span className="mr-study-action-go" aria-hidden="true">›</span>
          </button>
          <button type="button" className="mr-study-action" onClick={studyHighlight}>
            <span className="mr-study-action-icon" aria-hidden="true">▬</span>
            <span className="mr-study-action-text">HIGHLIGHT
              <span className="mr-study-action-sub">Swipe over key passages</span>
            </span>
            <span className="mr-study-action-go" aria-hidden="true">›</span>
          </button>
          <button type="button" className="mr-study-action" onClick={studyCopyText}>
            <span className="mr-study-action-icon" aria-hidden="true">⧉</span>
            <span className="mr-study-action-text">{studyCopied ? 'COPIED ✓' : 'COPY TEXT'}
              <span className="mr-study-action-sub">Copy this page's citation</span>
            </span>
            <span className="mr-study-action-go" aria-hidden="true">›</span>
          </button>
          <button type="button" className="mr-study-action" onClick={studyViewNotes}>
            <span className="mr-study-action-icon" aria-hidden="true">☰</span>
            <span className="mr-study-action-text">VIEW PAGE NOTES
              <span className="mr-study-action-sub">
                {pageNotes.length === 0 ? 'No notes on this page yet' : `${pageNotes.length} note${pageNotes.length === 1 ? '' : 's'} on this page`}
              </span>
            </span>
            <span className="mr-study-action-go" aria-hidden="true">›</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ================= FIND compact panel ================= */

function FindPanel({ ftQuery, setFtQuery, ftLoading, ftTotalMatches, ftPages, ftIdx,
  ftStep, ftHits, findInputRef, goToPage, openSheet, page, goToNextMatch }: {
  ftQuery: string;
  setFtQuery: (q: string) => void;
  ftLoading: boolean;
  ftTotalMatches: number;
  ftPages: number[];
  ftIdx: number;
  ftStep: (dir: 1 | -1) => void;
  ftHits: Array<{ page_number: number; snippet: string; match_count: number }>;
  findInputRef: React.RefObject<HTMLInputElement | null>;
  goToPage: (p: number) => void;
  openSheet: (s: 'pages') => void;
  page: number;
  goToNextMatch: () => void;
}) {
  // Truthful zero-results feedback (Round C P0): the FIND search checks
  // the WHOLE document — /api/search scans every page's text and returns
  // all matching pages — so "no matches in this document" is honest
  // exactly when the hit list is empty. When matches exist but none on
  // the current page, say so and offer the jump. The query stays in the
  // field (controlled input) so it can be edited without starting over.
  const searched = ftQuery.trim().length >= 2;
  const hasMatchOnPage = ftHits.some(h => h.page_number === page);
  return (
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
        <button type="button" className="mr-findpages" onClick={() => openSheet('pages')}
          aria-label="Jump to a page">PAGES</button>
      </div>
      <div className="mr-ft-list mr-findresults">
        {searched && !ftLoading && ftHits.length === 0 && (
          <div className="mr-ft-status" role="status">
            <span className="mr-ft-status-label">NO MATCHES IN THIS DOCUMENT</span>
            <p className="mr-ft-status-body">No matches found in this document.</p>
          </div>
        )}
        {searched && !ftLoading && ftHits.length > 0 && !hasMatchOnPage && (
          <div className="mr-ft-status" role="status">
            <span className="mr-ft-status-label">0 HITS ON THIS PAGE</span>
            <p className="mr-ft-status-body">Matches exist on other pages.</p>
            <button type="button" className="mr-ft-goto" onClick={goToNextMatch}>
              GO TO NEXT MATCH
            </button>
          </div>
        )}
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
      </div>
    </div>
  );
}
