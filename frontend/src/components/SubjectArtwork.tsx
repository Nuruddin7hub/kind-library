/** SubjectArtwork + DocCover — Knowledge Engine, ChatGPT critique 2026-11-01.
 *  Custom SVG identity per subject (abstract motifs only — never fake content).
 *  artwork: 'math' | 'wave' | 'orbit' | 'grid'
 *  ChatGPT round A (2026-11-02): `animated` adds slow drift/rotate CSS
 *  animation for overview subject-card artwork (15–40s, respects
 *  prefers-reduced-motion via global CSS).
 */
export function SubjectArtwork({ type, animated = false }: { type: string; animated?: boolean }) {
  const cls = animated ? 'sa-animated' : undefined;
  if (type === 'math') {
    return (
      <svg viewBox="0 0 200 130" aria-hidden="true" className={cls}>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v-${i}`} x1={20 + i * 20} y1="8" x2={20 + i * 20} y2="122" opacity="0.28" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h-${i}`} x1="12" y1={15 + i * 20} x2="188" y2={15 + i * 20} opacity="0.28" />
        ))}
        <path d="M12 65 H188 M100 8 V122" opacity="0.6" />
        <g className={animated ? 'sa-drift' : undefined}>
          <path d="M12 103 C42 103 45 25 100 25 S155 103 188 103" className="subject-art-line" />
        </g>
      </svg>
    );
  }
  if (type === 'wave') {
    return (
      <svg viewBox="0 0 200 130" aria-hidden="true" className={cls}>
        <path d="M0 65 H200" opacity="0.3" />
        <g className={animated ? 'sa-drift' : undefined}>
          <path
            d="M0 65 C16 15 34 15 50 65 S84 115 100 65 S134 15 150 65 S184 115 200 65"
            className="subject-art-line"
          />
        </g>
        <path
          d="M0 65 C25 45 25 45 50 65 S75 85 100 65 S125 45 150 65 S175 85 200 65"
          className="subject-art-secondary"
        />
      </svg>
    );
  }
  if (type === 'orbit') {
    return (
      <svg viewBox="0 0 200 130" aria-hidden="true" className={cls}>
        <g className={animated ? 'sa-spin' : undefined}>
          <ellipse cx="100" cy="65" rx="72" ry="28" />
          <ellipse cx="100" cy="65" rx="72" ry="28" transform="rotate(55 100 65)" />
          <ellipse cx="100" cy="65" rx="72" ry="28" transform="rotate(-55 100 65)" />
        </g>
        <circle cx="100" cy="65" r="5" className="subject-art-dot" />
      </svg>
    );
  }
  // grid — digital electronics
  return (
    <svg viewBox="0 0 200 130" aria-hidden="true" className={cls}>
      <g className={animated ? 'sa-pulse' : undefined}>
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 7 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={24 + col * 24}
              y={10 + row * 24}
              width="12"
              height="12"
              rx="2"
              opacity={((row + col) % 3 === 0) ? 1 : 0.45}
            />
          ))
        )}
      </g>
    </svg>
  );
}

const MOTIF: Record<string, string> = {
  em2: 'math',
  signals: 'wave',
  fis: 'orbit',
  digital: 'grid',
};

/** Stable per-document variant (0–3) so covers differ within a subject. */
export function coverVariant(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 4;
}

/** Miniature document cover: abstract per-subject motif + serif initial.
 *  ChatGPT round C (2026-11-01): each document gets its own visual variation
 *  so scanning a grid is fast — abstract motifs only, never fake content. */
