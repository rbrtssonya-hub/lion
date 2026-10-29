import { useEffect, useRef } from 'react';
import { ArrowUpRight, X } from './AtlasIcons.jsx';
import './lion-breakdown.css';

export default function LionDetailModal({ part, breakdown, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(panelRef.current?.querySelectorAll('button:not([disabled]), a[href]') || [])]
      .filter(element => element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div
    className="lion-detail-backdrop"
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
  >
    <section
      className="lion-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lion-detail-title"
      aria-describedby="lion-detail-intro"
      ref={panelRef}
      onKeyDown={handleKeyDown}
    >
      <figure className="lion-detail-visual">
        <img src={breakdown.image} alt={breakdown.imageAlt} draggable="false" />
        <figcaption>用户提供的部位海报 · 图示不代表模型拆件或实测图</figcaption>
      </figure>
      <div className="lion-detail-reading">
        <button ref={closeRef} className="lion-detail-close" type="button" aria-label="关闭文化讲解" onClick={onClose}>
          <X size={19} strokeWidth={1.5} />
        </button>
        <header className="lion-detail-header">
          <p className="lion-detail-kicker">{part.number} / THE LION ATLAS · CULTURAL READING</p>
          <h2 id="lion-detail-title">{part.name}</h2>
          <p className="lion-detail-subtitle">{breakdown.subtitle}</p>
          <p id="lion-detail-intro" className="lion-detail-intro">{breakdown.intro}</p>
        </header>
        <div className="lion-detail-sections">
          {breakdown.sections.map((item, index) => <section className="lion-detail-section" key={item.title}>
            <div className="lion-detail-section-heading">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><small>{item.label}</small><h3>{item.title}</h3></div>
              <em>{item.evidence}</em>
            </div>
            <p>{item.text}</p>
          </section>)}
        </div>
        <footer className="lion-detail-sources">
          <h3>资料来源</h3>
          <ul>
            {breakdown.sources.map(source => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                <span>{source.title}</span><ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </li>)}
          </ul>
        </footer>
      </div>
    </section>
  </div>;
}
