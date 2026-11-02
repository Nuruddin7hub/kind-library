/** KnowledgeField — the signature "knowledge field" hero graphic.
 *  Fine orbital lines, tiny points, four subject-colored nodes, subtle pulses.
 *  CSS/SVG only (per critique: do NOT bring back a dense glowing starfield).
 */
const NODES = [
  { cx: 62, cy: 38, r: 2.6, color: '#8aa9ff', id: 'em2', label: 'EM2 · Mathematics' },
  { cx: 78, cy: 62, r: 2.0, color: '#c3a0ff', id: 'signals', label: 'Signals & Systems' },
  { cx: 55, cy: 72, r: 1.7, color: '#ffbf78', id: 'fis', label: 'FIS · Philosophy' },
  { cx: 88, cy: 30, r: 1.5, color: '#62e0cf', id: 'digital', label: 'Digital Electronics' },
];

/** MobileConstellation — compact subject-constellation signature for the mobile
 *  hero: four luminous subject points on fine orbital paths, reserved top-right
 *  area, never overlapping text or controls. Static (slow drift only).
 */
export function MobileConstellation() {
  const pts = [
    { x: 70, y: 26, c: '#8aa9ff' },
    { x: 88, y: 44, c: '#c3a0ff' },
    { x: 62, y: 58, c: '#ffbf78' },
    { x: 84, y: 70, c: '#62e0cf' },
  ];
  return (
    <svg viewBox="0 40 100 60" className="absolute top-0 right-0 w-[46%] h-[190px] pointer-events-none" aria-hidden="true">
      <ellipse cx="75" cy="48" rx="30" ry="17" fill="none" stroke="rgba(190,210,240,0.14)" strokeWidth="0.5" />
      <ellipse cx="75" cy="48" rx="22" ry="12" fill="none" stroke="rgba(190,210,240,0.10)" strokeWidth="0.5" transform="rotate(30 75 48)" />
      <line x1="70" y1="26" x2="88" y2="44" stroke="rgba(190,210,240,0.16)" strokeWidth="0.4" />
      <line x1="88" y1="44" x2="62" y2="58" stroke="rgba(190,210,240,0.16)" strokeWidth="0.4" />
      <line x1="62" y1="58" x2="84" y2="70" stroke="rgba(190,210,240,0.16)" strokeWidth="0.4" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4.2" fill={p.c} opacity="0.14" />
          <circle cx={p.x} cy={p.y} r="1.8" fill={p.c} opacity="0.95" />
        </g>
      ))}
    </svg>
  );
}

/** ChatGPT round C (2026-11-01): the four subject nodes are functional —
 *  hover/focus reveals the subject name, selecting opens that subject's library. */
export default function KnowledgeField({ onSelectSubject }: {
  onSelectSubject?: (id: string) => void;
}) {
  return (
    <div className="ke-hero-field" aria-hidden={!onSelectSubject}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice">
        <g className="ke-drift" opacity="0.5">
          <ellipse cx="72" cy="52" rx="34" ry="20" fill="none" stroke="rgba(190,210,240,0.16)" strokeWidth="0.25" />
          <ellipse cx="72" cy="52" rx="26" ry="14" fill="none" stroke="rgba(190,210,240,0.12)" strokeWidth="0.25" transform="rotate(35 72 52)" />
          <ellipse cx="72" cy="52" rx="17" ry="9"  fill="none" stroke="rgba(190,210,240,0.10)" strokeWidth="0.25" transform="rotate(-30 72 52)" />
        </g>
        <g opacity="0.55">
          {Array.from({ length: 26 }, (_, i) => {
            const x = (i * 37.7) % 100;
            const y = (i * 53.3 + 12) % 60;
            return <circle key={i} cx={x} cy={y} r={0.22} fill="rgba(220,230,250,0.7)" />;
          })}
        </g>
        {NODES.map((n, i) => (
          <g
            key={i}
            className="ke-node"
            role={onSelectSubject ? 'button' : undefined}
            tabIndex={onSelectSubject ? 0 : undefined}
            aria-label={onSelectSubject ? `Open ${n.label} library` : undefined}
            onClick={onSelectSubject ? () => onSelectSubject(n.id) : undefined}
            onKeyDown={onSelectSubject ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSubject(n.id); } } : undefined}
          >
            <title>{n.label}</title>
            <circle cx={n.cx} cy={n.cy} r={n.r * 2.4} fill="transparent" />
            <circle cx={n.cx} cy={n.cy} r={n.r * 1.5} fill={n.color} opacity="0.12" className={i % 2 ? 'ke-pulse-2' : 'ke-pulse'} />
            <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.color} className={i % 2 ? 'ke-pulse-2' : 'ke-pulse'} />
            <text x={n.cx} y={n.cy - n.r - 2.4} textAnchor="middle" className="ke-node-label" fill={n.color}>
              {n.label}
            </text>
          </g>
        ))}
        <g stroke="rgba(190,210,240,0.18)" strokeWidth="0.2">
          <line x1="62" y1="38" x2="78" y2="62" />
          <line x1="78" y1="62" x2="55" y2="72" />
          <line x1="62" y1="38" x2="88" y2="30" />
        </g>
      </svg>
    </div>
  );
}
