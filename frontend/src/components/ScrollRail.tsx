// K/IND mobile engine — ScrollRail (ChatGPT Round B 2026-11-07 P3).
// Subtle scroll-position indicator for the Library + subject-index
// screens: a fixed 2px × 96px line at the right edge with a 22px thumb
// that tracks #root's scroll fraction. position:fixed + pointer-events
// none + the 16–18px side gutter: it can never push, cover, or reflow
// rows, chips, or the bottom nav. It hides itself (opacity 0) when the
// page doesn't scroll. The thumb moves via a direct transform set on the
// scroll event (rAF-throttled) — no animation, no layout work.
// Mobile only; desktop untouched.
import { useEffect, useRef, useState } from 'react';

const TRACK_H = 96;
const THUMB_H = 22;

export default function ScrollRail() {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const scroller = (document.getElementById('root') ??
      document.scrollingElement) as HTMLElement | null;
    const content = document.getElementById('kl-mobile-scroll');
    if (!scroller) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = scroller.scrollHeight - scroller.clientHeight;
        const can = max > 40;
        setScrollable(can);
        if (thumbRef.current) {
          const frac = can ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0;
          thumbRef.current.style.transform = `translateY(${frac * (TRACK_H - THUMB_H)}px)`;
        }
      });
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    let ro: ResizeObserver | null = null;
    if (content && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(content);
    }
    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="ki-scrollrail" aria-hidden="true" style={{ opacity: scrollable ? 1 : 0 }}>
      <div className="ki-scrollrail-track">
        <div className="ki-scrollrail-thumb" ref={thumbRef} />
      </div>
    </div>
  );
}
