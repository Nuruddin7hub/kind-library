import LineSidebar from '../../bits/LineSidebar';
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

const NAV_ITEMS: Array<{ label: string; view: SidebarView }> = [
  { label: 'OVERVIEW', view: 'overview' },
  { label: 'LIBRARY', view: 'library' },
  { label: 'SEARCH', view: 'search' },
  { label: 'RECENT', view: 'recent' },
  { label: 'BOOKMARKS', view: 'bookmarks' },
];

/** Desktop-only navigation shell — ChatGPT Round A, 2026-11-03.
 *  Main nav uses the vendored React Bits LineSidebar (proximity response,
 *  subject-neutral active state). The DISCIPLINES rows are hand-built:
 *  LineSidebar items are plain strings with no custom-label slot, so the
 *  dot + code + name + count rows use a hover line-grow effect instead. */
export default function DesktopSidebar({ files, view, onNavigate, onGoSubject, activeSubject }: DesktopSidebarProps) {
  const counts = getSubjectCounts(files);
  const activeNav = NAV_ITEMS.findIndex((n) => n.view === view);

  return (
    <aside className="kiA-sidebar" aria-label="Archive navigation">
      <div className="kiA-brand">
        <div className="kiA-brand-mark">K/IND</div>
        <div className="kiA-brand-sub">THE KNOWLEDGE ARCHIVE</div>
      </div>

      <nav className="kiA-mainnav" aria-label="Sections">
        <LineSidebar
          key={view}
          items={NAV_ITEMS.map((n) => n.label)}
          defaultActive={activeNav >= 0 ? activeNav : null}
          onItemClick={(i) => onNavigate(NAV_ITEMS[i].view)}
          accentColor="var(--text)"
          textColor="var(--text-secondary)"
          markerColor="var(--border)"
          showIndex={false}
          showMarker={false}
          proximityRadius={90}
          maxShift={12}
          falloff="smooth"
          fontSize={0.78}
          itemGap={20}
          className="kiA-linesidebar"
        />
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
              <span className="kiA-subj-num">{s.num}</span>
              <span className="kiA-subj-dot" aria-hidden="true" />
              <span className="kiA-subj-meta">
                <span className="kiA-subj-code">{s.code}</span>
                <span className="kiA-subj-name">{s.name}</span>
              </span>
              <span className="kiA-subj-count">{counts[s.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="kiA-status" aria-label="Archive status">
        <span className="kiA-status-dot" aria-hidden="true" />
        <span className="kiA-status-text">ARCHIVE ONLINE</span>
        <span className="kiA-status-count">{files.length} DOCS</span>
      </div>
    </aside>
  );
}
