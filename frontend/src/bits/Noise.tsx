// @ts-nocheck — vendored React Bits (DavidHDev/react-bits) Noise, simplified for Kind Library. ChatGPT round A 2026-11-02.
// Subtle film-grain overlay (fine 35mm grain) over the void background.
import './Noise.css';

export default function Noise({
  opacity = 0.05,
  className = '',
}: {
  opacity?: number;
  className?: string;
}) {
  return (
    <div
      className={`rb-noise ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
