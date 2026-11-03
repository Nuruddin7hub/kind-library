// K/IND mobile engine — MOBILE HOME screen (ChatGPT Round B, 2026-11-03).
// Editorial mobile home: header · hero (Aurora + four-orbit knowledge map) ·
// search · 2-col discipline grid with per-subject SVG motifs · resume card ·
// recently-explored snap row. Desktop untouched. Mobile only.
//
// NOTE: this file is created per the Round B spec and is NOT edited by it.

import { useState, type CSSProperties } from 'react';
import type { LibFile } from '../shared';
import { SUBJECTS, pageImageUrl, relTime, subjectOf } from '../shared';
import Aurora from '../bits/Aurora';
import BlurText from '../bits/BlurText';
import Carousel from '../bits/Carousel';
import DocCover from './DocCover';
import './DocCover.css';
import './MobileHome.css';

export interface ResumeInfo {
  file: LibFile;
  page: number;
}

export interface RecentInfo {
  file: LibFile;
  ts: number | null;
}

export interface MobileHomeProps {
  totalDocs: number;
  totalPages: number;
  subjectCounts: Record<string, number>;
  resume: ResumeInfo | null;          // real saved progress (kl:pos)
  recent: RecentInfo[];               // recently opened, max ~5
  reducedMotion: boolean;
  onOpenSubject: (subj: string) => void;
  onOpenReader: (key: string, list: string[]) => void;
  onSearch: (q: string) => void;      // submit hero search
}

