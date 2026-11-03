import './Topbar.css';

interface TopbarProps {
  onSearch: () => void;
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

/** Desktop-only topbar — ChatGPT Round A, 2026-11-03. */
export default function Topbar({ onSearch }: TopbarProps) {
  return (
    <header className="kiA-topbar">
      <div className="kiA-topbar-left">
        <span className="kiA-topbar-eyebrow">ARCHIVE</span>
        <span className="kiA-topbar-date">{todayLabel()}</span>
      </div>
      <button type="button" className="kiA-cmdk" onClick={onSearch} aria-label="Search (Command K)">
        <span className="kiA-cmdk-key">⌘K</span>
        <span className="kiA-cmdk-label">Search</span>
      </button>
    </header>
  );
}
