import { useEffect, useRef } from 'react';

interface Props {
  points: { x: number; y: number }[];
  visible: boolean;
}

/** ConstellationLines — SVG Bézier path connecting search matches */
export default function ConstellationLines({ points, visible }: Props) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || points.length < 2) return;

    // build smooth path through points
    let d = `M ${points[0].x * 100} ${points[0].y * 100}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const mx = (p0.x + p1.x) / 2;
      d += ` C ${mx * 100} ${p0.y * 100}, ${mx * 100} ${p1.y * 100}, ${p1.x * 100} ${p1.y * 100}`;
    }
    path.setAttribute('d', d);

    // animate draw
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.getBoundingClientRect(); // force reflow
    path.style.transition = 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)';
    path.style.strokeDashoffset = '0';
  }, [points]);

  if (!visible || points.length < 2) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path
        ref={pathRef}
        fill="none"
        stroke="#58E6D2"
        strokeWidth="0.15"
        opacity="0.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
