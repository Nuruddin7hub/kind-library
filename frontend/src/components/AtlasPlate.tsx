import type { CSSProperties, ReactNode } from 'react';
import { v2SubjectColor, disciplineGlyph, sectionLabel } from '../shared';
import './AtlasPlate.css';

interface AtlasPlateProps {
  subj: string;
  title: string;
  section: string;
  pages: number;
  /** stable 1-based number of the doc within its subject (CODE-NN) */
  docNo: number;
}

/** Subject ornament — large glyph shorthand (critique §11, 2026-11-06):
 *  EM2 ∑ · Signals ∿ · FIS Φ · Digital ⌘, Φ at 94px, opacity .9,
 *  near the lower third of the plate. Replaces the 2026-11-05 SVG
 *  line-art ornaments (curve / wave / circuit). */
function Ornament({ subj, color }: { subj: string; color: string }): ReactNode {
  return (
    <span
      className={`kiA-ap-glyph kiA-ap-glyph--${subj}`}
      style={{ color }}
      aria-hidden="true"
    >
      {disciplineGlyph(subj)}
    </span>
  );
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