/** Inline SVG decorative motif per subject — subtle background artwork. */
function SubjectMotif({ id, color }: { id: string; color: string }) {
  if (id === 'em2') {
    const grid: string[] = [];
    for (let x = 0; x <= 120; x += 15) grid.push(`M${x},0 V100`);
    for (let y = 0; y <= 100; y += 15) grid.push(`M0,${y} H120`);
    return (
      <svg className="mh-motif" viewBox="0 0 120 100" aria-hidden="true">
        <path d={grid.join(' ')} stroke="rgba(255,255,255,.07)" strokeWidth="1" fill="none" />
        <path d="M4,86 C30,78 44,30 72,26 C96,23 104,44 118,40" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="72" cy="26" r="3.5" fill={color} />
      </svg>
    );
  }
  if (id === 'signals') {
    return (
      <svg className="mh-motif" viewBox="0 0 120 100" aria-hidden="true">
        <line x1="0" y1="52" x2="120" y2="52" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="3 4" />
        <path
          d="M0,52 C10,52 12,14 22,14 C32,14 30,90 42,90 C54,90 52,30 64,30 C76,30 74,74 86,74 C98,74 100,52 120,52"
          stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'fis') {
    return (
      <svg className="mh-motif" viewBox="0 0 120 100" aria-hidden="true">
        <text x="58" y="86" textAnchor="middle" fontSize="96" fill={color} opacity="0.85"
          fontFamily="'Instrument Serif', serif">&ldquo;</text>
        <line x1="8" y1="14" x2="52" y2="14" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
        <line x1="8" y1="22" x2="36" y2="22" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
      </svg>
    );
  }
  // digital — circuit traces + pads
  return (
    <svg className="mh-motif" viewBox="0 0 120 100" aria-hidden="true">
      <path d="M8,22 H52 V48 H92" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M8,78 H34 V58" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M92,48 V86 H112" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="8" cy="22" r="4" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="52" cy="48" r="3" fill={color} />
      <circle cx="34" cy="58" r="3" fill={color} />
      <circle cx="112" cy="86" r="4" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** Four-orbit knowledge map — one node per discipline, slow 40s rotation. */
function OrbitMap({ animate }: { animate: boolean }) {
  const nodes = SUBJECTS.map((s, i) => {
    const a = ((-90 + i * 90) * Math.PI) / 180;
    return { x: 120 + 84 * Math.cos(a), y: 100 + 68 * Math.sin(a), color: s.color };
  });
  return (
    <svg className="mh-orbit" viewBox="0 0 240 200" aria-hidden="true">
      <g className={animate ? 'mh-orbit-spin' : undefined}>
        <ellipse cx="120" cy="100" rx="84" ry="68" fill="none"
          stroke="rgba(255,255,255,.10)" strokeWidth="1" strokeDasharray="2 5" />
        {nodes.map((n, i) => {
          const m = nodes[(i + 1) % nodes.length];
          return <line key={`l${i}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y}
            stroke="rgba(255,255,255,.14)" strokeWidth="1" />;
        })}
        {nodes.map((n, i) => (
          <g key={`n${i}`}>
            <circle cx={n.x} cy={n.y} r="9" fill={n.color} opacity="0.18" />
            <circle cx={n.x} cy={n.y} r="4.5" fill={n.color} opacity="0.9" />
          </g>
        ))}
        <circle cx="120" cy="100" r="3" fill="rgba(255,255,255,.35)" />
      </g>
    </svg>
  );
}

export default function MobileHome(props: MobileHomeProps) {
  const {
    totalDocs, totalPages, subjectCounts, resume, recent,
    reducedMotion, onOpenSubject, onOpenReader, onSearch,
  } = props;
  const [query, setQuery] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch(q);
  };

  const resumeSubj = resume ? subjectOf(resume.file.subj) : undefined;
  const resumeColor = resumeSubj?.color ?? '#719AFF';
  const resumePage = resume ? Math.max(1, Math.min(resume.page, Math.max(1, resume.file.pages))) : 1;
  const resumePages = Math.max(1, resume?.file.pages ?? 1);
  const resumePct = Math.round((resumePage / resumePages) * 100);

  return (
    <div className="mh mobile-page">
      {/* 1 — Header 48px */}
      <header className="mh-header">
        <span className="mh-wordmark">K/IND</span>
        <span className="mh-micro">{totalDocs} DOCS · 4 DISCIPLINES</span>
      </header>

      {/* 2–6 — Hero */}
      <section className="mh-hero">
        {!reducedMotion && (
          <div className="mh-aurora" aria-hidden="true">
            <Aurora
              colorStops={['#568BFF', '#B18AFF', '#45D9C2']}
              amplitude={1.1}
              blend={0.5}
              speed={0.25}
              mouseInteraction={false}
            />
          </div>
        )}
        <OrbitMap animate={!reducedMotion} />

        <div className="mh-hero-copy">
          <p className="mh-eyebrow">K/IND · FIELD EDITION</p>
          {!reducedMotion ? (
            <>
              <BlurText className="mh-headline" text="Think deeper." animateBy="words"
                trigger="load" loop={false} delay={70} stepDuration={0.35} blur={8} distance={30} />
              <BlurText className="mh-headline" text="Connect everything." animateBy="words"
                trigger="load" loop={false} delay={110} stepDuration={0.35} blur={8} distance={30} />
            </>
          ) : (
            <h1 className="mh-headline">Think deeper.<br />Connect everything.</h1>
          )}
          <p className="mh-supporting">
            {totalDocs} documents. 4 disciplines. Your entire study world.
          </p>
          <form className="mh-search" onSubmit={submitSearch} role="search">
            <input
              className="mh-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an idea, equation, lecture…"
              enterKeyHint="search"
              aria-label="Search the library"
            />
            <button className="mh-search-go" type="submit" aria-label="Search">
              →
            </button>
          </form>
          {/* three compact stat figures — all real counts */}
          <div className="mh-stats" aria-label="Library statistics">
            <div className="mh-stat">
              <span className="mh-stat-num">{totalDocs}</span>
              <span className="mh-stat-label">DOCUMENTS</span>
            </div>
            <div className="mh-stat">
              <span className="mh-stat-num">{SUBJECTS.length}</span>
              <span className="mh-stat-label">DISCIPLINES</span>
            </div>
            <div className="mh-stat">
              <span className="mh-stat-num">{totalPages.toLocaleString('en-US')}</span>
              <span className="mh-stat-label">PAGES</span>
            </div>
          </div>
        </div>
      </section>

      {/* 8 — Disciplines */}
      <section className="mh-section">
        <h2 className="mh-section-head">YOUR DISCIPLINES</h2>
        <div className="mh-tiles">
          {SUBJECTS.map((s) => {
            const count = subjectCounts[s.id] ?? 0;
            return (
              <button
                key={s.id}
                className="mh-tile"
                style={{ '--sc': s.color } as CSSProperties}
                onClick={() => onOpenSubject(s.id)}
                aria-label={`${s.name} — ${count} documents`}
              >
                <SubjectMotif id={s.id} color={s.color} />
                <span className="mh-tile-num">{s.num}</span>
                <span className="mh-tile-short" style={{ color: s.color }}>
                  {s.short.toUpperCase()}
                </span>
                <span className="mh-tile-name">{s.name}</span>
                <span className="mh-tile-count">{count} DOCUMENTS</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 8b — Continue Reading (after the grid: real doc + page + progress + RESUME →) */}
      {resume && (
        <section className="mh-section mh-resume-section">
          <h2 className="mh-section-head">CONTINUE READING</h2>
          <button
            className="mh-resume"
            style={{ '--sc': resumeColor } as CSSProperties}
            onClick={() => onOpenReader(resume.file.key, [resume.file.key])}
            aria-label={`Continue reading ${resume.file.title}, page ${resumePage} of ${resumePages}`}
          >
            <DocCover
              src={pageImageUrl(resume.file.subj, resume.file.file, resumePage, resumePages)}
              subj={resume.file.subj}
              docIndex={1}
              docType="RESUME"
              className="mh-resume-thumb"
            />
            <span className="mh-resume-body">
              <span className="mh-resume-eyebrow" style={{ color: resumeColor }}>
                {resumeSubj?.code ?? 'K/IND'}
              </span>
              <span className="mh-resume-title">{resume.file.title}</span>
              <span className="mh-resume-meta">
                PAGE {resumePage} OF {resumePages} · {resumePct}%
              </span>
              <span className="mh-resume-bar">
                <span className="mh-resume-fill" style={{ width: `${resumePct}%` }} />
              </span>
              <span className="mh-resume-cta">RESUME →</span>
            </span>
          </button>
        </section>
      )}

      {/* 9 — Recently explored (React Bits Carousel: native touch gestures, no autoplay) */}
      {recent.length > 0 && (
        <section className="mh-section">
          <h2 className="mh-section-head">RECENTLY EXPLORED</h2>
          <Carousel cardWidth={150} gap={10} showArrows={false} ariaLabel="Recently explored documents">
            {recent.map((r, i) => (
              <button
                key={r.file.key}
                className="mh-recent-card"
                onClick={() => onOpenReader(r.file.key, [r.file.key])}
                aria-label={`Open ${r.file.title}`}
              >
                <DocCover
                  src={pageImageUrl(r.file.subj, r.file.file, 1, Math.max(1, r.file.pages))}
                  subj={r.file.subj}
                  docIndex={i + 1}
                  className="mh-recent-thumb"
                />
                <span className="mh-recent-title">{r.file.title}</span>
                <span className="mh-recent-time">{relTime(r.ts)}</span>
              </button>
            ))}
          </Carousel>
        </section>
      )}
    </div>
  );
}