export function DocCover({ subj, title, color, docKey }: {
  subj: string; title: string; color: string; docKey?: string;
}) {
  const glyph = (title.trim()[0] || '?').toUpperCase();
  const v = coverVariant(docKey || title);
  return (
    <div className={`ke-cover ke-glare ke-cover-v${v}`} style={{ ['--subject-accent' as any]: color }}>
      <svg className="ke-cover-motif" viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {subj === 'em2' && v === 0 && (
          <>
            {Array.from({ length: 6 }, (_, i) => (
              <line key={i} x1={i * 20} y1="0" x2={i * 20} y2="130" opacity="0.5" />
            ))}
            <path d="M0 90 C25 90 30 40 55 40 S85 95 100 95" strokeWidth="2.5" />
          </>
        )}
        {subj === 'em2' && v === 1 && (
          <>
            <path d="M8 65 H92 M50 8 V122" opacity="0.6" />
            <path d="M12 110 Q50 100 62 30 T92 12" strokeWidth="2.5" />
            <circle cx="50" cy="65" r="3" fill="currentColor" stroke="none" style={{ color }} />
          </>
        )}
        {subj === 'em2' && v === 2 && (
          <>
            {Array.from({ length: 6 }, (_, i) => (
              <line key={i} x1={i * 20} y1="0" x2={i * 20} y2="130" opacity="0.35" />
            ))}
            <circle cx="50" cy="62" r="30" strokeWidth="2.2" fill="none" />
            <path d="M50 62 L78 40" strokeWidth="2" opacity="0.7" />
          </>
        )}
        {subj === 'em2' && v === 3 && (
          <>
            <path d="M8 100 L50 100 L50 12" opacity="0.5" />
            <path d="M8 100 C30 100 34 60 50 58 S70 70 92 66" strokeWidth="2.5" />
            <circle cx="50" cy="58" r="2.6" fill="currentColor" stroke="none" style={{ color }} />
          </>
        )}
        {subj === 'signals' && v === 0 && (
          <>
            <path d="M0 65 H100" opacity="0.4" />
            <path d="M0 65 C12 25 24 25 36 65 S60 105 72 65 S90 25 100 65" strokeWidth="2.5" />
          </>
        )}
        {subj === 'signals' && v === 1 && (
          <>
            <path d="M0 65 H100" opacity="0.4" />
            <path d="M0 40 H25 V90 H50 V40 H75 V90 H100" strokeWidth="2.4" />
          </>
        )}
        {subj === 'signals' && v === 2 && (
          <>
            {Array.from({ length: 5 }, (_, i) => (
              <line key={i} x1={8 + i * 20} y1="95" x2={8 + i * 20} y2="40" opacity="0.7" strokeWidth="2" />
            ))}
            <path d="M8 95 H92" opacity="0.5" />
          </>
        )}
        {subj === 'signals' && v === 3 && (
          <>
            <path d="M0 65 C20 65 24 20 44 20 S66 110 86 110" strokeWidth="2.5" />
            <path d="M86 110 C90 110 94 100 100 98" strokeWidth="2.2" opacity="0.7" />
            <circle cx="44" cy="20" r="2.6" fill="currentColor" stroke="none" style={{ color }} />
          </>
        )}
        {subj === 'fis' && v === 0 && (
          <>
            <ellipse cx="50" cy="65" rx="38" ry="16" />
            <ellipse cx="50" cy="65" rx="38" ry="16" transform="rotate(60 50 65)" />
            <circle cx="50" cy="65" r="4" fill="currentColor" stroke="none" style={{ color }} />
          </>
        )}
        {subj === 'fis' && v === 1 && (
          <>
            <circle cx="38" cy="58" r="24" fill="none" strokeWidth="2" />
            <circle cx="62" cy="72" r="24" fill="none" strokeWidth="2" opacity="0.7" />
            <circle cx="50" cy="65" r="3.4" fill="currentColor" stroke="none" style={{ color }} />
          </>
        )}
        {subj === 'fis' && v === 2 && (
          <>
            {Array.from({ length: 5 }, (_, i) => (
              <line key={i} x1={i * 22} y1="0" x2={i * 22 + 14} y2="130" opacity="0.55" />
            ))}
            <line x1="0" y1="30" x2="100" y2="88" strokeWidth="2" />
            <circle cx="66" cy="70" r="3" fill="currentColor" stroke="none" style={{ color }} />
          </>
        )}
        {subj === 'fis' && v === 3 && (
          <>
            <rect x="18" y="18" width="64" height="8" opacity="0.6" />
            <rect x="18" y="32" width="40" height="5" opacity="0.35" />
            <rect x="18" y="76" width="20" height="36" opacity="0.8" />
            <rect x="42" y="58" width="20" height="54" opacity="0.55" />
            <rect x="66" y="88" width="16" height="24" opacity="0.75" />
          </>
        )}
        {subj === 'digital' && v === 0 && (
          <>
            {Array.from({ length: 4 }, (_, r) =>
              Array.from({ length: 5 }, (_, c) => (
                <rect key={`${r}-${c}`} x={10 + c * 18} y={16 + r * 28} width="9" height="9" rx="1.5" opacity="0.7" />
              ))
            )}
          </>
        )}
        {subj === 'digital' && v === 1 && (
          <>
            <path d="M12 40 H42 V90 H92" strokeWidth="2.4" />
            <path d="M12 90 H42" strokeWidth="2" opacity="0.6" />
            <circle cx="12" cy="40" r="3" fill="currentColor" stroke="none" style={{ color }} />
            <circle cx="92" cy="90" r="3" fill="currentColor" stroke="none" style={{ color }} />
          </>
        )}
        {subj === 'digital' && v === 2 && (
          <>
            <rect x="30" y="48" width="40" height="34" rx="4" fill="none" strokeWidth="2.2" />
            <line x1="30" y1="58" x2="12" y2="58" strokeWidth="2" />
            <line x1="30" y1="72" x2="12" y2="72" strokeWidth="2" />
            <line x1="70" y1="65" x2="88" y2="65" strokeWidth="2" />
          </>
        )}
        {subj === 'digital' && v === 3 && (
          <>
            <rect x="14" y="20" width="30" height="30" rx="3" opacity="0.85" />
            <rect x="56" y="20" width="30" height="30" rx="3" opacity="0.45" />
            <rect x="14" y="80" width="30" height="30" rx="3" opacity="0.45" />
            <rect x="56" y="80" width="30" height="30" rx="3" opacity="0.85" />
          </>
        )}
      </svg>
      <span className="ke-cover-glyph" style={{ color }}>{glyph}</span>
    </div>
  );
}

