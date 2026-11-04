// @ts-nocheck — vendored from React Bits (DavidHDev/react-bits) GlareHover
// registry (TS-CSS flavor), simplified for Kind Library 2026-11-04.
// Prop names verified against the live reactbits.dev registry 2026-11-04:
//   glareColor, glareOpacity, glareAngle, glareSize, softness, variant,
//   blendMode, rimGlint, mode, transitionDuration, playOnce, className, style.
// Simplified engine: the upstream rAF sweep engine is replaced by one
// CSS-transition sweep per trigger — pointerenter in "hover" mode,
// pointerdown in "click" mode, and keyboard focus-visible. This keeps the
// glossy directional streak (the part that matters on touch-first mobile,
// where hover never fires) without the continuous animation loop.
// Static when prefers-reduced-motion. CSS (GlareHover.css) is verbatim
// from the registry.

import { useRef, useState } from 'react';
import './GlareHover.css';

type Variant = 'streak' | 'twin' | 'sheen';
type Mode = 'hover' | 'click';

/** Approximate the registry's 33-stop streak profiles with 5 stops:
 *  streak = one sharp band, twin = two bands, sheen = one wide soft band. */
function gradient(color: string, opacity: number, variant: Variant): string {
  const a = (f: number) => `${Math.round(Math.min(1, opacity * f) * 1000) / 10}%`;
  const band = `color-mix(in srgb, ${color} ${a(1)}, transparent)`;
  const soft = `color-mix(in srgb, ${color} ${a(0.28)}, transparent)`;
  if (variant === 'twin') {
    return `linear-gradient(90deg, transparent 0%, ${soft} 22%, ${band} 34%, transparent 46%, ${soft} 60%, ${band} 72%, transparent 88%)`;
  }
  if (variant === 'sheen') {
    return `linear-gradient(90deg, transparent 0%, ${soft} 28%, ${soft} 72%, transparent 100%)`;
  }
  return `linear-gradient(90deg, transparent 0%, ${soft} 32%, ${band} 50%, ${soft} 68%, transparent 100%)`;
}

interface GlareHoverProps {
  glareColor?: string;
  glareOpacity?: number;
  glareAngle?: number;
  glareSize?: number;
  softness?: number;
  variant?: Variant;
  blendMode?: string;
  rimGlint?: boolean;
  mode?: Mode;
  transitionDuration?: number;
  playOnce?: boolean;
  className?: string;
  style?: Record<string, unknown>;
  children?: React.ReactNode;
}

export default function GlareHover({
  glareColor = '#ffffff',
  glareOpacity = 0.5,
  glareAngle = -45,
  glareSize = 30,
  softness = 0.6,
  variant = 'streak',
  blendMode = 'screen',
  rimGlint = false,
  mode = 'hover',
  transitionDuration = 650,
  playOnce = false,
  className = '',
  style = {},
  children,
}: GlareHoverProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLSpanElement | null>(null);
  const rimRef = useRef<HTMLSpanElement | null>(null);
  const played = useRef(false);
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const sweep = () => {
    if (reduced) return;
    if (playOnce && played.current) return;
    played.current = true;
    const root = rootRef.current;
    const bands = [bandRef.current, rimRef.current].filter(Boolean) as HTMLSpanElement[];
    if (!root || bands.length === 0) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;
    const radians = (glareAngle * Math.PI) / 180;
    const ux = Math.sin(radians);
    const uy = -Math.cos(radians);
    const diag = Math.hypot(w, h);
    const band = Math.max(8, (diag * glareSize) / 100);
    const reach = (Math.abs(w * ux) + Math.abs(h * uy)) / 2 + band / 2 + 2;
    const rot = `translate(-50%, -50%) rotate(${glareAngle - 90}deg)`;
    for (const el of bands) {
      el.style.transition = 'none';
      el.style.width = `${band}px`;
      el.style.height = `${diag + band}px`;
      el.style.transform = `${rot} translateX(${-reach}px)`;
    }
    const glare = root.querySelector(':scope > .glare-hover__glare') as HTMLElement | null;
    if (glare) {
      glare.style.transition = 'none';
      glare.style.opacity = '1';
    }
    void root.offsetWidth; // reflow so the start position commits
    for (const el of bands) {
      el.style.transition = `transform ${transitionDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.transform = `${rot} translateX(${reach}px)`;
    }
    if (glare) {
      glare.style.transition = `opacity ${Math.round(transitionDuration * 0.55)}ms ease ${Math.round(
        transitionDuration * 0.45,
      )}ms`;
      glare.style.opacity = '0';
    }
  };

  const onFocus = (e: React.FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && typeof t.matches === 'function' && t.matches(':focus-visible')) sweep();
  };

  return (
    <div
      ref={rootRef}
      className={`glare-hover${className ? ` ${className}` : ''}`}
      style={{
        ['--gh-width' as any]: '100%',
        ['--gh-height' as any]: '100%',
        ['--gh-bg' as any]: 'transparent',
        ['--gh-border' as any]: 'transparent',
        ['--gh-br' as any]: 'inherit',
        ['--gh-blend' as any]: blendMode,
        ['--gh-glare' as any]: gradient(glareColor, glareOpacity, variant),
        ['--gh-rim' as any]: gradient(glareColor, Math.min(1, glareOpacity * 1.8), variant),
        ...style,
      }}
      onPointerEnter={mode === 'hover' ? sweep : undefined}
      onPointerDown={mode === 'click' ? sweep : undefined}
      onFocus={onFocus}
    >
      {children}
      <div className="glare-hover__glare" aria-hidden="true">
        <span ref={bandRef} className="glare-hover__band" />
      </div>
      {rimGlint && (
        <div className="glare-hover__rim" aria-hidden="true">
          <span ref={rimRef} className="glare-hover__band glare-hover__band--rim" />
        </div>
      )}
    </div>
  );
}
