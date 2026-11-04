// K/IND Library — layered global desktop background (ChatGPT Round A 2026-11-04).
// Three layers, all behind content (z-index -1), desktop only:
//   1. Atmospheric — restrained Aurora, upper-center (blue/cyan/violet)
//   2. Architectural — barely-visible 64px grid + coordinate marks
//   3. Material — film grain ~0.025 + inset edge lighting
// Reduced-motion users skip the Aurora layer entirely.
import { useState } from 'react';
import Aurora from '../bits/Aurora';
import Noise from '../bits/Noise';
import './GlobalBackdrop.css';

export default function GlobalBackdrop() {
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  return (
    <div className="kiA-backdrop" aria-hidden="true">
      <div className="kiA-backdrop-glow" />
      {!reduceMotion && (
        <div className="kiA-backdrop-aurora">
          <Aurora
            colorStops={['#123D60', '#126B70', '#25254B']}
            amplitude={0.65}
            blend={0.7}
            speed={0.18}
            opacity={0.22}
            layers={2}
            mouseInteraction={false}
            intro={true}
            paused={reduceMotion}
          />
        </div>
      )}
      <div className="kiA-backdrop-grid" />
      <Noise opacity={0.025} className="kiA-backdrop-grain" />
    </div>
  );
}