export function subjectArtworkFor(subj: string): string {
  return MOTIF[subj] || 'grid';
}

/** SubjectMotif — pure-SVG identity artwork for the four desktop discipline
 *  cards (ChatGPT Round C P1, 2026-11-02): EM2 plotted curve, SIGNALS
 *  waveform + frequency grid, FIS editorial "?" marginalia, DIGITAL logic
 *  gate + circuit traces. Abstract motifs only — never fake content. */
export function SubjectMotif({ subj }: { subj: string }) {
  if (subj === 'em2') {
    return (
      <svg viewBox="0 0 200 140" aria-hidden="true">
        <path d="M14 126 H188" opacity="0.45" />
        <path d="M22 8 V132" opacity="0.45" />
        <path d="M22 118 C60 118 66 44 104 44 S146 112 186 104" strokeWidth="2.4" />
        <circle cx="104" cy="44" r="3.4" className="motif-fill" />
        <circle cx="146" cy="88" r="2.4" className="motif-fill" opacity="0.7" />
        <circle cx="66" cy="86" r="2" className="motif-fill" opacity="0.5" />
      </svg>
    );
  }
  if (subj === 'signals') {
    const bars = [34, 58, 88, 66, 100, 76, 52, 40, 28];
    return (
      <svg viewBox="0 0 200 140" aria-hidden="true">
        {bars.map((h, i) => (
          <rect key={i} x={14 + i * 20} y={132 - h} width="10" height={h} rx="2" opacity="0.55" />
        ))}
        <path d="M8 52 C30 8 52 8 74 52 S118 96 140 52 S178 14 196 52" strokeWidth="2.4" />
        <circle cx="74" cy="52" r="3" className="motif-fill" />
      </svg>
    );
  }
  if (subj === 'fis') {
    return (
      <svg viewBox="0 0 200 140" aria-hidden="true">
        <line x1="22" y1="28" x2="82" y2="28" opacity="0.55" />
        <line x1="22" y1="42" x2="64" y2="42" opacity="0.35" />
        <line x1="22" y1="56" x2="76" y2="56" opacity="0.5" />
        <line x1="22" y1="98" x2="56" y2="98" opacity="0.35" />
        <line x1="22" y1="112" x2="70" y2="112" opacity="0.5" />
        <text x="118" y="108" fontSize="98" fontFamily="'Instrument Serif', Georgia, serif"
          className="motif-fill">?</text>
      </svg>
    );
  }
  // digital — logic gate + circuit traces
  return (
    <svg viewBox="0 0 200 140" aria-hidden="true">
      <path d="M70 40 H108 A32 32 0 0 1 108 104 H70 Z" strokeWidth="2.4" />
      <line x1="70" y1="56" x2="34" y2="56" />
      <line x1="70" y1="88" x2="34" y2="88" />
      <line x1="140" y1="72" x2="176" y2="72" />
      <circle cx="34" cy="56" r="3" className="motif-fill" />
      <circle cx="34" cy="88" r="3" className="motif-fill" />
      <circle cx="176" cy="72" r="3" className="motif-fill" />
      <path d="M148 18 h26 v22" opacity="0.55" />
      <circle cx="174" cy="40" r="2.4" className="motif-fill" opacity="0.7" />
      <path d="M40 116 h30" opacity="0.45" />
      <circle cx="70" cy="116" r="2.4" className="motif-fill" opacity="0.7" />
    </svg>
  );
}
