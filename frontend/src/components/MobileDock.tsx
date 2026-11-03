import { useLayoutEffect, useRef, type ReactNode } from 'react';
import './MobileDock.css';

export interface DockTab {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface MobileDockProps {
  tabs: DockTab[];
  active: string;
  onSelect: (id: string) => void;
}

/** Width of the turquoise active indicator (px). */
const INDICATOR_WIDTH = 24;

/** 4-destination mobile navigation dock — ChatGPT Round B shared component (2026-11-03).
 *  Replaces the inline ap-dock in App.tsx.
 *  Sliding-indicator animation is a compact adaptation of bits/PillNav: instead of
 *  PillNav's spring-physics rAF engine, the indicator's left offset is measured
 *  from the active tab (offsetLeft/offsetWidth, like PillNav's slot rects) and the
 *  glide is a single CSS transform transition on the same ease-out curve
 *  (cubic-bezier(0.22, 1, 0.36, 1)). */
export default function MobileDock({ tabs, active, onSelect }: MobileDockProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Position the indicator under the active tab; re-measure on tab change,
  // tab-list change, and resize. Runs pre-paint so there is no flash.
  useLayoutEffect(() => {
    const move = () => {
      const i = Math.max(0, tabs.findIndex(t => t.id === active));
      const btn = tabRefs.current[i];
      const ind = indicatorRef.current;
      if (btn && ind) {
        const x = btn.offsetLeft + btn.offsetWidth / 2 - INDICATOR_WIDTH / 2;
        ind.style.transform = `translateX(${x}px)`;
      }
    };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [active, tabs]);

  return (
    <nav className="md-dock" aria-label="Primary">
      {tabs.map((t, i) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            ref={el => {
              tabRefs.current[i] = el;
            }}
            className={`md-tab${isActive ? ' md-tab--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(t.id)}
          >
            <span className="md-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="md-label">{t.label}</span>
          </button>
        );
      })}
      <span className="md-indicator" ref={indicatorRef} aria-hidden="true" />
    </nav>
  );
}
