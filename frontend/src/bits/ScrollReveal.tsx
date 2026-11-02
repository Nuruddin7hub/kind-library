// @ts-nocheck — vendored from React Bits (DavidHDev/react-bits), ChatGPT critique round B 2026-11-02
// ScrollReveal: word-by-word opacity reveal on scroll. Mobile-safe, plays once.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import './ScrollReveal.css';

interface ScrollRevealProps {
  children: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  containerClassName?: string;
  textClassName?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
}

export default function ScrollReveal({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.15,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom 65%',
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const words = children.split(/(\s+)/);

  return (
    <h2 ref={containerRef} className={`rb-scroll-reveal ${containerClassName}`}>
      <p className={`rb-scroll-reveal-text ${textClassName}`}>
        {words.map((word, i) => (
          <span
            className={`rb-scroll-reveal-word ${visible ? 'is-visible' : ''}`}
            key={i}
            style={{
              transitionDelay: `${Math.min(i * 28, 600)}ms`,
              ['--sr-base-opacity' as any]: baseOpacity,
              ['--sr-blur' as any]: enableBlur ? `blur(${blurStrength}px)` : 'none',
              ['--sr-rotate' as any]: `rotate(${baseRotation}deg)`,
            }}
          >
            {/^\s+$/.test(word) ? '\u00A0' : word}
          </span>
        ))}
      </p>
    </h2>
  );
}
