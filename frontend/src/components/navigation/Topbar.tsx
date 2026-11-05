import './Topbar.css';

interface TopbarProps {
  onSearch: () => void;
  /** current desktop section — rendered in the breadcrumb */
  crumb?: 'OVERVIEW' | 'LIBRARY' | 'SEARCH';
}

/** "Tue 3 Nov 2026" — en-GB parts, comma stripped. */
function todayLabel(): string {
  return new Date()
    .toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace(',', '');
}

/** Desktop-only topbar — OBSIDIAN ATLAS edition (76px instrument bar).
 *  Left: K/IND / LIBRARY / current-section breadcrumb + date.
 *  Right: archive status indicator + ⌘K global search trigger. */
export default function Topbar({ onSearch, crumb = 'OVERVIEW' }: TopbarProps) {
  return (
    <header className="kiA-topbar">
      <div className="kiA-topbar-left">
        <span className="kiA-topbar-wordmark">K/IND</span>
        <span className="kiA-topbar-sep" aria-hidden="true">/</span>
        <span className="kiA-topbar-crumb">LIBRARY</span>
        {crumb !== 'LIBRARY' && (
          <>
            <span className="kiA-topbar-sep" aria-hidden="true">/</span>
            <span className="kiA-topbar-crumb kiA-topbar-crumb--current">{crumb}</span>
          </>
        )}
        <span className="kiA-topbar-div" aria-hidden="true" />
        <span className="kiA-topbar-date">{todayLabel()}</span>
      </div>
      <div className="kiA-topbar-right">
        <span className="kiA-topbar-status">
          <span className="kiA-status-dot" aria-hidden="true" />
          ARCHIVE ONLINE
        </span>
        <button type="button" className="kiA-cmdk" onClick={onSearch} aria-label="Search (Command K)">
          <span className="kiA-cmdk-key">⌘K</span>
          <span className="kiA-cmdk-label">Search the archive</span>
        </button>
      </div>
    </header>
  );
}
