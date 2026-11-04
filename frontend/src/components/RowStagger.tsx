// K/IND mobile engine — RowStagger (ChatGPT Round B critique 2026-11-04,
// 1420 loop: "Animated List HIGH PRIORITY").
// Spec-exact entrance: 40ms stagger (35–50ms), 200ms duration (180–250ms),
// translateY(10px) → 0 (8–12px), fade — entrance only, never replays.
// Implemented directly on the React Bits AnimatedList *pattern* (stagger +
// animate-once, no new deps) so the timing matches the spec exactly:
// the vendored AnimatedList's 620ms spring engine cannot hit 180–250ms.
// Mobile only; desktop untouched.

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

const STAGGER_MS = 40;   // spec: 35–50ms
const DURATION_MS = 200; // spec: 180–250ms
const RISE_PX = 10;      // spec: 8–12px
const MAX_STAGGER = 24;  // cap the cascade so long lists don't lag

export default function RowStagger({ children }: { children: ReactNode }) {
  const list = Children.toArray(children);
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [static_, setStatic] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setStatic(true);
      return;
    }
    const el = ref.current;
    if (!el) { setEntered(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          setEntered(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (list.length === 0) return null;
  if (static_) return <>{list}</>;

  return (
    <div ref={ref} className={`ki-entrance${entered ? ' is-in' : ''}`} aria-hidden={false}>
      {list.map((child, i) => (
        <div
          key={(child as any)?.key ?? i}
          className="ki-entrance-item"
          style={{
            transitionDelay: `${Math.min(i, MAX_STAGGER) * STAGGER_MS}ms`,
            ['--ki-rise' as any]: `${RISE_PX}px`,
            ['--ki-dur' as any]: `${DURATION_MS}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
