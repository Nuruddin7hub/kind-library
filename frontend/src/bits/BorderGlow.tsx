// @ts-nocheck — vendored React Bits (DavidHDev/react-bits) Border Glow, simplified for Kind Library. ChatGPT round A 2026-11-02.
// Glowing gradient border that follows the cursor and intensifies near edges.
import { useRef } from 'react';
import './BorderGlow.css';

export default function BorderGlow({
  children,
  className = '',
  style,
  glowColor = '#6B9DFF',
  intensity = 1,
  radius,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  glowColor?: string;
  intensity?: number;
  radius?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--bgx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty('--bgy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  return (
    <div
      ref={ref}
      className={`rb-border-glow ${className}`}
      style={{ ...style, ['--glow-color' as any]: glowColor, ['--glow-intensity' as any]: intensity, ...(radius ? { borderRadius: radius } : {}) }}
      onMouseMove={onMove}
    >
      {children}
    </div>
  );
}
