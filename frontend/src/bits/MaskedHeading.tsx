// MaskedHeading — masked word-reveal display heading for the ATLAS edition.
// Words slide up from behind an overflow mask (line-mask reveal), the
// signature entrance for Cormorant Garamond headlines. Not a React Bits
// registry component (React Bits ships SplitText/BlurText instead); written
// in the same vendored-component style as src/bits/*. Disabled entirely
// for prefers-reduced-motion.
import { useState } from 'react';
import './MaskedHeading.css';

interface MaskedHeadingProps {
  /** Words to display. */
  text: string;
  /** Words (case-insensitive, punctuation-stripped) rendered in italic accent. */
  accent?: string[];
  tag?: 'h1' | 'h2' | 'h3';
  className?: string;
  /** per-word stagger, seconds */
  stagger?: number;
  /** delay before the first word, seconds */
  baseDelay?: number;
}

export default function MaskedHeading({
  text,
  accent = [],
  tag = 'h1',
  className = '',
  stagger = 0.07,
  baseDelay = 0.15,
}: MaskedHeadingProps) {
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const accentSet = new Set(accent.map((w) => w.toLowerCase().replace(/[.,!?;:]/g, '')));
  const words = text.split(/\s+/).filter(Boolean);
  const Tag = tag as 'h1';

  return (
    <Tag className={`mkh ${className}`} aria-label={text}>
      {words.map((word, i) => {
        const plain = word.toLowerCase().replace(/[.,!?;:]/g, '');
        const isAccent = accentSet.has(plain);
        const inner = isAccent ? <em>{word}</em> : word;
        if (reduceMotion) {
          return (
            <span key={i} className="mkh-word mkh-word--static">
              {inner}{' '}
            </span>
          );
        }
        return (
          <span key={i} className="mkh-word" aria-hidden="true">
            <span
              className="mkh-rise"
              style={{ animationDelay: `${baseDelay + i * stagger}s` }}
            >
              {inner}
            </span>
            {i < words.length - 1 ? '\u00A0' : ''}
          </span>
        );
      })}
    </Tag>
  );
}
