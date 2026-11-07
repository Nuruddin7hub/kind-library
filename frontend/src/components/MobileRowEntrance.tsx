// K/IND mobile engine — MobileRowEntrance (ChatGPT Round B 2026-11-07).
// THE one mobile list entrance (React Bits AnimatedContent): distance 18,
// 0.42s, power3.out, initialOpacity 0, blur 0, threshold 0.12, stagger
// 0.055, once, container '#root' (the true scroller — #kl-mobile-scroll
// never scrolls). Replaces RowStagger on the Mobile Library rows and the
// Digital/FIS index rows. NOT Hero, NOT Reader controls, NOT Search
// results. No tilt, no scale. Reduced-motion renders the rows directly
// (no entrance). Animate only newly revealed records: the wrapper fires
// once when it enters the viewport; later filter changes render settled.
// Mobile only; desktop untouched.
import type { ReactNode } from 'react';
import AnimatedContent from '../bits/AnimatedContent';

export default function MobileRowEntrance({ children, reducedMotion }: {
  children: ReactNode; reducedMotion?: boolean;
}) {
  if (reducedMotion) return <div className="ki-entrance">{children}</div>;
  return (
    <AnimatedContent
      className="ki-entrance"
      distance={18}
      duration={0.42}
      ease="power3.out"
      initialOpacity={0}
      animateOpacity
      blur={0}
      threshold={0.12}
      stagger={0.055}
      trigger="scroll"
      container="#root"
      once
    >
      {children}
    </AnimatedContent>
  );
}
