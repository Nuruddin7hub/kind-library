// K/IND mobile engine — shared subject index (ChatGPT Round B afternoon, 2026-11-02).
// ONE component, theme per subject via config — never duplicated pages.
// Only real stored metadata: doc counts, distinct sections, saved pages,
// most-recently-opened. Never invent reading progress or document types.

import { useMemo } from 'react';
import MobileDocRow, { pageImageUrl, type RowFile } from './MobileDocRow';
import ScrollReveal from '../bits/ScrollReveal';

interface ThemeConfig {
  badge: string;
  headline: string;
  lede: string;
  featured: boolean;
}

const THEMES: Record<string, ThemeConfig> = {
  em2: {
    badge: 'THE PROOF ROOM',
    headline: 'Where proofs become intuition.',
    lede: 'Equations, transforms and the machinery of mathematical methods — worked end to end.',
    featured: false,
  },
  signals: {
    badge: 'THE FREQUENCY DOMAIN',
    headline: 'Time becomes frequency.',
    lede: 'Signals, systems and their responses — in time, in frequency, in practice.',
    featured: false,
  },
  fis: {
    badge: 'THE PHILOSOPHY COLLECTION',
    headline: 'The art of questioning.',
    lede: 'Ideas. Arguments. Meaning.',
    featured: false,
  },
  digital: {
    badge: 'CIRCUIT LAB',
    headline: 'Logic becomes reality.',
    lede: 'Circuits, logic, systems and practical engineering.',
    featured: true,
  },
};

const posKey = (k: string) => `kl:pos:${k}`;

interface Props {
  subject: string;
  subjectCode: string;
  accent: string;
  files: RowFile[];
  sectionLabelOf: (section: string) => string;
  bookmarks: string[];
  toggleBookmark: (key: string) => void;
  openReader: (key: string, list: string[]) => void;
  /** most-recently-opened keys first (kl:recent), for the featured pick */
  recentKeys: string[];
  reducedMotion: boolean;
}

export default function MobileSubjectIndex({
  subject, subjectCode, accent, files,
  sectionLabelOf, bookmarks, toggleBookmark, openReader, recentKeys, reducedMotion,
}: Props) {
  const theme = THEMES[subject] || THEMES.em2;

  // distinct document types = distinct real sections (never invented)
  const typeCount = useMemo(() => new Set(files.map(f => f.section)).size, [files]);

  // featured = most recently opened doc in this subject, else the first
  const { featured, featuredIsRecent } = useMemo(() => {
    if (!theme.featured || files.length === 0) return { featured: null, featuredIsRecent: false };
    const byKey = new Map(files.map(f => [f.key, f]));
    for (const k of recentKeys) {
      const f = byKey.get(k);
      if (f) return { featured: f, featuredIsRecent: true };
    }
    return { featured: files[0], featuredIsRecent: false };
  }, [theme.featured, files, recentKeys]);

  const featuredPage = useMemo(() => {
    if (!featured) return 1;
    try {
      const saved = parseInt(localStorage.getItem(posKey(featured.key)) || '1', 10) || 1;
      return Math.min(Math.max(1, saved), featured.pages || 1);
    } catch { return 1; }
  }, [featured]);

  const list = files.filter(f => f !== featured);
  const openKey = (key: string) => openReader(key, files.map(r => r.key));

  return (
    <div className="ki-idx" style={{ ['--subject-accent' as any]: accent }}>
      <p className="ki-idx-kicker">K/IND / LIBRARY / {subjectCode}</p>
      <span className="ki-idx-badge">{theme.badge}</span>
      {reducedMotion ? (
        <h2 className="ki-idx-headline">{theme.headline}</h2>
      ) : (
        <ScrollReveal
          containerClassName="ki-idx-headline"
          textClassName="ki-idx-headline"
        >
          {theme.headline}
        </ScrollReveal>
      )}
      <p className="ki-idx-lede">{theme.lede}</p>
      <div className="ki-idx-stats">
        <div className="ki-idx-stat">
          <b>{files.length}</b>
          <span>DOCUMENTS</span>
        </div>
        <div className="ki-idx-stat">
          <b>{String(typeCount).padStart(2, '0')}</b>
          <span>DOCUMENT TYPES</span>
        </div>
        <div className="ki-idx-stat">
          <b>{String(files.length).padStart(2, '0')}</b>
          <span>INDEXED</span>
        </div>
      </div>

      {featured && (
        <>
          <div className="ki-idx-listhead">
            <span className="ap-eyebrow">FEATURED DOCUMENT</span>
          </div>
          <button
            className="ki-idx-feat"
            onClick={() => openKey(featured.key)}
            aria-label={`Open ${featured.title}, page ${featuredPage}`}
          >
            <img
              className="ki-idx-feat-thumb"
              src={pageImageUrl(featured.subj, featured.file, featuredPage, featured.pages)}
              alt=""
              loading="lazy"
              draggable={false}
            />
            <span className="ki-idx-feat-body">
              <span className="ap-eyebrow">
                {featuredPage > 1
                  ? `RESUME · PAGE ${featuredPage}`
                  : featuredIsRecent ? 'MOST RECENT' : 'START HERE'}
              </span>
              <span className="ki-idx-feat-title">{featured.title}</span>
              <span className="ki-row-meta">
                {sectionLabelOf(featured.section).toUpperCase()} · {featured.pages} PAGES
              </span>
              <span className="ki-idx-feat-cta">OPEN DOCUMENT →</span>
            </span>
          </button>
        </>
      )}

      <div className="ki-idx-listhead">
        <span className="ap-eyebrow">ALL DOCUMENTS</span>
        <span className="ap-eyebrow">{list.length || files.length} ITEMS</span>
      </div>
      <div style={{ margin: '0 -18px' }}>
        <div className="ki-list" style={{ padding: '0 18px' }}>
          {(featured ? list : files).map((f, i) => (
            <MobileDocRow
              key={f.key}
              f={f}
              index={featured ? i + 1 : i}
              accent={accent}
              subjectCode={subjectCode}
              sectionLabel={sectionLabelOf(f.section)}
              bookmarked={bookmarks.includes(f.key)}
              onOpen={() => openKey(f.key)}
              onToggleBookmark={() => toggleBookmark(f.key)}
            />
          ))}
        </div>
      </div>
      <p className="ki-row-hint">SWIPE A ROW LEFT TO BOOKMARK</p>
    </div>
  );
}
