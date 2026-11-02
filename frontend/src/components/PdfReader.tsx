import { useEffect, useRef, useState, useCallback } from 'react';
import { consumeReaderStartPage } from '../readerStart';

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

/** PdfReader — desktop study workspace (ChatGPT Round C, 2026-11-02).
 *  Grid: 54px compact document header / workspace (84px page rail · document ·
 *  280px contextual study rail) / 52px bottom bar. Document canvas is the
 *  dominant surface; page width derives from the available viewport.
 *  Pages are server-rendered PDF page images — real PDF content (decision: no PDF.js). */
export default function PdfReader({
  file, sectionLabel, onClose, bookmarked, onToggleBookmark,
  onPrev, onNext, docIndex, docTotal, contents, bookmarkedDocs, onOpenDoc,
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
    try { return localStorage.getItem('kl:tools') !== '0'; } catch { return true; }
  });
  // Round C: study rail is CONTEXTUAL — null = compact tool launcher,
  // selecting a tool opens its panel.
  const [tab, setTab] = useState<'bookmarks' | 'notes' | 'contents' | null>(null);
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(file.key));
  const [noteDraft, setNoteDraft] = useState('');
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
    restored.current = false;
    alignCancelled.current = false;
  }, [file.key]);

  // persist notes per document
  useEffect(() => {
    try { localStorage.setItem(notesKey(file.key), JSON.stringify(notes)); } catch { /* ignore */ }
  }, [file.key, notes]);

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
      if (Math.abs(r.top - sr.top) > 30) {
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
  const [stageW, setStageW] = useState(() =>
    typeof window !== 'undefined' ? Math.max(900, window.innerWidth - 420) : 980);
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
  const pageW = Math.max(320, Math.min(960, stageW - 72)) * (zoom / 100);

  const goFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const addNote = useCallback(() => {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes(prev => [...prev, { page: visiblePage, text, ts: Date.now() }]);
    setNoteDraft('');
  }, [noteDraft, visiblePage]);

  // subject accent — exact Round A afternoon tokens
  const subjectAccent = {
    em2: '#568BFF', signals: '#B18AFF', fis: '#F0B86B', digital: '#36D8C1',
  }[file.subj] || '#36D8C1';
  const subjectLabel = SUBJECT_LABELS[file.subj] || file.subj;
  const panelsHidden = readingMode;
  const showLeft = leftOpen && !panelsHidden;
  const showRight = rightOpen && !panelsHidden;

  return (
    <div className={`reader-shell${readingMode ? ' reading' : ''}`}
      style={{ ['--subject-accent' as any]: subjectAccent }}>
      {/* compact document header — title + meta + actions (~54px, Round C) */}
      {!immersive && (
        <div className="ke-reader-header">
          <div className="ke-reader-header-group">
            <button onClick={onClose} className="ke-reader-btn" aria-label="Back to library">←</button>
            <button onClick={() => onPrev?.()} disabled={!onPrev} className="ke-reader-btn" aria-label="Previous document">‹</button>
            <button onClick={() => onNext?.()} disabled={!onNext} className="ke-reader-btn" aria-label="Next document">›</button>
          </div>
          <div className="ke-reader-header-title">
            <div className="ke-reader-title-text">{file.title}</div>
            <div className="ke-reader-submeta">
              {subjectLabel} · {sectionLabel} · DOC {docIndex + 1}/{docTotal} · PAGE {visiblePage}/{total} · {total ? Math.round((visiblePage / total) * 100) : 0}%
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
      {!immersive && (
        <div className="ke-reader-progress" aria-hidden="true">
          <div style={{ width: `${total ? (visiblePage / total) * 100 : 0}%` }} />
        </div>
      )}

      {/* workspace: pages panel · document · study tools */}
      <div className={`reader-workspace${showLeft ? '' : ' no-left'}${showRight ? '' : ' no-right'}`}>
        <aside className="reader-panel reader-panel-left" aria-label="Page thumbnails">
          {showLeft && (
            <>
              <div className="reader-panel-head">
                <span className="eyebrow">Pages</span>
                <button onClick={toggleLeft} className="reader-panel-toggle" aria-label="Hide pages panel">‹</button>
              </div>
              <div className="reader-thumb-grid">
                {Array.from({ length: total }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => goToPage(p)}
                    className={`reader-thumb${p === visiblePage ? ' active' : ''}`}
                    aria-label={`Go to page ${p}`} aria-current={p === visiblePage ? 'page' : undefined}>
                    <img src={pageImageUrl(file.subj, file.file, p, total)} alt={`Page ${p}`}
                      loading="lazy" draggable={false} />
                    <div className="reader-thumb-num">{p}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <div ref={scrollRef} className="reader-document"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            setImmersive(v => !v);
          }}>
          <div className="flex flex-col items-center gap-8">
            {Array.from({ length: total }, (_, i) => i + 1).map(p => (
              <div key={p} id={`kl-page-${p}`} className="reader-doc-page">
                <img
                  src={pageImageUrl(file.subj, file.file, p, total)}
                  alt={`Page ${p}`}
                  loading={p <= 3 ? 'eager' : 'lazy'}
                  className="ke-reader-page"
                  style={{ width: `${pageW}px`, maxWidth: '100%' }}
                  draggable={false}
                />
                <div className="reader-doc-num">{p}</div>
              </div>
            ))}
            <div className="h-8" />
          </div>
        </div>

        <aside className="reader-panel reader-panel-right" aria-label="Study tools">
          {showRight && (
            <>
              <div className="reader-panel-head">
                <span className="eyebrow">Study tools</span>
                <button onClick={toggleRight} className="reader-panel-toggle" aria-label="Hide study tools">›</button>
              </div>
              <div className="reader-tabs" role="tablist" aria-label="Study tools">
                {(['tools', 'bookmarks', 'notes', 'contents'] as const).map(t => {
                  const active = (tab ?? 'tools') === t;
                  return (
                    <button key={t} role="tab" aria-selected={active}
                      className={active ? 'active' : ''}
                      onClick={() => setTab(t === 'tools' ? null : t)}>
                      {t}
                    </button>
                  );
                })}
              </div>

              {tab === null && (
                <div className="reader-launcher">
                  <button className="reader-launch-btn" onClick={() => setTab('bookmarks')}>
                    <span className="reader-launch-ico" style={{ color: '#F0B86B' }}>★</span>
                    <span className="min-w-0">
                      <span className="row-title">Bookmarks</span>
                      <span className="row-meta block">{bookmarkedDocs.length} saved document{bookmarkedDocs.length === 1 ? '' : 's'}</span>
                    </span>
                    <span className="reader-launch-chev">›</span>
                  </button>
                  <button className="reader-launch-btn" onClick={() => setTab('notes')}>
                    <span className="reader-launch-ico" style={{ color: 'var(--digital)' }}>✎</span>
                    <span className="min-w-0">
                      <span className="row-title">Notes</span>
                      <span className="row-meta block">{notes.length} note{notes.length === 1 ? '' : 's'} on this document</span>
                    </span>
                    <span className="reader-launch-chev">›</span>
                  </button>
                  <button className="reader-launch-btn" onClick={() => setTab('contents')}>
                    <span className="reader-launch-ico" style={{ color: 'var(--em2)' }}>▤</span>
                    <span className="min-w-0">
                      <span className="row-title">Contents</span>
                      <span className="row-meta block">
                        {contents.reduce((s, sec) => s + sec.docs.length, 0)} documents in {subjectLabel}
                      </span>
                    </span>
                    <span className="reader-launch-chev">›</span>
                  </button>
                </div>
              )}

              {tab === 'bookmarks' && (
                <div className="reader-tab-body">
                  <button className="reader-tool-row" onClick={onToggleBookmark}
                    aria-pressed={bookmarked}>
                    <span className="text-[16px]" style={{ color: bookmarked ? '#F0B86B' : 'var(--muted)' }}>
                      {bookmarked ? '★' : '☆'}
                    </span>
                    <span className="min-w-0">
                      <span className="row-title">{bookmarked ? 'Saved to bookmarks' : 'Bookmark this document'}</span>
                      <span className="row-meta block">Tap to {bookmarked ? 'remove' : 'save'}</span>
                    </span>
                  </button>
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
              )}

              {tab === 'notes' && (
                <div className="reader-tab-body">
                  <div className="reader-note-form">
                    <textarea
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      placeholder={`Note on page ${visiblePage}…`}
                      aria-label="Write a note for the current page"
                    />
                    <button
                      onClick={addNote}
                      disabled={!noteDraft.trim()}
                      className="ke-cta-primary w-full justify-center mt-2 disabled:opacity-40"
                      style={{ padding: '10px 16px', fontSize: 13 }}
                    >
                      Add note · p. {visiblePage}
                    </button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="reader-hint">
                      No notes yet. Notes attach to the page you are reading and are saved on this device.
                    </p>
                  ) : (
                    [...notes].reverse().map((n, ri) => {
                      const i = notes.length - 1 - ri;
                      return (
                        <div key={`${n.ts}-${i}`} className="reader-note">
                          <div className="note-page">
                            Page {n.page} · {new Date(n.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                          <div className="note-text">{n.text}</div>
                          <button className="note-del" onClick={() => setNotes(prev => prev.filter((_, j) => j !== i))}>
                            Delete
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {tab === 'contents' && (
                <div className="reader-tab-body">
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
              )}
            </>
          )}
        </aside>
      </div>

      {/* 52px bottom bar: page · zoom · panels · reading mode (Round C) */}
      {!immersive && (
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
          <button onClick={() => setZoom(z => Math.max(50, z - 25))}
            className="ke-reader-btn" aria-label="Zoom out">−</button>
          <span className="reader-zoom-label">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 25))}
            className="ke-reader-btn" aria-label="Zoom in">+</button>
          <span className="opacity-30">|</span>
          <button onClick={toggleLeft} className={`reader-panel-toggle${leftOpen && !readingMode ? ' on' : ''}`}
            aria-pressed={leftOpen && !readingMode} aria-label="Toggle pages panel">PAGES</button>
          <button onClick={toggleRight} className={`reader-panel-toggle${rightOpen && !readingMode ? ' on' : ''}`}
            aria-pressed={rightOpen && !readingMode} aria-label="Toggle study tools">TOOLS</button>
          <span className="opacity-30">|</span>
          <button onClick={() => setReadingMode(v => !v)}
            className={`reader-mode-btn${readingMode ? ' active' : ''}`}
            aria-pressed={readingMode} aria-label="Toggle reading mode">
            {readingMode ? '● READING' : 'READING MODE'}
          </button>
        </div>
      )}
    </div>
  );
}
