import { useEffect, useRef, useState, useCallback } from 'react';
import { consumeReaderStartPage } from '../readerStart';
import { v2SubjectColor } from '../shared';
import AnimatedContent from '../bits/AnimatedContent';
import GlareHover from '../bits/GlareHover';
import DarkVeil from '../bits/DarkVeil';
import '../styles/reader-env.css';

interface ReaderFile {
  key: string;
  subj: string;
  title: string;
  section: string;
  file: string;
  pages: number;
}

interface ContentsSection {
  id: string;
  label: string;
  docs: ReaderFile[];
}

interface Props {
  file: ReaderFile;
  sectionLabel: string;
  onClose: () => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  docIndex: number;
  docTotal: number;
  contents: ContentsSection[];
  bookmarkedDocs: ReaderFile[];
  onOpenDoc: (key: string) => void;
  /** per-subject document number (real position within its subject,
      in library order) for the identity strip */
  docNumber?: number;
}

function pageImageUrl(subj: string, file: string, page: number, totalPages: number): string {
  const stem = file.replace(/\.pdf$/i, '');
  const digits = String(totalPages).length;
  const nn = String(page).padStart(digits, '0');
  return `/assets/pages/${subj}/${stem}/p-${nn}.jpg`;
}

const posKey = (k: string) => `kl:pos:${k}`;
const notesKey = (k: string) => `kl:notes:${k}`;

const SUBJECT_LABELS: Record<string, string> = {
  em2: 'EM2 · Mathematics',
  signals: 'Signals & Systems',
  fis: 'FIS · Philosophy',
  digital: 'Digital Electronics',
};

const SUBJECT_CODES: Record<string, string> = {
  em2: 'EM2',
  signals: 'SIGNALS',
  fis: 'FIS',
  digital: 'DIGITAL',
};

interface Note {
  page: number;
  text: string;
  ts: number;
}

/** A page bookmark: this document, one page, navigable. Stored per
 *  document in localStorage (kl:pagebm:<key>) — persists across
 *  sessions (P2 acceptance: bookmarks persist). */
interface PageBookmark {
  page: number;
  ts: number;
}

/** A highlight: a marked page + the reader's own label. Pages are
 *  server-rendered images with no text layer, so a highlight marks
 *  the passage's page (with page ref + navigate) rather than a
 *  fake text selection. Stored per document (kl:highlights:<key>). */
interface Highlight {
  page: number;
  label: string;
  ts: number;
  /** ROUND A 2026-11-07 (critiqueA-1420 §P3.3): highlight colour —
      distinguishable, not neon. Defaults to yellow for older saves. */
  color?: HlColor;
}

/** Highlight colours (spec §P3.3): Yellow / Cyan / Pink. */
const HL_COLORS = {
  yellow: { label: 'Yellow', dot: '#E8C86A' },
  cyan: { label: 'Cyan', dot: '#59DED3' },
  pink: { label: 'Pink', dot: '#E89BB0' },
} as const;
type HlColor = keyof typeof HL_COLORS;

interface TocEntry {
  page: number;
  title: string;
  level: number;
}

function loadNotes(key: string): Note[] {
  try {
    const raw = JSON.parse(localStorage.getItem(notesKey(key)) || '[]');
    return Array.isArray(raw) ? raw.filter(n => typeof n?.text === 'string') : [];
  } catch { return []; }
}

function loadPageBms(key: string): PageBookmark[] {
  try {
    const raw = JSON.parse(localStorage.getItem(`kl:pagebm:${key}`) || '[]');
    return Array.isArray(raw) ? raw.filter(n => typeof n?.page === 'number') : [];
  } catch { return []; }
}

function loadHighlights(key: string): Highlight[] {
  try {
    const raw = JSON.parse(localStorage.getItem(`kl:highlights:${key}`) || '[]');
    return Array.isArray(raw) ? raw.filter(n => typeof n?.page === 'number') : [];
  } catch { return []; }
}

/** PdfReader — desktop study workspace (ChatGPT Round C P2 rebuild,
 *  2026-11-06). Three zones: 200px thumbnail rail · centre PDF stage ·
 *  310px study tools (BOOKMARKS / NOTES / CONTENTS / HIGHLIGHTS, each
 *  a full working area). Document header 68px, bottom controls 52px.
 *  Pages are server-rendered PDF page images — real PDF content
 *  (decision: no PDF.js). Rendering, pagination and zoom logic are
 *  untouched by the visual rebuild. */
