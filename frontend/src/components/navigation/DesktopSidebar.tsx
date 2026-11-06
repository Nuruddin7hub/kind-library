import { SUBJECTS, getSubjectCounts, v2SubjectColor } from '../../shared';
import type { LibFile } from '../../shared';
import type { CSSProperties } from 'react';
import './DesktopSidebar.css';

export type SidebarView = 'overview' | 'library' | 'search' | 'recent' | 'bookmarks';

interface DesktopSidebarProps {
  files: LibFile[];
  view: SidebarView;
  onNavigate: (v: SidebarView) => void;
  onGoSubject: (subj: string) => void;
  /** subject currently shown in the library view (null when not browsing a subject) */
  activeSubject?: string | null;
}

const NAV_ITEMS: Array<{ label: string; view: SidebarView; numeral: string }> = [
  { label: 'Overview', view: 'overview', numeral: 'I' },
  { label: 'Library', view: 'library', numeral: 'II' },
  { label: 'Search', view: 'search', numeral: 'III' },
  { label: 'Recent', view: 'recent', numeral: 'IV' },
  { label: 'Bookmarks', view: 'bookmarks', numeral: 'V' },
];

/** Desktop-only navigation — ATLAS edition "Institutional Register".
 *  248px fixed register plate: brand cartouche, roman-numeral main nav,
 *  the four-discipline plate registry, and an archive-status footer.
 *  Props unchanged so App.tsx integration stays identical. */
export default function DesktopSidebar({ files, view, onNavigate, onGoSubject, activeSubject }: DesktopSidebarProps) {
  const counts = getSubjectCounts(files);
  const total = files.length;

  return (
    <aside className="kiA-sidebar" aria-label="Archive navigation">
      <div className="kiA-brand">
        <div className="kiA-brand-frame">
          <div className="kiA-brand-mark">K/IND</div>
          <div className="kiA-brand-sub">THE KNOWLEDGE INSTRUMENT</div>
        </div>
        <div className="kiA-brand-est">FIELD EDITION / 004</div>
      </div>

      <nav className="kiA-mainnav" aria-label="Sections">
        <div className="kiA-section-label">WORKSPACE</div>
        {NAV_ITEMS.map((n) => (
          <button
            key={n.view}
            type="button"
            className={`kiA-nav${view === n.view ? ' kiA-nav--active' : ''}`}
            onClick={() => onNavigate(n.view)}
            aria-current={view === n.view ? 'page' : undefined}
          >
            <span className="kiA-nav-numeral" aria-hidden="true">{n.numeral}</span>
            <span className="kiA-nav-label">{n.label}</span>
            <span className="kiA-nav-tick" aria-hidden="true" />
          </button>
        ))}
      </nav>

      <div className="kiA-section">
        <div className="kiA-section-label">DISCIPLINES</div>
        <div className="kiA-subjects">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`kiA-subj${activeSubject === s.id ? ' kiA-subj--active' : ''}`}
              style={{ '--subj': v2SubjectColor(s.id) } as CSSProperties}
              onClick={() => onGoSubject(s.id)}
              aria-label={`${s.name} — ${counts[s.id] ?? 0} documents`}
              aria-current={activeSubject === s.id ? 'true' : undefined}
            >
              <span className="kiA-subj-dot" aria-hidden="true" />
              <span className="kiA-subj-meta">
                <span className="kiA-subj-code">{s.code}</span>
                <span className="kiA-subj-name">{s.short}</span>
              </span>
              <span className="kiA-subj-count">{String(counts[s.id] ?? 0).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="kiA-status" aria-label="Archive status">
        <div className="kiA-section-label">ARCHIVE</div>
        <span className="kiA-status-dot" aria-hidden="true" />
        <span className="kiA-status-text">Archive online</span>
        <span className="kiA-status-count">{total} documents</span>
      </div>
    </aside>
  );
}
