// @ts-nocheck — vendored from React Bits (DavidHDev/react-bits), ChatGPT critique round B 2026-11-02
// Carousel: touch-swipe + scroll-snap strip for "Recently Explored". No autoplay on mobile.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './Carousel.css';

interface CarouselProps {
  children: ReactNode[];
  baseWidth?: number; // max width of the strip
  gap?: number; // px between cards
  cardWidth?: number; // px width of each card
  showArrows?: boolean; // mobile: false (swipe only)
  className?: string;
  ariaLabel?: string;
}

export default function Carousel({
  children,
  baseWidth = 560,
  gap = 12,
  cardWidth = 232,
  showArrows = false,
  className = '',
  ariaLabel = 'Carousel',
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const updateIndex = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (cardWidth + gap));
    setIndex(Math.max(0, Math.min(children.length - 1, i)));
  }, [cardWidth, gap, children.length]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateIndex);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [updateIndex]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * (cardWidth + gap), behavior: 'smooth' });
  };

  return (
    <div className={`rb-carousel ${className}`} style={{ maxWidth: baseWidth }} aria-label={ariaLabel}>
      <div className="rb-carousel-track" ref={trackRef}>
        {children.map((c, i) => (
          <div key={i} className="rb-carousel-card" style={{ width: cardWidth }}>
            {c}
          </div>
        ))}
        {/* trailing spacer so the last card can snap fully into view */}
        <div className="rb-carousel-end" aria-hidden="true" />
      </div>
      {showArrows && (
        <div className="rb-carousel-arrows">
          <button onClick={() => goTo(index - 1)} disabled={index <= 0} aria-label="Previous">‹</button>
          <button onClick={() => goTo(index + 1)} disabled={index >= children.length - 1} aria-label="Next">›</button>
        </div>
      )}
      <div className="rb-carousel-dots" aria-hidden="true">
        {children.map((_, i) => (
          <span key={i} className={i === index ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