export default function PdfReader({
  file, sectionLabel, onClose, bookmarked, onToggleBookmark,
  onPrev, onNext, docIndex, docTotal, contents, bookmarkedDocs, onOpenDoc,
  docNumber,
}: Props) {
  const [zoom, setZoom] = useState(100);
  const [visiblePage, setVisiblePage] = useState(1);
  const [immersive, setImmersive] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [gotoVal, setGotoVal] = useState('');
  const [leftOpen, setLeftOpen] = useState(() => {
    try { return localStorage.getItem('kl:rail') !== '0'; } catch { return true; }
  });
  const [rightOpen, setRightOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('kl:tools');
      // ROUND A 2026-11-07 (critiqueA-1420 §P3.1): below 1200px the
      // study console starts collapsed — the reader opens it with
      // TOOLS when wanted — unless the reader already chose.
      if (stored !== null) return stored !== '0';
      return window.innerWidth >= 1200;
    } catch { return true; }
  });
  // P2: four full working areas — BOOKMARKS / NOTES / CONTENTS /
  // HIGHLIGHTS — shown as stacked Study Console modules (Round A
  // 2026-11-07: no tabs; every module visible at once).
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(file.key));
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  // Page bookmarks + highlights for THIS document (persisted).
  const [pageBms, setPageBms] = useState<PageBookmark[]>(() => loadPageBms(file.key));
  const [highlights, setHighlights] = useState<Highlight[]>(() => loadHighlights(file.key));
  const [hlDraft, setHlDraft] = useState('');
  const [hlColor, setHlColor] = useState<HlColor>('yellow');
  // Contents: real PDF TOC from /api/toc where available (heading
  // lines from the actual PDF text); falls back to the subject's
  // section → document list (the `contents` prop) when the doc has
  // no extractable headings.
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [tocLoaded, setTocLoaded] = useState(false);
  // Find in document: real full-text matches from /api/search,
  // filtered to this document — passages with page + snippet.
  const [findQ, setFindQ] = useState('');
  const [findResults, setFindResults] = useState<Array<{ page_number: number; snippet: string; match_count: number }>>([]);
  const [findSearching, setFindSearching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const total = file.pages || 1;
  const restored = useRef(false);
  // exact-page restore: timestamp of our last programmatic scroll, and a
  // flag set when the user scrolls on their own (cancels the align loop)
  const lastAlignAt = useRef(0);
  const alignCancelled = useRef(false);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onUserScroll = () => {
      if (Date.now() - lastAlignAt.current > 400) alignCancelled.current = true;
    };
    scroller.addEventListener('scroll', onUserScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onUserScroll);
  }, [file.key]);

  const goToPage = useCallback((p: number) => {
    const page = Math.max(1, Math.min(total, p));
    const el = document.getElementById(`kl-page-${page}`);
    if (el) el.scrollIntoView({ block: 'start' });
    setVisiblePage(page);
  }, [total]);

  const toggleLeft = useCallback(() => {
    setLeftOpen(v => {
      try { localStorage.setItem('kl:rail', v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  }, []);
  const toggleRight = useCallback(() => {
    setRightOpen(v => {
      try { localStorage.setItem('kl:tools', v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  }, []);

  useEffect(() => {
    setZoom(100);
    setVisiblePage(1);
    setImmersive(false);
    setReadingMode(false);
    setGotoVal('');
    setNotes(loadNotes(file.key));
    setNoteDraft('');
    setEditingNote(null);
    setPageBms(loadPageBms(file.key));
    setHighlights(loadHighlights(file.key));
    setHlDraft('');
    setHlColor('yellow');
    setFindQ('');
    setFindResults([]);
    restored.current = false;
    alignCancelled.current = false;
  }, [file.key]);

  // persist notes per document
  useEffect(() => {
    try { localStorage.setItem(notesKey(file.key), JSON.stringify(notes)); } catch { /* ignore */ }
  }, [file.key, notes]);

  // persist page bookmarks + highlights per document
  useEffect(() => {
    try { localStorage.setItem(`kl:pagebm:${file.key}`, JSON.stringify(pageBms)); } catch { /* ignore */ }
  }, [file.key, pageBms]);
  useEffect(() => {
    try { localStorage.setItem(`kl:highlights:${file.key}`, JSON.stringify(highlights)); } catch { /* ignore */ }
  }, [file.key, highlights]);

  // load the real PDF table of contents for this document
  useEffect(() => {
    setToc([]);
    setTocLoaded(false);
    let cancelled = false;
    fetch(`/api/toc?key=${encodeURIComponent(file.key)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setToc(Array.isArray(d.entries) ? d.entries : []); setTocLoaded(true); } })
      .catch(() => { if (!cancelled) setTocLoaded(true); });
    return () => { cancelled = true; };
  }, [file.key]);

  // find in document — debounced /api/search, this document only
  useEffect(() => {
    const q = findQ.trim();
    if (q.length < 2) { setFindResults([]); setFindSearching(false); return; }
    setFindSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => {
          const hit = (d.results || []).find((h: { key: string }) => h.key === file.key);
          setFindResults(hit?.passages || []);
          setFindSearching(false);
        })
        .catch(() => { if (!ctrl.signal.aborted) { setFindResults([]); setFindSearching(false); } });
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [findQ, file.key]);

  // restore reading position once pages are in the DOM
  // (a pending exact-page open from search wins over the saved position).
  // Lazy-loaded page images shift layout, so jump immediately (best effort)
  // then re-assert until the target page actually sits at the stage top.
  useEffect(() => {
    if (restored.current) return;
    let saved = 1;
    const forced = consumeReaderStartPage(file.key);
    if (forced) {
      saved = forced;
    } else {
      try {
        saved = parseInt(localStorage.getItem(posKey(file.key)) || '1', 10) || 1;
      } catch { /* ignore */ }
    }
    saved = Math.min(Math.max(1, saved), total);
    const target = saved;
    const align = () => {
      const scroller = scrollRef.current;
      const el = document.getElementById(`kl-page-${target}`);
      if (!el || !scroller) return false;
      const r = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      // Round A 2026-11-08: pages carry scroll-margin-top 66px
      // (identity strip 58px + 8px air) so the page top never hides
      // under the sticky strip — align to sr.top + 66, not sr.top.
      if (Math.abs(r.top - sr.top - 66) > 30) {
        lastAlignAt.current = Date.now();
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
      if (alignCancelled.current) {
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

  // track the page nearest the viewport center → persist reading position.
  // While the exact-page restore is still aligning, the align loop owns the
  // label — the tracker would otherwise flash noisy intermediate pages.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let raf = 0;
    let last = 1;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!restored.current) return;
        let best = 1;
        let bestDist = Infinity;
        for (let p = 1; p <= total; p++) {
          const el = document.getElementById(`kl-page-${p}`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const top = r.top - scroller.getBoundingClientRect().top;
          const dist = Math.abs(top + r.height / 2 - scroller.clientHeight / 2);
          if (dist < bestDist) { bestDist = dist; best = p; }
        }
        if (best !== last) {
          last = best;
          setVisiblePage(best);
          try { localStorage.setItem(posKey(file.key), String(best)); } catch { /* ignore */ }
        }
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [file.key, total]);

  // keyboard: Escape closes (or exits reading mode), arrows turn pages, Home/End jump
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (readingMode) setReadingMode(false); else onClose(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(visiblePage - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(visiblePage + 1); }
      else if (e.key === 'Home') { e.preventDefault(); goToPage(1); }
      else if (e.key === 'End') { e.preventDefault(); goToPage(total); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goToPage, visiblePage, total, readingMode]);

  // page width derives from the available viewport (Round C: document canvas
  // is the dominant surface) — preserves the PDF's natural aspect ratio.
  // Round C 2026-11-07: cap 900 → 980 (spec: .reader-document
  // max-width 980px); the stage itself grew too (82px/244px rails).
  // ROUND A 2026-11-08 (critiqueA-2026-11-08-1420 §C): cap 980 →
  // 1100 — with the console collapsed or in reading mode the stage
  // is 1384-1440px wide, and the old cap froze the page at 980px
  // (verified live: collapse grew the stage +250px, page stayed
  // 980). At the normal 1066px stage the page is 994px (+14px);
  // collapsed/reading it expands to 1100px.
  const [stageW, setStageW] = useState(() =>
    typeof window !== 'undefined' ? Math.max(900, window.innerWidth - 420) : 1100);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setStageW(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [file.key]);
  const pageW = Math.max(320, Math.min(1100, stageW - 72)) * (zoom / 100);

  const goFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  /** Fit page: zoom so the page fills the stage width (spec: bottom
   *  controls include FIT PAGE). At 100% the page already fills the
   *  stage when the stage is narrower than 1100px. */
  const fitPage = useCallback(() => {
    const avail = stageW - 72;
    const z = avail > 1100 ? Math.min(200, Math.round((avail / 1100) * 100)) : 100;
    setZoom(z);
  }, [stageW]);

  const addNote = useCallback(() => {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes(prev => [...prev, { page: visiblePage, text, ts: Date.now() }]);
    setNoteDraft('');
  }, [noteDraft, visiblePage]);

  const addPageBookmark = useCallback(() => {
    setPageBms(prev => prev.some(b => b.page === visiblePage)
      ? prev
      : [...prev, { page: visiblePage, ts: Date.now() }].sort((a, b) => a.page - b.page));
  }, [visiblePage]);

  const addHighlight = useCallback(() => {
    const label = hlDraft.trim() || `Page ${visiblePage}`;
    setHighlights(prev => [...prev, { page: visiblePage, label, color: hlColor, ts: Date.now() }]);
    setHlDraft('');
  }, [hlDraft, visiblePage, hlColor]);

  const saveNoteEdit = useCallback(() => {
    const text = editDraft.trim();
    if (!text || editingNote === null) { setEditingNote(null); return; }
    setNotes(prev => prev.map(n => n.ts === editingNote ? { ...n, text } : n));
    setEditingNote(null);
  }, [editDraft, editingNote]);

  // subject accent — Obsidian Archive v2.0 identity tokens (desktop)
  const subjectAccent = v2SubjectColor(file.subj);
  const subjectLabel = SUBJECT_LABELS[file.subj] || file.subj;
  const panelsHidden = readingMode;
  const showLeft = leftOpen && !panelsHidden;
  const showRight = rightOpen && !panelsHidden;

  return (
    <div className={`reader-shell kiA-v2${readingMode ? ' reading' : ''}`}
      style={{ ['--subject-accent' as any]: subjectAccent, ['--subj-color' as any]: v2SubjectColor(file.subj) }}>
      {/* Round A 2026-11-08 spec §10: Reader background identity =
          React Bits Dark Veil (vendored, verified real). A slow dark
          veil behind the whole shell; the PDF stage is transparent
          so it shows around the pages (field-edition.css). The
          panels keep their solid surfaces; the veil never takes
          the pointer. */}
      <div className="reader-veil" aria-hidden="true">
        <DarkVeil
          color="#123a4d"
          speed={0.25}
          scale={1}
          brightness={0.5}
          glow={0.3}
          grain={0.03}
          opacity={0.55}
          mouseInteraction={false}
          intro
        />
      </div>
      {/* document header — title + subject/type/pages (68px, P2).
          ROUND A 2026-11-07: the header hides in reading mode —
          the floating minimal toolbar takes over (see below). */}
      {!immersive && !readingMode && (
        <div className="ke-reader-header">
          <div className="ke-reader-header-group">
            {/* ROUND A 2026-11-07 (spec §P3.2): the back action is
                labelled "← Library", not a bare arrow. */}
            <button onClick={onClose} className="ke-reader-btn ke-reader-back" aria-label="Back to library">← Library</button>
            <button onClick={() => onPrev?.()} disabled={!onPrev} className="ke-reader-btn" aria-label="Previous document">‹</button>
            <button onClick={() => onNext?.()} disabled={!onNext} className="ke-reader-btn" aria-label="Next document">›</button>
          </div>
          <div className="ke-reader-header-title">
            <div className="ke-reader-title-text">{file.title}</div>
            {/* ROUND C 2026-11-08 (critiqueC-2026-11-08-1420 Round F
                §C Fix 4): the header keeps document identity only
                (subject / type / DOC n/N). Page + zoom already live
                in the identity strip, the page-context module and
                the bottom bar — repeating them here was the fourth
                copy of the same page info. */}
            <div className="ke-reader-submeta">
              {subjectLabel} · {sectionLabel} · DOC {docIndex + 1}/{docTotal}
            </div>
          </div>
          <div className="ke-reader-header-group">
            <button
              onClick={onToggleBookmark}
              className="ke-reader-btn"
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this document'}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
              style={bookmarked ? { color: '#ffbf78' } : undefined}
            >
              {bookmarked ? '★' : '☆'}
            </button>
            <button onClick={goFullscreen} className="ke-reader-btn" aria-label="Fullscreen">⤢</button>
          </div>
        </div>
      )}

      {/* reading progress bar — floats under the compact header */}
      {!immersive && !readingMode && (
        <div className="ke-reader-progress" aria-hidden="true">
          <div style={{ width: `${total ? (visiblePage / total) * 100 : 0}%` }} />
        </div>
      )}

      {/* workspace: pages panel · document · study tools */}
      <div className={`reader-workspace${showLeft ? '' : ' no-left'}${showRight ? '' : ' no-right'}`}>
        <aside className="reader-panel reader-panel-left" aria-label="Page thumbnails">
          {showLeft && (
            <AnimatedContent
              trigger="mount"
              direction="horizontal"
              reverse={true}
              distance={24}
              duration={0.45}
              ease="power3.out"
              className="reader-panel-anim"
            >
              <div className="reader-panel-head">
                <span className="eyebrow">Page index</span>
                <button onClick={toggleLeft} className="reader-panel-toggle" aria-label="Hide pages panel">‹</button>
              </div>
              <div className="reader-thumb-grid">
                {Array.from({ length: total }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => goToPage(p)}
                    className={`reader-thumb${p === visiblePage ? ' active' : ''}`}
                    aria-label={`Go to page ${p}`} aria-current={p === visiblePage ? 'page' : undefined}>
                    <img src={pageImageUrl(file.subj, file.file, p, total)} alt={`Page ${p}`}
                      loading="lazy" draggable={false} />
                    <div className="reader-thumb-num">{String(p).padStart(2, '0')}</div>
                  </button>
                ))}
              </div>
            </AnimatedContent>
          )}
        </aside>

        <div ref={scrollRef} className="reader-document"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            setImmersive(v => !v);
          }}>
          {/* Document identity strip (Round C 2026-11-07 P1): 58px,
              grid 1fr auto, centred. Left: primary line (subject /
              type · document nn) over the document title. Right:
              page x / y · zoom%. The three elements no longer share
              one cramped flex band. */}
          <div className="reader-identity">
            <div className="reader-identity-lines">
              <span className="reader-identity-primary">{SUBJECT_CODES[file.subj] || file.subj.toUpperCase()} / {sectionLabel} · Document {String(docNumber ?? docIndex + 1).padStart(2, '0')}</span>
              <span className="reader-identity-title">{file.title}</span>
            </div>
            <span className="reader-identity-page">Page {visiblePage} / {total} · {total ? Math.round((visiblePage / total) * 100) : 0}%</span>
          </div>
          <div className="flex flex-col items-center gap-8">
            {Array.from({ length: total }, (_, i) => i + 1).map(p => (
              <div key={p} id={`kl-page-${p}`} className="reader-doc-page">
                {/* No maxWidth on the img: pageW is already clamped
                    to stageW-72 so the image can never overflow the
                    stage; maxWidth:'100%' + the shrink-to-fit
                    .reader-doc-page wrapper pinned the rendered width
                    to the pre-collapse 980px even after the cap went
                    to 1100 (probe_debug: style 1100px, rect 980px;
                    natural image is 1500px wide). */}
                <img
                  src={pageImageUrl(file.subj, file.file, p, total)}
                  alt={`Page ${p}`}
                  loading={p <= 3 ? 'eager' : 'lazy'}
                  className="ke-reader-page"
                  style={{ width: `${pageW}px` }}
                  draggable={false}
                />
                <div className="reader-doc-num">{p}</div>
              </div>
            ))}
            <div className="h-8" />
          </div>
        </div>

        <aside className="reader-panel reader-panel-right" aria-label="Study console">
          {showRight && (
            <AnimatedContent
              trigger="mount"
              direction="horizontal"
              distance={24}
              duration={0.45}
              ease="power3.out"
              className="reader-panel-anim"
            >
                            <div className="reader-panel-head">
                <div className="reader-console-head">
                  <span className="eyebrow">Study console</span>
                  <span className="reader-console-doc">Document / {SUBJECT_CODES[file.subj] || file.subj.toUpperCase()}</span>
                  {/* ROUND A 2026-11-07 (spec §P3.3 DOCUMENT section):
                      the console names the document it belongs to. */}
                  <span className="reader-console-title">{file.title}</span>
                </div>
                {/* ROUND A 2026-11-08 (critiqueA-2026-11-08-1420 §C):
                    console collapse is a labelled button now, not a
                    bare › glyph — the collapse itself already worked
                    (toggle + TOOLS; the PDF expands into freed space
                    with the 1100px cap), but the critic asked for it
                    as if it did not exist, so it was not discoverable. */}
                <button onClick={toggleRight} className="reader-panel-toggle" aria-label="Hide study tools">› <span className="reader-toggle-label">Hide</span></button>
              </div>
              {/* FIND IN DOCUMENT — real full-text matches (backend
                  text index), this document only; click a match to
                  jump to its page. Round C: Find is the primary
                  console module — its own spec-param entrance. */}
              <AnimatedContent
                trigger="mount"
                distance={18}
                duration={0.48}
                ease="power3.out"
                initialOpacity={0}
                blur={0}
                threshold={0.12}
                once
              >
              <div className="reader-console-module">
                <span className="reader-console-label">Find in document</span>
<div className="reader-find">
                <input
                  type="search"
                  value={findQ}
                  onChange={e => setFindQ(e.target.value)}
                  placeholder="Find in document…"
                  aria-label="Find in document"
                />
                {findQ.trim() && (
                  <button type="button" className="reader-find-clear" onClick={() => setFindQ('')} aria-label="Clear find">
                    ✕
                  </button>
                )}
              </div>
              </div>
              </AnimatedContent>
              {findQ.trim().length >= 2 ? (
                <div className="reader-tab-body">
                  {findSearching ? (
                    <p className="reader-hint">Searching…</p>
                  ) : findResults.length === 0 ? (
                    <p className="reader-hint">
                      No matches for &ldquo;{findQ.trim()}&rdquo; in this document.
                    </p>
                  ) : (
                    <>
                      <div className="reader-sec-label">
                        {findResults.length} page{findResults.length === 1 ? '' : 's'} · &ldquo;{findQ.trim()}&rdquo;
                      </div>
                      {findResults.map(pg => (
                        <button key={pg.page_number} className="reader-tool-row" onClick={() => goToPage(pg.page_number)}>
                          <span className="min-w-0">
                            <span className="row-title">Page {pg.page_number} · {pg.match_count} hit{pg.match_count === 1 ? '' : 's'}</span>
                            <span className="row-meta block">{pg.snippet}</span>
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              ) : (
              /* Round C P1: the console modules enter on spec params
                 (distance 18, duration 0.48, stagger 0.06, once) —
                 Bookmark, Notes, Highlights, Contents, page context,
                 doc nav stagger in as one choreography. */
              <AnimatedContent
                trigger="mount"
                distance={18}
                duration={0.48}
                ease="power3.out"
                initialOpacity={0}
                blur={0}
                threshold={0.12}
                stagger={0.06}
                once
              >
              <div className="reader-console-module">
                <span className="reader-console-label">Bookmark</span>
                <div className="reader-tab-body">
                  <GlareHover className="de-glare-block" glareColor="#e8aa48" glareOpacity={0.3}>
<button className="reader-tool-row" onClick={addPageBookmark}
                    disabled={pageBms.some(b => b.page === visiblePage)}>
                    <span className="text-[16px]" style={{ color: '#F0B86B' }}>★</span>
                    <span className="min-w-0">
                      <span className="row-title">
                        {pageBms.some(b => b.page === visiblePage) ? `Page ${visiblePage} bookmarked` : `Bookmark page ${visiblePage}`}
                      </span>
                      <span className="row-meta block">Saved on this device · persists</span>
                    </span>
                  </button>
</GlareHover>
                  <button className="reader-tool-row" onClick={onToggleBookmark}
                    aria-pressed={bookmarked}>
                    <span className="text-[16px]" style={{ color: bookmarked ? '#F0B86B' : 'var(--muted)' }}>
                      {bookmarked ? '★' : '☆'}
                    </span>
                    <span className="min-w-0">
                      <span className="row-title">{bookmarked ? 'Document saved to bookmarks' : 'Bookmark this document'}</span>
                      <span className="row-meta block">Tap to {bookmarked ? 'remove' : 'save'}</span>
                    </span>
                  </button>
                  {pageBms.length > 0 && (
                    <>
                      <div className="reader-sec-label">Page bookmarks · {pageBms.length}</div>
                      {pageBms.map(b => (
                        <div key={b.page} className="reader-tool-row reader-tool-row--split">
                          <button className="reader-tool-row-main" onClick={() => goToPage(b.page)}>
                            <span className="min-w-0">
                              <span className="row-title">{file.title}</span>
                              <span className="row-meta block">Page {b.page} of {total}</span>
                            </span>
                          </button>
                          <button className="note-del" onClick={() => setPageBms(prev => prev.filter(x => x.page !== b.page))}>
                            Delete
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {bookmarkedDocs.length > 0 && (
                    <>
                      <div className="reader-sec-label">Saved documents · {bookmarkedDocs.length}</div>
                      {bookmarkedDocs.map(d => (
                        <button key={d.key} className="reader-tool-row" onClick={() => onOpenDoc(d.key)}>
                          <span className="min-w-0">
                            <span className="row-title">{d.title}</span>
                            <span className="row-meta block">
                              {d.pages} pages{d.key === file.key ? ' · open now' : ''}
                            </span>
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="reader-console-module">
                <span className="reader-console-label">Notes <span className="reader-console-count">· {notes.length}</span></span>
                <div className="reader-tab-body">
                  <div className="reader-note-form">
                    <textarea
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      placeholder={`Note on page ${visiblePage}…`}
                      aria-label="Write a note for the current page"
                    />
                    <GlareHover className="de-glare-block" glareColor="#59ded3" glareOpacity={0.3}>
<button
                      onClick={addNote}
                      disabled={!noteDraft.trim()}
                      className="ke-cta-primary w-full justify-center mt-2 disabled:opacity-40"
                      style={{ padding: '10px 16px', fontSize: 13 }}
                    >
                      Add note · p. {visiblePage}
                    </button>
</GlareHover>
                  </div>
                  {notes.length === 0 ? (
                    <p className="reader-hint">
                      No notes yet. Notes attach to the page you are reading and are saved on this device.
                    </p>
                  ) : (
                    [...notes].reverse().map((n, ri) => {
                      const i = notes.length - 1 - ri;
                      const isEditing = editingNote === n.ts;
                      return (
                        <div key={`${n.ts}-${i}`} className="reader-note">
                          <button className="note-page" onClick={() => goToPage(n.page)}>
                            Page {n.page} · {new Date(n.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · go to page →
                          </button>
                          {isEditing ? (
                            <>
                              <textarea
                                className="reader-note-edit"
                                value={editDraft}
                                onChange={e => setEditDraft(e.target.value)}
                                aria-label="Edit note"
                              />
                              <span className="reader-note-actions">
                                <button className="note-save" onClick={saveNoteEdit}>Save</button>
                                <button className="note-del" onClick={() => setEditingNote(null)}>Cancel</button>
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="note-text">{n.text}</div>
                              <span className="reader-note-actions">
                                <button className="note-edit" onClick={() => { setEditingNote(n.ts); setEditDraft(n.text); }}>Edit</button>
                                <button className="note-del" onClick={() => setNotes(prev => prev.filter((_, j) => j !== i))}>
                                  Delete
                                </button>
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="reader-console-module">
                <span className="reader-console-label">Highlights <span className="reader-console-count">· {highlights.length}</span></span>
                <div className="reader-tab-body">
                  <div className="reader-note-form">
                    <input
                      className="reader-hl-input"
                      value={hlDraft}
                      onChange={e => setHlDraft(e.target.value)}
                      placeholder={`Label for page ${visiblePage}…`}
                      aria-label="Highlight label"
                    />
                    {/* ROUND A 2026-11-07 (spec §P3.3): pick the
                        highlight colour — Yellow / Cyan / Pink. */}
                    <div className="reader-hl-colors" role="group" aria-label="Highlight colour">
                      {(Object.keys(HL_COLORS) as HlColor[]).map(c => (
                        <button
                          key={c}
                          type="button"
                          className={`reader-hl-swatch${hlColor === c ? ' reader-hl-swatch--on' : ''}`}
                          style={{ ['--hl-dot' as string]: HL_COLORS[c].dot }}
                          aria-pressed={hlColor === c}
                          aria-label={`${HL_COLORS[c].label} highlight`}
                          onClick={() => setHlColor(c)}
                        />
                      ))}
                    </div>
                    {/* Round A 2026-11-08 spec §5: Glare Hover on
                        the highlight interaction too (bookmark
                        already has it above). */}
                    <GlareHover className="de-glare-block" glareColor="#59ded3" glareOpacity={0.3}>
<button
                      onClick={addHighlight}
                      className="ke-cta-primary w-full justify-center mt-2"
                      style={{ padding: '10px 16px', fontSize: 13 }}
                    >
                      Highlight page {visiblePage}
                    </button>
</GlareHover>
                  </div>
                  {highlights.length === 0 ? (
                    <p className="reader-hint">
                      No highlights yet. A highlight marks a passage's page with your label — saved on this device.
                    </p>
                  ) : (
                    <>
                      <div className="reader-sec-label">Highlights · {highlights.length}</div>
                      {[...highlights].reverse().map(h => (
                        <div key={h.ts} className="reader-tool-row reader-tool-row--split">
                          <button className="reader-tool-row-main" onClick={() => goToPage(h.page)}>
                            <span className="min-w-0">
                              <span className="row-title">
                                <span className="reader-hl-dot" style={{ background: HL_COLORS[h.color ?? 'yellow'].dot }} aria-hidden="true" />
                                {h.label}
                              </span>
                              <span className="row-meta block">Page {h.page} of {total} · {new Date(h.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            </span>
                          </button>
                          <button className="note-del" onClick={() => setHighlights(prev => prev.filter(x => x.ts !== h.ts))}>
                            Delete
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="reader-console-module">
                <span className="reader-console-label">Contents</span>
                <div className="reader-tab-body">
                  {!tocLoaded ? (
                    <p className="reader-hint">Loading contents…</p>
                  ) : toc.length > 0 ? (
                    <>
                      <div className="reader-sec-label">In this document · {toc.length} headings</div>
                      {toc.map((e, i) => (
                        <button
                          key={`${e.page}-${i}`}
                          className={`reader-tool-row reader-toc-row${e.level === 2 ? ' reader-toc-row--sub' : ''}`}
                          onClick={() => goToPage(e.page)}
                        >
                          <span className="min-w-0">
                            <span className="row-title">{e.title}</span>
                            <span className="row-meta block">Page {e.page}</span>
                          </span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="reader-hint">
                      No headings extracted from this document — its pages carry no text index.
                    </p>
                  )}
                  <div className="reader-sec-label">More in {subjectLabel}</div>
                  {contents.length === 0 ? (
                    <p className="reader-hint">No sections in this subject.</p>
                  ) : (
                    contents.map(s => (
                      <div key={s.id}>
                        <div className="reader-sec-label">{s.label}</div>
                        {s.docs.map(d => (
                          <button
                            key={d.key}
                            className="reader-tool-row"
                            onClick={() => onOpenDoc(d.key)}
                            style={d.key === file.key
                              ? { borderColor: 'color-mix(in srgb, var(--subject-accent) 55%, transparent)' }
                              : undefined}
                          >
                            <span className="min-w-0">
                              <span className="row-title">{d.title}</span>
                              <span className="row-meta block">
                                {d.pages} pages{d.key === file.key ? ' · you are here' : ''}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <hr className="reader-console-divider" />
              <div className="reader-console-module">
                <span className="reader-console-label">Page context</span>
                <div className="reader-page-context">
                  <span className="reader-page-context-nums">{visiblePage} <span>/ {total}</span></span>
                  {/* ROUND A 2026-11-07 (spec §P3.3 PAGE INFORMATION):
                      current page / total pages / zoom. */}
                  <span className="reader-page-context-meta">{sectionLabel} / {subjectLabel} · <span className="reader-zoom">{zoom}% zoom</span></span>
                </div>
              </div>
              <div className="reader-console-nav">
                <button type="button" onClick={() => onPrev?.()} disabled={!onPrev}>← Previous</button>
                <span className="reader-console-nav-pos">{docIndex + 1} / {docTotal}</span>
                <button type="button" onClick={() => onNext?.()} disabled={!onNext}>Next →</button>
              </div>
              </AnimatedContent>
              )}
            </AnimatedContent>
          )}
        </aside>
      </div>

      {/* 52px bottom bar (Round C 2026-11-07 P1): primary controls only
          — PAGE x/y, zoom %, FIT PAGE, PAGES, TOOLS. Secondary
          (zoom −/+, FULLSCREEN, READING MODE) lives under the TOOLS
          state: visible only while the study console is open.
          ROUND A 2026-11-07: the bar hides in reading mode — the
          floating minimal toolbar below takes over. */}
      {!immersive && !readingMode && (
        <div className="reader-bottombar">
          <button onClick={() => goToPage(visiblePage - 1)} disabled={visiblePage <= 1}
            className="ke-reader-btn" aria-label="Previous page">‹</button>
          <span className="reader-page-label">PAGE</span>
          <input
            className="reader-goto"
            value={gotoVal}
            placeholder={String(visiblePage)}
            inputMode="numeric"
            onChange={e => setGotoVal(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const p = parseInt(gotoVal, 10);
                if (p) goToPage(p);
                setGotoVal('');
                (e.target as HTMLElement).blur();
              }
            }}
            aria-label="Go to page"
          />
          <span className="reader-page-total">/ {total}</span>
          <button onClick={() => goToPage(visiblePage + 1)} disabled={visiblePage >= total}
            className="ke-reader-btn" aria-label="Next page">›</button>
          <span className="opacity-30">|</span>
          <span className="reader-zoom-label">{zoom}%</span>
          <button onClick={fitPage} className="ke-reader-btn" aria-label="Fit page to stage">FIT PAGE</button>
          <span className="opacity-30">|</span>
          <button onClick={toggleLeft} className={`reader-panel-toggle${leftOpen && !readingMode ? ' on' : ''}`}
            aria-pressed={leftOpen && !readingMode} aria-label="Toggle pages panel">PAGES</button>
          <button onClick={toggleRight} className={`reader-panel-toggle${rightOpen && !readingMode ? ' on' : ''}`}
            aria-pressed={rightOpen && !readingMode} aria-label="Toggle study tools">TOOLS</button>
          {showRight && (
            <>
              <span className="opacity-30">|</span>
              <button onClick={() => setZoom(z => Math.max(50, z - 25))}
                className="ke-reader-btn" aria-label="Zoom out">−</button>
              <button onClick={() => setZoom(z => Math.min(200, z + 25))}
                className="ke-reader-btn" aria-label="Zoom in">+</button>
              <span className="opacity-30">|</span>
              <button onClick={goFullscreen} className="ke-reader-btn" aria-label="Fullscreen">⤢ FULLSCREEN</button>
              <span className="opacity-30">|</span>
              <button onClick={() => setReadingMode(v => !v)}
                className={`reader-mode-btn${readingMode ? ' active' : ''}`}
                aria-pressed={readingMode} aria-label="Toggle reading mode">
                {readingMode ? '● READING' : 'READING MODE'}
              </button>
            </>
          )}
        </div>
      )}
      {/* ROUND A 2026-11-07 (spec §P3.5): reading mode's floating
          minimal toolbar — hides the thumbnail rail + study console
          (panelsHidden) and the header + bottom bar above, expands
          the PDF workspace, preserves page/zoom/position. Escape
          exits reading mode (keyboard handler above). */}
      {readingMode && (
        <div className="reader-floatbar" role="toolbar" aria-label="Reading controls">
          <button onClick={() => goToPage(visiblePage - 1)} disabled={visiblePage <= 1} aria-label="Previous page">‹</button>
          <span className="reader-floatbar-page">PAGE {visiblePage} / {total} · {zoom}%</span>
          <button onClick={() => goToPage(visiblePage + 1)} disabled={visiblePage >= total} aria-label="Next page">›</button>
          <span className="reader-floatbar-sep" aria-hidden="true" />
          <button onClick={() => setZoom(z => Math.max(50, z - 25))} aria-label="Zoom out">−</button>
          <button onClick={() => setZoom(z => Math.min(200, z + 25))} aria-label="Zoom in">+</button>
          <span className="reader-floatbar-sep" aria-hidden="true" />
          <button onClick={() => setReadingMode(false)}>EXIT READING</button>
        </div>
      )}
    </div>
  );
}
