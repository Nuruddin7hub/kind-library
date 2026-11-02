// @ts-nocheck — vendored React Bits (DavidHDev/react-bits) Tilted Card, simplified for Kind Library. ChatGPT round A 2026-11-02.
import { useRef } from 'react';
import './TiltedCard.css';

export default function TiltedCard({
  children,
  className = '',
  style,
  tiltMaxAngleX = 3,
  tiltMaxAngleY = 3,
  scaleOnHover = 1.04,
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  tiltMaxAngleX?: number;
  tiltMaxAngleY?: number;
  scaleOnHover?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform =
      `perspective(900px) rotateX(${(-py * tiltMaxAngleY).toFixed(2)}deg) ` +
      `rotateY(${(px * tiltMaxAngleX).toFixed(2)}deg) scale3d(${scaleOnHover},${scaleOnHover},1)`;
    el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = '';
  };

  return (
    <div
      ref={ref}
      className={`rb-tilt ${className}`}
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
      {glare && <div className="rb-tilt__glare" aria-hidden="true" />}
    </div>
  );
}
