import { useEffect, useState } from 'react';

/** SplitText — staggered word/line entrance, once per mount (vendored React Bits behavior). */
export default function SplitText({
  lines,
  className = '',
  delayBase = 0,
  wordDelay = 55,
}: {
  lines: { text: string; italic?: boolean }[];
  className?: string;
  delayBase?: number;
  wordDelay?: number;
}) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  let wi = 0;
  return (
    <span className={`split-text ${className}`}>
      {lines.map((line, li) => {
        const words = line.text.split(' ');
        return (
          <span key={li} className="st-line">
            {words.map((w, i2) => {
              const d = reduce ? 0 : delayBase + wi * wordDelay;
              wi++;
              const inner = line.italic ? <em>{w}</em> : w;
              return (
                <span key={i2} className="st-word" style={{ animationDelay: `${d}ms` }}>
                  {inner}
                  {i2 < words.length - 1 ? '\u00A0' : ''}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
