import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  label: string;
  delay?: number;
}

/** CountUp — animated counter. Shows — while loading, never a misleading 0. */
export default function CountUp({ value, label, delay = 0 }: Props) {
  const [display, setDisplay] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (value === 0) {
      setDisplay(null);
      started.current = false;
      return;
    }
    const el = ref.current;
    if (!el || started.current) return;

    // If data already loaded and user prefers reduced motion, show immediately
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      started.current = true;
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now() + delay;
        const duration = 700;
        const tick = (now: number) => {
          const t = Math.max(0, Math.min(1, (now - start) / duration));
          const eased = 1 - Math.pow(1 - t, 4);
          setDisplay(Math.round(eased * value));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, delay]);

  return (
    <div ref={ref} className="flex flex-col gap-1 md:gap-2">
      <span className="font-display text-[26px] md:text-5xl font-medium text-[#f2f2f0]">
        {display === null ? '—' : display.toLocaleString()}
      </span>
      <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-[0.14em] md:tracking-[0.18em] text-white/40">
        {label}
      </span>
    </div>
  );
}
