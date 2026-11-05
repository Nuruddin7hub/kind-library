// K/IND Library — ATLAS edition global background (2026-11-05).
// A surveyor's graticule over obsidian: fine 96px map grid, bolder
// meridian lines on a 480px tile, coordinate ticks in the corners, a soft
// signal-tinted glow at the top, and very-low-opacity film grain.
// Fixed, z-index -1, behind content. Desktop only — App.tsx never mounts
// this on the mobile branch. Reduced-motion skips the (already static)
// glow breathing.
import { useState } from 'react';
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
      <div className="kiA-backdrop-glow" data-anim={!reduceMotion} />
      <div className="kiA-backdrop-graticule" />
      <div className="kiA-backdrop-meridian" />
      <div className="kiA-backdrop-ticks" />
      <Noise opacity={0.022} className="kiA-backdrop-grain" />
    </div>
  );
}
