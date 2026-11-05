import type { CSSProperties, ReactNode } from 'react';
import { v2SubjectColor, sectionLabel } from '../shared';
import './AtlasPlate.css';

interface AtlasPlateProps {
  subj: string;
  title: string;
  section: string;
  pages: number;
  /** stable 1-based number of the doc within its subject (CODE-NN) */
  docNo: number;
}

/** Subject ornament — minimal cartographic glyphs drawn for this plate. */
function Ornament({ subj, color }: { subj: string; color: string }): ReactNode {
  switch (subj) {
    case 'em2':
      return (
        <svg viewBox="0 0 120 44" className="kiA-ap-orn" aria-hidden="true">
          <path d="M 6 38 Q 40 38 60 10 T 114 6" fill="none" stroke={color} strokeWidth="1.6" />
          <circle cx={60} cy={10} r={2.6} fill={color} />
        </svg>
      );
    case 'signals':
      return (
        <svg viewBox="0 0 120 44" className="kiA-ap-orn" aria-hidden="true">
          <path d="M 4 22 C 22 4, 34 4, 48 22 S 74 40, 92 22 S 110 8, 116 22" fill="none" stroke={color} strokeWidth="1.6" />
        </svg>
      );
    case 'fis':
      return (
        <svg viewBox="0 0 120 44" className="kiA-ap-orn" aria-hidden="true">
          <text x={52} y={36} textAnchor="middle" className="kiA-ap-phi" fill={color}>Φ</text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 44" className="kiA-ap-orn" aria-hidden="true">
          <path d="M 6 34 L 34 34 L 46 22 L 78 22 L 90 10 L 114 10" fill="none" stroke={color} strokeWidth="1.6" />
          <circle cx={6} cy={34} r={2.4} fill={color} />
          <circle cx={114} cy={10} r={2.4} fill={color} />
        </svg>
      );
  }
}

/** ATLAS edition document plate — the desktop replacement for DocCoverCard.
 *  Midnight plate, subject hairline, serif title, real metadata only.
 *  Desktop branch only; mobile keeps using DocCoverCard (untouched). */
export default function AtlasPlate({ subj, title, section, pages, docNo }: AtlasPlateProps) {
  const color = v2SubjectColor(subj);
  const code = subj.toUpperCase();
  return (
    <div className="kiA-ap" style={{ '--subj': color } as CSSProperties}>
      <div className="kiA-ap-frame" aria-hidden="true">
        <span className="kiA-ap-tick kiA-ap-tick--tl" />
        <span className="kiA-ap-tick kiA-ap-tick--tr" />
        <span className="kiA-ap-tick kiA-ap-tick--bl" />
        <span className="kiA-ap-tick kiA-ap-tick--br" />
      </div>
      <div className="kiA-ap-top">
        <span className="kiA-ap-plate">PLATE Nº {String(docNo).padStart(2, '0')}</span>
        <span className="kiA-ap-code" style={{ color }}>{code}</span>
      </div>
      <h4 className="kiA-ap-title">{title}</h4>
      <p className="kiA-ap-meta">
        {sectionLabel(section)} · {pages} page{pages === 1 ? '' : 's'}
      </p>
      <div className="kiA-ap-ornwrap">
        <Ornament subj={subj} color={color} />
      </div>
    </div>
  );
}
