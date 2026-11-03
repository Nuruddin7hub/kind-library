// K/IND mobile engine — RowStagger (ChatGPT Round B P0, 2026-11-03).
// Document rows wrapped in the vendored React Bits <AnimatedList>:
// subtle staggered row entrance, animate-once (no repeat on scroll-back).
// The .ki-anim CSS in ki-mobile.css neutralizes the demo-tile chrome
// (frame, ring, gradients) so it behaves as a flat row container in the
// page-window scroll. No hover-dependent behaviour: selectOnHover off,
// arrow-key navigation off. Mobile only; desktop untouched.

import { Children, type ReactNode } from 'react';
import AnimatedList from '../bits/AnimatedList';

export default function RowStagger({ children }: { children: ReactNode }) {
  const list = Children.toArray(children);
  if (list.length === 0) return null;
  return (
    <AnimatedList
      className="ki-anim"
      items={list.map((_, i) => ({ id: `row-${i}`, title: '' }))}
      renderItem={(_, i) => list[i]}
      animation="fade"
      animateOnce
      stagger={0.035}
      showGradients={false}
      frame={false}
      displayScrollbar={false}
      maxHeight="none"
      width="100%"
      radius={0}
      gap={0}
      selectOnHover={false}
      enableArrowNavigation={false}
    />
  );
}
