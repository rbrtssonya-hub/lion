import LionArchiveOrnament from './LionArchiveOrnament.jsx';
import { heritageSources } from '../../data/home-heritage.js';

export function HeritageMotif({ kind = 'drum', className = '' }) {
  return <svg className={`heritage-motif ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    {kind === 'drum' ? <><path d="M14 21v23c0 10 36 10 36 0V21M14 27c8 7 28 7 36 0M19 45l-5 13m31-13 5 13M20 9l24 14M44 9 20 23" /><ellipse cx="32" cy="21" rx="18" ry="9" /><path d="M21 33v7m11-5v7m11-9v7" /></> : kind === 'horn' ? <><path d="M23 37C14 26 28 21 34 5c9 12 12 22 7 32M16 43c8-10 24-10 32 0l-3 11H19Z" /><path d="m28 29 7-10M20 46h24M25 54v5m14-5v5" /></> : <><circle cx="32" cy="32" r="16" /><circle cx="32" cy="32" r="7" /><path d="M32 7v8m0 34v8M7 32h8m34 0h8M14 14l6 6m24 24 6 6M14 50l6-6m24-24 6-6M20 52l-4 8m28-8 4 8" /></>}
  </svg>;
}

export function HeritageHeading({ id, eyebrow, title, children }) {
  return <header className="heritage-heading archive-reading-panel" data-surface="cultureTitle">
    <p className="heritage-eyebrow">{eyebrow}</p>
    <div className="lion-archive-title-line"><h2 id={id}>{title}</h2><LionArchiveOrnament /></div>
    <p className="heritage-lead">{children}</p>
  </header>;
}

export function HeritageLinks({ ids }) {
  return <div className="heritage-links">{ids.map(id => {
    const source = heritageSources.find(item => item.id === id);
    return <a className="interaction-cue" key={id} href={source.url} target="_blank" rel="noreferrer">查阅资料 · {source.publisher} <span aria-hidden="true">↗</span></a>;
  })}</div>;
}

export function handleHeritageTabs(event, index, count, select) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const next = { ArrowRight: (index + 1) % count, ArrowLeft: (index + count - 1) % count, Home: 0, End: count - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  select(next);
  event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
}
